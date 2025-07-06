/**
 * BG3 Target Selector - Provides interactive target selection for spells and abilities
 * Inspired by Argon Combat HUD but adapted for BG3 Inspired Hotbar
 */
export class TargetSelector {
    constructor({ token, requirements = {} }) {
        this.token = token;
        this.requirements = requirements;
        this.selectedTargets = [];
        this.isActive = false;
        this.originalCursor = null;
        
        // UI elements
        this.targetCountDisplay = null;
        this.mouseTargetDisplay = null;
        this.rangeIndicators = [];
        this.mouseUpdateFrame = null;
        
        // Token controls state
        this.originalTokenTool = null;
        
        // Event handlers (bound to preserve context)
        this.onCanvasClick = this.onCanvasClick.bind(this);
        this.onCanvasRightClick = this.onCanvasRightClick.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onTokenHover = this.onTokenHover.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onDocumentClick = this.onDocumentClick.bind(this);
        
        // Promise resolution
        this.resolvePromise = null;
        this.rejectPromise = null;
    }

    /**
     * Start the target selection process
     * @returns {Promise<Token[]>} Promise that resolves with selected targets
     */
    async select() {
        if (this.isActive) {
            console.warn("BG3 Target Selector | Target selector is already active");
            return [];
        }

        return new Promise((resolve, reject) => {
            this.resolvePromise = resolve;
            this.rejectPromise = reject;
            this.activate();
        });
    }

    /**
     * Activate the target selector
     */
    activate() {
        this.isActive = true;
        this.selectedTargets = [];
        
        // Change cursor to crosshair
        this.originalCursor = document.body.style.cursor;
        document.body.style.cursor = 'crosshair';
        
        // Switch to target tool to prevent token selection
        this.switchToTargetTool();
        
        // Add event listeners
        canvas.stage.on('click', this.onCanvasClick);
        canvas.stage.on('rightclick', this.onCanvasRightClick);
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('mousemove', this.onMouseMove, { passive: true });
        
        // Add high-priority click listener to intercept all clicks
        document.addEventListener('click', this.onDocumentClick, { capture: true });
        
        // Show UI elements
        this.showTargetCountDisplay();
        this.showMouseTargetDisplay();
        this.showRangeIndicators();
        
        // Notify user
        ui.notifications.info("Select targets. Press ESC to cancel or right-click when done.");
    }

    /**
     * Deactivate the target selector
     */
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Restore cursor
        document.body.style.cursor = this.originalCursor;
        
        // Restore original token tool
        this.restoreTokenTool();
        
        // Remove event listeners
        canvas.stage.off('click', this.onCanvasClick);
        canvas.stage.off('rightclick', this.onCanvasRightClick);
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('click', this.onDocumentClick, { capture: true });
        
        // Cancel any pending animation frame
        if (this.mouseUpdateFrame) {
            cancelAnimationFrame(this.mouseUpdateFrame);
            this.mouseUpdateFrame = null;
        }
        
        // Hide UI elements
        this.hideTargetCountDisplay();
        this.hideMouseTargetDisplay();
        this.hideRangeIndicators();
        
        // Clear target highlights
        this.clearTargetHighlights();
    }

    /**
     * Handle canvas click events
     */
    onCanvasClick(event) {
        // Always prevent default canvas behaviour when target selector is active
        event.stopPropagation();
        event.preventDefault();
        
        const token = this.getTokenFromEvent(event);
        if (!token) return;
        
        if (this.isValidTarget(token)) {
            this.toggleTarget(token);
        } else {
            ui.notifications.warn("Invalid target selected");
        }
    }

    /**
     * Handle canvas right-click events
     */
    onCanvasRightClick(event) {
        event.preventDefault();
        this.confirmSelection();
    }

    /**
     * Handle keyboard events
     */
    onKeyDown(event) {
        if (event.key === 'Escape') {
            this.cancel();
        } else if (event.key === '[') {
            // Decrease max targets (minimum 1)
            this.adjustMaxTargets(-1);
            event.preventDefault();
        } else if (event.key === ']') {
            // Increase max targets
            this.adjustMaxTargets(1);
            event.preventDefault();
        }
    }

    /**
     * Adjust the maximum target count
     */
    adjustMaxTargets(delta) {
        const newMax = Math.max(1, (this.requirements.maxTargets || 1) + delta);
        this.requirements.maxTargets = newMax;
        
        console.log('BG3 Target Selector | Adjusted max targets:', {
            newMax: newMax,
            currentSelected: this.selectedTargets.length
        });
        
        // Store current mouse position before recreating displays
        let currentMouseX = 0, currentMouseY = 0;
        if (this.mouseTargetDisplay) {
            const element = this.mouseTargetDisplay[0];
            if (element) {
                currentMouseX = parseInt(element.style.left) - 20; // Remove offset
                currentMouseY = parseInt(element.style.top) + 20; // Remove offset
            }
        }
        
        // Update displays
        this.updateTargetCountDisplay();
        
        // Recreate the target count display with new max
        this.hideTargetCountDisplay();
        this.showTargetCountDisplay();
        
        // Recreate the mouse target display with new max and restore position
        this.hideMouseTargetDisplay();
        this.showMouseTargetDisplay();
        
        // Restore mouse position if we had one
        if (currentMouseX > 0 || currentMouseY > 0) {
            this.updateMouseTargetDisplay(currentMouseX, currentMouseY);
        }
        
        this.updateMouseTargetDisplayCount();
    }

    /**
     * Handle token hover events
     */
    onTokenHover(token) {
        if (!this.isActive) return;
        
        // Show range indicator for hovered token
        this.updateRangeIndicator(token);
    }

    /**
     * Handle mouse move events
     */
    onMouseMove(event) {
        if (!this.isActive) return;
        
        // Use requestAnimationFrame for smoother updates
        if (this.mouseUpdateFrame) {
            cancelAnimationFrame(this.mouseUpdateFrame);
        }
        
        this.mouseUpdateFrame = requestAnimationFrame(() => {
            this.updateMouseTargetDisplay(event.clientX, event.clientY);
        });
    }

    /**
     * Handle document click events to prevent token selection
     */
    onDocumentClick(event) {
        if (!this.isActive) return;
        
        // Check if the click is on the canvas area
        const canvasElement = document.getElementById('board');
        if (canvasElement && canvasElement.contains(event.target)) {
            // Prevent any token selection when target selector is active
            event.stopPropagation();
            event.preventDefault();
        }
    }

    /**
     * Get token from canvas event
     */
    getTokenFromEvent(event) {
        const position = event.data.getLocalPosition(canvas.tokens);
        const token = canvas.tokens.placeables.find(t => {
            const bounds = t.bounds;
            return position.x >= bounds.x && position.x <= bounds.x + bounds.width &&
                   position.y >= bounds.y && position.y <= bounds.y + bounds.height;
        });
        return token;
    }

    /**
     * Check if a token is a valid target
     */
    isValidTarget(token) {
        if (!token) return false;
        
        // Check if token is within range
        if (this.requirements.range && !this.isWithinRange(token)) {
            return false;
        }
        
        // Check if token meets target type requirements
        if (this.requirements.type && !this.meetsTargetType(token)) {
            return false;
        }
        
        // Check if we can target this token (visibility, etc.)
        if (!token.isVisible || token.document.hidden) {
            return false;
        }
        
        return true;
    }

    /**
     * Check if token is within range
     */
    isWithinRange(token) {
        // Check if range checking is disabled
        if (!game.settings.get('bg3-inspired-hotbar', 'enableRangeChecking')) {
            return true; // Allow all targets when range checking is disabled
        }
        
        if (!this.requirements.range || !this.token) return true;
        
        const distance = canvas.grid.measureDistance(
            this.token.center,
            token.center,
            { gridSpaces: true }
        );
        

        
        return distance <= this.requirements.range;
    }

    /**
     * Check if token meets target type requirements
     */
    meetsTargetType(token) {
        if (!this.requirements.type) return true;
        
        const targetType = this.requirements.type.toLowerCase();
        const actor = token.actor;
        
        switch (targetType) {
            case 'self':
                return token === this.token;
            case 'ally':
                return actor && this.token.actor && 
                       actor.system.details?.alignment === this.token.actor.system.details?.alignment;
            case 'enemy':
                return actor && this.token.actor && 
                       actor.system.details?.alignment !== this.token.actor.system.details?.alignment;
            case 'creature':
                return actor && actor.type === 'character' || actor.type === 'npc';
            default:
                return true;
        }
    }

    /**
     * Toggle target selection
     */
    toggleTarget(token) {
        const index = this.selectedTargets.indexOf(token);
        
        console.log('BG3 Target Selector | Toggle target:', {
            tokenName: token.name,
            currentlySelected: index >= 0,
            selectedCount: this.selectedTargets.length,
            maxTargets: this.requirements.maxTargets || 1
        });
        
        if (index >= 0) {
            // Remove target
            this.selectedTargets.splice(index, 1);
            this.removeTargetHighlight(token);
        } else {
            // Add target (no limits - let players decide)
            this.selectedTargets.push(token);
            this.addTargetHighlight(token);
        }
        
        this.updateTargetCountDisplay();
        this.updateMouseTargetDisplayCount();
    }



    /**
     * Add visual highlight to target
     */
    addTargetHighlight(token) {
        // Update Foundry's target list to include all our selected targets
        this.updateFoundryTargets();
    }

    /**
     * Remove visual highlight from target
     */
    removeTargetHighlight(token) {
        // Update Foundry's target list to exclude the removed target
        this.updateFoundryTargets();
    }

    /**
     * Update Foundry's targeting system with our selected targets
     */
    updateFoundryTargets() {
        const targetIds = this.selectedTargets.map(token => token.id);
        console.log('BG3 Target Selector | Updating Foundry targets:', {
            selectedTargets: this.selectedTargets.map(t => t.name),
            targetIds: targetIds
        });
        game.user.updateTokenTargets(targetIds);
    }

    /**
     * Clear all target highlights
     */
    clearTargetHighlights() {
        this.selectedTargets.forEach(token => {
            // No need to remove individually, we'll clear all at once
        });
        // Clear all targets in Foundry's system
        game.user.updateTokenTargets([]);
    }

    /**
     * Show target count display
     */
    showTargetCountDisplay() {
        if (this.targetCountDisplay) return;
        
        const minTargets = this.requirements.minTargets || 1;
        const maxTargets = this.requirements.maxTargets || 1;
        
        this.targetCountDisplay = $(`
            <div id="bg3-target-count" style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px;
                border-radius: 5px;
                font-family: 'Signika', sans-serif;
                z-index: 10000;
            ">
                <div>Targets: <span id="bg3-target-current">0</span>/${maxTargets}</div>
                ${minTargets > 1 ? `<div>Minimum: ${minTargets}</div>` : ''}
            </div>
        `);
        
        $('body').append(this.targetCountDisplay);
    }

    /**
     * Update target count display
     */
    updateTargetCountDisplay() {
        if (this.targetCountDisplay) {
            const current = this.selectedTargets.length;
            const max = this.requirements.maxTargets || 1;
            const currentSpan = this.targetCountDisplay.find('#bg3-target-current');
            
            currentSpan.text(current);
            
            // Change color to indicate if over recommended target count
            if (current > max) {
                currentSpan.css('color', '#ff6b6b'); // Red for over target count
            } else {
                currentSpan.css('color', '#ffffff'); // White for normal
            }
        }
    }

    /**
     * Hide target count display
     */
    hideTargetCountDisplay() {
        if (this.targetCountDisplay) {
            this.targetCountDisplay.remove();
            this.targetCountDisplay = null;
        }
    }

    /**
     * Show mouse target display
     */
    showMouseTargetDisplay() {
        if (this.mouseTargetDisplay) return;
        
        const maxTargets = this.requirements.maxTargets || 1;
        
        this.mouseTargetDisplay = $(`
            <div id="bg3-mouse-target-count" style="
                position: fixed;
                background: rgba(0, 0, 0, 0.9);
                color: #ffffff;
                padding: 4px 8px;
                border-radius: 4px;
                font-family: 'Signika', sans-serif;
                font-size: 12px;
                font-weight: 600;
                z-index: var(--bg3-z-target-selector, 10001);
                border: 1px solid var(--bg3-border-color, #8b4513);
                pointer-events: none;
                user-select: none;
            ">
                <span id="bg3-mouse-target-current">0</span>/${maxTargets}
            </div>
        `);
        
        $('body').append(this.mouseTargetDisplay);
    }

    /**
     * Update mouse target display position
     */
    updateMouseTargetDisplay(mouseX, mouseY) {
        if (this.mouseTargetDisplay) {
            // Use direct DOM manipulation for better performance
            const element = this.mouseTargetDisplay[0];
            if (element) {
                element.style.left = (mouseX + 20) + 'px';
                element.style.top = (mouseY - 20) + 'px';
            }
        }
    }

    /**
     * Update mouse target display count
     */
    updateMouseTargetDisplayCount() {
        if (this.mouseTargetDisplay) {
            this.mouseTargetDisplay.find('#bg3-mouse-target-current').text(this.selectedTargets.length);
        }
    }

    /**
     * Hide mouse target display
     */
    hideMouseTargetDisplay() {
        if (this.mouseTargetDisplay) {
            this.mouseTargetDisplay.remove();
            this.mouseTargetDisplay = null;
        }
    }

    /**
     * Show range indicators
     */
    showRangeIndicators() {
        // Don't show range indicators if range checking is disabled or if show range indicators is disabled
        if (!game.settings.get('bg3-inspired-hotbar', 'enableRangeChecking') || 
            !game.settings.get('bg3-inspired-hotbar', 'showRangeIndicators')) {
            return;
        }
        
        if (!this.requirements.range || !this.token) return;
        
        // Range is in scene units, convert to pixels
        const gridDistance = canvas.scene.grid.distance || 5;
        const radiusInPixels = (this.requirements.range / gridDistance) * canvas.grid.size;
        
        // Create range circle
        const rangeCircle = new PIXI.Graphics();
        rangeCircle.lineStyle(2, 0x00ff00, 0.5);
        rangeCircle.drawCircle(0, 0, radiusInPixels);
        rangeCircle.x = this.token.center.x;
        rangeCircle.y = this.token.center.y;
        
        canvas.interface.addChild(rangeCircle);
        this.rangeIndicators.push(rangeCircle);
    }

    /**
     * Hide range indicators
     */
    hideRangeIndicators() {
        this.rangeIndicators.forEach(indicator => {
            if (indicator.parent) {
                indicator.parent.removeChild(indicator);
            }
        });
        this.rangeIndicators = [];
    }

    /**
     * Update range indicator for hovered token
     */
    updateRangeIndicator(token) {
        // Implementation for dynamic range feedback
        // Could show red/green indicators based on validity
    }

    /**
     * Confirm target selection
     */
    confirmSelection() {
        const minTargets = this.requirements.minTargets || 1;
        
        if (this.selectedTargets.length < minTargets) {
            ui.notifications.warn(`Must select at least ${minTargets} target(s)`);
            return;
        }
        
        this.deactivate();
        
        if (this.resolvePromise) {
            this.resolvePromise([...this.selectedTargets]);
        }
    }

    /**
     * Cancel target selection
     */
    cancel() {
        this.deactivate();
        
        if (this.resolvePromise) {
            this.resolvePromise([]);
        }
    }

    /**
     * Switch to target tool to prevent token selection
     */
    switchToTargetTool() {
        // Store the current tool
        this.originalTokenTool = ui.controls.activeTool;
        
        // Switch to target tool using Foundry's built-in method
        ui.controls.initialize({ tool: "target" });
    }

    /**
     * Restore the original token tool
     */
    restoreTokenTool() {
        if (this.originalTokenTool) {
            // Restore the original tool
            ui.controls.initialize({ tool: this.originalTokenTool });
            this.originalTokenTool = null;
        }
    }
} 