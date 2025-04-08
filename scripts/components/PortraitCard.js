// Portrait Card Component

import { CONFIG } from '../utils/config.js';
import { AbilityButton } from './AbilityButton.js';

export class PortraitCard {
    constructor(gridContainer) {
        this.gridContainer = gridContainer;
        this.element = null;
        this.abilityButton = null;
        this.extraInfosContainer = null;
        this.stabilizationTimer = null;  // Add timer reference
        this.isStabilizing = false;      // Add stabilization state
        this.lastHpValue = null;  // Track HP changes
        this.useTokenImage = true;  // Default to token image
        // this.overrideBendMode = false;
        this._createCard();
        this._registerHooks();
        this.loadImagePreference();  // Load saved preference
    }

    _registerHooks() {
        // Listen for actor updates to catch damage at 0 HP
        Hooks.on('updateActor', (actor, changes, options, userId) => {
            if (!this.element || !this.lastKnownActorId) return;
            if (actor.id !== this.lastKnownActorId) return;

            // Check if this update includes HP changes
            if (changes.system?.attributes?.hp?.value !== undefined) {
                const newHp = changes.system.attributes.hp.value;
                const oldHp = this.lastHpValue ?? actor.system.attributes.hp.value;
                this.lastHpValue = newHp;

                // If already at 0 HP and took damage
                if (oldHp <= 0 && newHp < oldHp) {
                    this._handleDamageAtZeroHp(actor, options?.critical ?? false);
                }
                this.update(actor);
            }
        });
    }

    async _handleDamageAtZeroHp(actor, isCritical) {
        // Only handle for player characters
        if (actor.type !== 'character') return;

        // Calculate new failure count
        const currentFailures = actor.system.attributes.death.failure || 0;
        const newFailures = currentFailures + (isCritical ? 2 : 1);

        // Update the death save failures
        await actor.update({
            'system.attributes.death.failure': Math.min(3, newFailures)
        });

        // If this would kill the character (3 failures), you might want to show a notification
        if (newFailures >= 3) {
            ui.notifications.warn(`${actor.name} has failed their final death saving throw!`);
        }
    }

    _createCard() {
        this.element = document.createElement("div");
        this.element.classList.add("portrait-card", "visible");
        if(!game.settings.get(CONFIG.MODULE_NAME, 'hidePortraitImage')) this.element.classList.add('portrait-hidden');
        this.element.setAttribute("data-container-index", this.gridContainer.index);
        this.element.setAttribute("data-shape", game.settings.get(CONFIG.MODULE_NAME, 'shapePortraitPreferences'));
        this.element.setAttribute("data-border", game.settings.get(CONFIG.MODULE_NAME, 'borderPortraitPreferences'));
        
        if(game.settings.get(CONFIG.MODULE_NAME, 'backgroundPortraitPreferences')) this.element.style.setProperty('--img-background-color', game.settings.get(CONFIG.MODULE_NAME, 'backgroundPortraitPreferences'));
        
        // Create the ability button
        this.abilityButton = new AbilityButton(this);

        // Create extra infos
        this.extraInfosContainer = document.createElement("div");
        this.extraInfosContainer.classList.add("extra-infos-container");
        this.element.appendChild(this.extraInfosContainer);
        if(game.settings.get(CONFIG.MODULE_NAME, 'showExtraInfo')) this._createExtraInfo(this.extraInfosContainer);

        // Create death saves container first (it will be positioned absolutely)
        const deathSavesContainer = this._createDeathSavesContainer();
        this.element.appendChild(deathSavesContainer);

        const imageContainer = this._createImageContainer();
        this.element.appendChild(imageContainer);
    }

    _createDeathSavesContainer() {
        const container = document.createElement("div");
        container.classList.add("death-saves-container");

        // Create success boxes (from 3 to 1)
        const successesContainer = document.createElement("div");
        successesContainer.classList.add("death-saves-group");
        for (let i = 0; i <= 2; i++) {
            const box = document.createElement("div");
            box.classList.add("death-save-box", "success", "clickable");
            box.setAttribute('data-index', i);
            box.title = `Set ${3 - i} success${3 - i > 1 ? 'es' : ''}`;
            
            // Add click handler for success boxes
            box.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                
                const token = canvas.tokens.get(this.gridContainer.ui.manager.currentTokenId);
                if (!token?.actor || token.actor.type !== 'character') return;

                // Get all success boxes
                const successBoxes = [...successesContainer.querySelectorAll('.death-save-box.success')];
                const clickedIndex = successBoxes.indexOf(event.currentTarget);

                // Update all boxes based on clicked position
                successBoxes.forEach((box, index) => {
                    // Mark boxes from the bottom up to the clicked box, unmark the rest
                    box.classList.toggle('marked', index >= clickedIndex);
                });

                // Update the actor with the number of successes (3 - clicked index)
                await token.actor.update({
                    'system.attributes.death.success': 3 - clickedIndex
                });
            });
            
            successesContainer.appendChild(box);
        }

        // Create skull icon with click handler
        const skullContainer = document.createElement("div");
        skullContainer.classList.add("death-saves-skull");
        skullContainer.innerHTML = '<i class="fas fa-skull"></i>';
        skullContainer.title = "Left Click: Roll Death Save (Alt: Advantage, Ctrl: Disadvantage, Shift: Fast Forward)\nRight Click: Reset death saves";
        
        // Add click event for death save roll
        skullContainer.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const token = canvas.tokens.get(this.gridContainer.ui.manager.currentTokenId);
            if (!token?.actor || token.actor.type !== 'character') return;

            // Get current death save count before the roll
            const currentSuccesses = token.actor.system.attributes.death.success || 0;

            try {
                // Determine roll mode based on modifiers
                let rollMode = "roll";
                if (event.altKey) rollMode = "advantage";
                if (event.ctrlKey) rollMode = "disadvantage";
                if (event.shiftKey) rollMode = "gmroll";

                // Roll the death save with the appropriate mode
                const roll = await token.actor.rollDeathSave({
                    event: event,  // Pass the original event
                    advantage: event.altKey,
                    disadvantage: event.ctrlKey,
                    fastForward: event.shiftKey
                });
                
                // Only handle our UI updates after system processes are complete
                if (roll.total >= 10 && currentSuccesses === 2) {  // This would be the third success
                    this.isStabilizing = true;
                    
                    const container = this.element.querySelector('.death-saves-container');
                    if (container) {
                        const successBoxes = container.querySelectorAll('.death-save-box.success');
                        const failureBoxes = container.querySelectorAll('.death-save-box.failure');

                        // Force all success boxes to be marked
                        successBoxes.forEach(box => box.classList.add('marked'));
                        
                        // Keep any existing failure marks
                        const currentFailures = token.actor.system.attributes.death.failure || 0;
                        failureBoxes.forEach((box, index) => {
                            box.classList.toggle('marked', index + 1 <= currentFailures);
                        });

                        // Clear any existing timer
                        if (this.stabilizationTimer) {
                            clearTimeout(this.stabilizationTimer);
                        }

                        // Set new timer
                        this.stabilizationTimer = setTimeout(() => {
                            this.isStabilizing = false;
                            // Check current HP state when timer completes
                            if (token.actor.system.attributes.hp.value > 0) {
                                container.style.display = 'none';
                            }
                        }, 5000);
                    }
                }
            } catch (error) {
                console.error("Error during death save roll:", error);
            }
        });

        // Add right-click handler to reset death saves
        skullContainer.addEventListener('contextmenu', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const token = canvas.tokens.get(this.gridContainer.ui.manager.currentTokenId);
            if (!token?.actor || token.actor.type !== 'character') return;

            // Reset both successes and failures to 0
            await token.actor.update({
                'system.attributes.death.success': 0,
                'system.attributes.death.failure': 0
            });

            // Update the UI
            const container = this.element.querySelector('.death-saves-container');
            if (container) {
                const successBoxes = container.querySelectorAll('.death-save-box.success');
                const failureBoxes = container.querySelectorAll('.death-save-box.failure');

                // Unmark all boxes
                successBoxes.forEach(box => box.classList.remove('marked'));
                failureBoxes.forEach(box => box.classList.remove('marked'));
            }
        });

        // Add hover effect class
        skullContainer.classList.add('clickable');

        // Create failure boxes (from 1 to 3)
        const failuresContainer = document.createElement("div");
        failuresContainer.classList.add("death-saves-group");
        for (let i = 0; i <= 2; i++) {
            const box = document.createElement("div");
            box.classList.add("death-save-box", "failure", "clickable");
            box.setAttribute('data-index', i);
            box.title = `Set ${i + 1} failure${i > 0 ? 's' : ''}`;
            
            // Add click handler for failure boxes
            box.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                
                const token = canvas.tokens.get(this.gridContainer.ui.manager.currentTokenId);
                if (!token?.actor || token.actor.type !== 'character') return;

                // Get all failure boxes
                const failureBoxes = [...failuresContainer.querySelectorAll('.death-save-box.failure')];
                const clickedIndex = failureBoxes.indexOf(event.currentTarget);

                // Update all boxes based on clicked position
                failureBoxes.forEach((box, index) => {
                    // Mark boxes from the top up to the clicked box, unmark the rest
                    box.classList.toggle('marked', index <= clickedIndex);
                });

                // Update the actor with the number of failures (clicked index + 1)
                await token.actor.update({
                    'system.attributes.death.failure': clickedIndex + 1
                });
            });
            
            failuresContainer.appendChild(box);
        }

        container.appendChild(successesContainer);
        container.appendChild(skullContainer);
        container.appendChild(failuresContainer);

        return container;
    }

    _updateDeathSaves(actor) {
        // First check if this is a character and if we have a container
        if (!actor || actor.type !== 'character') {
            const container = this.element.querySelector('.death-saves-container');
            if (container) container.style.display = 'none';
            return;
        }

        const container = this.element.querySelector('.death-saves-container');
        if (!container) return;
        
        // Get current HP and death saves state
        const currentHP = actor.system.attributes?.hp?.value || 0;
        const deathSaves = actor.system.attributes.death;

        // Always show death saves UI when at 0 HP, even during stabilization
        if (currentHP <= 0) {
            container.style.display = 'flex';
        } else if (!this.isStabilizing) {
            container.style.display = 'none';
            return;
        }
        
        // If we're showing stabilization animation, only update failure marks
        if (this.isStabilizing) {
            const failureBoxes = container.querySelectorAll('.death-save-box.failure');
            failureBoxes.forEach((box, index) => {
                box.classList.toggle('marked', index < deathSaves.failure);
            });
            return;
        }

        // Check for new stabilization (3 successes)
        if (deathSaves.success >= 3 && !this.isStabilizing) {
            this.isStabilizing = true;
            
            const successBoxes = container.querySelectorAll('.death-save-box.success');
            const failureBoxes = container.querySelectorAll('.death-save-box.failure');

            // Force all success boxes to be marked
            successBoxes.forEach(box => box.classList.add('marked'));
            
            // Keep any existing failure marks
            failureBoxes.forEach((box, index) => {
                box.classList.toggle('marked', index < deathSaves.failure);
            });

            // Clear any existing timer
            if (this.stabilizationTimer) {
                clearTimeout(this.stabilizationTimer);
            }

            // Set new timer
            this.stabilizationTimer = setTimeout(() => {
                this.isStabilizing = false;
                if (actor.system.attributes.hp.value > 0) {
                    container.style.display = 'none';
                }
            }, 5000);
            return;
        }

        // Regular death save display logic
        const successBoxes = container.querySelectorAll('.death-save-box.success');
        const failureBoxes = container.querySelectorAll('.death-save-box.failure');

        // Update success boxes (3 to 1)
        successBoxes.forEach((box, index) => {
            box.classList.toggle('marked', 3 - index <= deathSaves.success);
        });

        // Update failure boxes (1 to 3)
        failureBoxes.forEach((box, index) => {
            box.classList.toggle('marked', index + 1 <= deathSaves.failure);
        });
    }

    _createImageContainer() {
        const container = document.createElement("div");
        container.classList.add("portrait-image-container");
        
        const token = canvas.tokens.get(this.gridContainer.ui.manager.currentTokenId);
        if (!token?.actor) return container;

        // Add token image
        const imageContainer = document.createElement("div");
        imageContainer.classList.add("portrait-image-subcontainer");
        imageContainer.setAttribute('data-bend-mode', game.settings.get(CONFIG.MODULE_NAME, 'overlayModePortrait'));
        const image = document.createElement("img");
        image.classList.add("portrait-image");
        image.src = token.document.texture.src;
        image.alt = token.actor.name;
        imageContainer.style.setProperty('--bend-img', `url(${image.src})`);
        
        imageContainer.appendChild(image);

        // Add health overlay
        this._createHealthOverlay(imageContainer, token.actor);
        this._createHPText(container, token.actor);

        // Add double-click event listener to open character sheet
        image.addEventListener('dblclick', (event) => {
            if(game.settings.get(CONFIG.MODULE_NAME, 'showSheetSimpleClick')) return;
            event.preventDefault();
            event.stopPropagation();
            if (token?.actor) {
                token.actor.sheet.render(true);
            }
        });

        // Add double-click event listener to open character sheet
        image.addEventListener('click', (event) => {
            if(!game.settings.get(CONFIG.MODULE_NAME, 'showSheetSimpleClick')) return;
            event.preventDefault();
            event.stopPropagation();
            if (token?.actor) {
                token.actor.sheet.render(true);
            }
        });

        container.appendChild(imageContainer);
        // Add context menu for image selection
        container.addEventListener('contextmenu', this._handleImageContextMenu.bind(this));

        return container;
    }

    _handleImageContextMenu(event) {
        event.preventDefault();
        event.stopPropagation();

        const token = canvas.tokens.get(this.gridContainer.ui.manager.currentTokenId);
        if (!token?.actor) return;

        // Remove any existing menu
        const existingMenu = document.querySelector('.menu-container');
        if (existingMenu) existingMenu.remove();

        // Create context menu
        const menu = document.createElement("div");
        menu.classList.add("menu-container", "visible");
        // Add it to the portrait container instead of document.body
        this.element.appendChild(menu);

        // Create menu items - Token option first
        const tokenOption = this._createImageMenuItem(
            '<i class="fas fa-chess-pawn"></i>',
            "Use Token Image",
            async () => {
                this._updatePortraitImage(token.document.texture.src);
                /* const portraitImg = this.element.querySelector('.portrait-image');
                if (portraitImg) {
                    portraitImg.src = token.document.texture.src;
                } */
                this.useTokenImage = true;
                await this.saveImagePreference();
                menu.remove();
            },
            this.useTokenImage
        );

        const portraitOption = this._createImageMenuItem(
            '<i class="fas fa-user"></i>',
            "Use Character Portrait",
            async () => {
                this._updatePortraitImage(token.actor.img);
                /* const portraitImg = this.element.querySelector('.portrait-image');
                if (portraitImg) {
                    portraitImg.src = token.actor.img;
                } */
                this.useTokenImage = false;
                await this.saveImagePreference();
                menu.remove();
            },
            !this.useTokenImage
        );

        /* const bendOption = this._createImageMenuItem(
            '<i class="fas fa-droplet"></i>',
            "Override Health Overlay as Mask",
            async () => {
                this.overrideBendMode = !this.overrideBendMode;
                this._updatePortraitImage(token.actor.img);
                await this.saveImagePreference();
                menu.remove();
            },
            this.overrideBendMode
        ); */

        menu.appendChild(tokenOption);
        menu.appendChild(portraitOption);
        // menu.appendChild(bendOption);

        // Position menu relative to the mouse cursor
        const containerRect = this.element.getBoundingClientRect();
        const mouseX = event.clientX - containerRect.left;
        const mouseY = event.clientY - containerRect.top;
        
        // Position menu with offset from mouse cursor
        menu.style.position = 'absolute';
        menu.style.left = `${mouseX + 20}px`;
        menu.style.top = `${mouseY - 20}px`;
        menu.style.zIndex = '1000';

        // Add click handler to close menu when clicking outside
        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== menu) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }

    _createImageMenuItem(icon, label, onClick, isActive = false) {
        const item = document.createElement("div");
        item.classList.add("menu-item");
        
        const iconEl = document.createElement("span");
        iconEl.classList.add("menu-item-icon");
        iconEl.innerHTML = icon;
        
        const labelEl = document.createElement("span");
        labelEl.classList.add("menu-item-label");
        labelEl.textContent = label;
        
        // Create checkbox like in lock controls
        const checkbox = document.createElement("div");
        checkbox.className = `menu-item-checkbox ${isActive ? 'checked' : ''}`;
        
        if (isActive) {
            const checkIcon = document.createElement('i');
            checkIcon.className = 'fas fa-check';
            checkbox.appendChild(checkIcon);
        }
        
        item.appendChild(iconEl);
        item.appendChild(labelEl);
        item.appendChild(checkbox);
        
        item.addEventListener("click", onClick);
        
        return item;
    }

    _createHealthOverlay(container, actor) {
        const healthOverlay = document.createElement("div");
        healthOverlay.classList.add("health-overlay");
        if(!game.settings.get(CONFIG.MODULE_NAME, 'showHealthOverlay')) healthOverlay.classList.add("hidden");
        
        // Create the base red damage overlay
        const damageOverlay = document.createElement("div");
        damageOverlay.classList.add("damage-overlay");
        healthOverlay.appendChild(damageOverlay);
        
        // Create the flash overlay for damage animations
        const damageFlash = document.createElement("div");
        damageFlash.classList.add("damage-flash");
        healthOverlay.appendChild(damageFlash);
        
        // Create the flash overlay for healing animations
        const healingFlash = document.createElement("div");
        healingFlash.classList.add("healing-flash");
        healthOverlay.appendChild(healingFlash);
        
        // Set initial health state
        const hpValue = actor.system.attributes?.hp?.value || 0;
        const hpMax = actor.system.attributes?.hp?.max || 1;
        const hpPercent = Math.max(0, Math.min(100, (hpValue / hpMax) * 100));
        const damagePercent = 100 - hpPercent;
        
        // Only show the red overlay on the damaged portion (from top down)
        if (damagePercent > 0) {
            damageOverlay.style.height = `${damagePercent}%`;
            damageOverlay.style.opacity = '1';
        } else {
            damageOverlay.style.height = '0';
            damageOverlay.style.opacity = '0';
        }
        
        container.appendChild(healthOverlay);
    }

    _createHPText(container, actor) {
        // Remove any existing HP text
        const oldHpText = this.element?.querySelector('.hp-text');
        if (oldHpText) oldHpText.remove();

        const hpText = document.createElement("div");
        hpText.classList.add("hp-text");
        if(!game.settings.get(CONFIG.MODULE_NAME, 'showHPText')) hpText.classList.add("hidden");
        
        // Add temp HP if it exists
        const tempHp = actor.system.attributes?.hp?.temp || 0;
        if (tempHp > 0) {
            const tempHpSpan = document.createElement("div");
            tempHpSpan.classList.add("temp-hp-text");
            tempHpSpan.textContent = `+${tempHp}`;
            hpText.appendChild(tempHpSpan);
        }
        
        // Add current/max HP
        const hpValue = actor.system.attributes?.hp?.value || 0;
        const hpMax = actor.system.attributes?.hp?.max || 0;
        const regularHpSpan = document.createElement("div");
        regularHpSpan.textContent = `${hpValue}/${hpMax}`;
        hpText.appendChild(regularHpSpan);
        
        container.appendChild(hpText);
    }

    _createExtraInfo = function(container) {
        const token = canvas.tokens.get(this.gridContainer.ui.manager.currentTokenId);
        if (!token?.actor) return;
        
        // Remove previous infos
        const extraInfos = this.element.getElementsByClassName('extra-info');
        while(extraInfos.length > 0) {
            extraInfos[0].parentNode.removeChild(extraInfos[0]);
        }

        const savedData = game.settings.get(CONFIG.MODULE_NAME, "dataExtraInfo");
        for(let i = 0; i < savedData.length; i++) {
            if(!savedData[i].attr || savedData[i].attr == '') continue;
            const attr = foundry.utils.getProperty(token.actor.system, savedData[i].attr) ?? foundry.utils.getProperty(token.actor.system, savedData[i].attr + ".value") ?? this._getInfoFromSettings(savedData[i].attr);
            if(!attr) continue;
            const extra = document.createElement("div");
            extra.classList.add("extra-info", `extra-info-${i}`, ...savedData[i].icon.split(' '));
            extra.style.setProperty('--icon-color', savedData[i].color);
            const extraText = document.createElement("span");
            extraText.innerText = attr;
            extra.appendChild(extraText);
            container.appendChild(extra);
        }

        return container;
    }

    _getInfoFromSettings(stringInfo) {
        try {
            const [module, data] = stringInfo.split('.');
            return game.settings.get(module, data);            
        } catch (error) {
            return null;
        }
    }

    async _updatePortraitImage(img) {
        const portraitImg = this.element.querySelector('.portrait-image'),
            imageContainer = this.element.querySelector('.portrait-image-subcontainer');
        if (portraitImg) {
            portraitImg.src = img;
            if (imageContainer) {
                imageContainer.style.setProperty('--bend-img', `url(${portraitImg.src})`);
                // imageContainer.setAttribute('data-bend-mode', (game.settings.get(CONFIG.MODULE_NAME, 'overlayModePortrait') && !this.overrideBendMode) || (!game.settings.get(CONFIG.MODULE_NAME, 'overlayModePortrait') && this.overrideBendMode));
            }
        }
    }

    toggle() {
        this.element.classList.toggle('visible', this.isVisible);
    }

    show() {
        this.element.classList.add('visible');
    }

    hide() {
        this.element.classList.remove('visible');
    }

    toggleAbilityCard() {
        if (this.abilityButton) {
            this.abilityButton._toggleAbilityCard();
        }
    }

    render() {
        // Re-render the card with current token data
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
        }
        this._createImageContainer();
    }

    /**
     * Update the portrait card with new actor data
     * @param {Actor} actor - The actor to update with
     */
    update(actor) {
        if (!actor) return;
        
        // Store the actor ID for locked state persistence
        this.lastKnownActorId = actor.id;
        this.lastHpValue = actor.system.attributes?.hp?.value;

        // Update portrait image based on preference
        const portraitImg = this.element.querySelector('.portrait-image');
        if (portraitImg) {
            const token = canvas.tokens.get(this.gridContainer.ui.manager.currentTokenId);
            if (token?.actor) {
                this._updatePortraitImage(this.useTokenImage ? token.document.texture.src : token.actor.img);
                // portraitImg.src = this.useTokenImage ? token.document.texture.src : token.actor.img;
            }
        }

        const token = canvas.tokens.get(this.gridContainer.ui.manager.currentTokenId);
        if (!token?.actor) return;

        const container = this.element.querySelector('.portrait-image-container');
        if (!container) return;

        // Update HP text
        this._createHPText(container, token.actor);

        // Update Extra Infos
        if(game.settings.get(CONFIG.MODULE_NAME, 'showExtraInfo')) {
          this._createExtraInfo(this.extraInfosContainer);
        } else if(document.getElementsByClassName('extra-info').length) {
          const extraInfo = document.getElementsByClassName('extra-info');
          while(extraInfo.length > 0) {
            extraInfo[0].parentNode.removeChild(extraInfo[0]);
          }
        }

        // Update death saves
        this._updateDeathSaves(token.actor);

        // Update health overlay
        const damageOverlay = this.element.querySelector('.damage-overlay');
        if (damageOverlay) {
            const hpValue = token.actor.system.attributes?.hp?.value || 0;
            const hpMax = token.actor.system.attributes?.hp?.max || 1;
            const hpPercent = Math.max(0, Math.min(100, (hpValue / hpMax) * 100));
            const damagePercent = 100 - hpPercent;

            if (damagePercent > 0) {
                damageOverlay.style.height = `${damagePercent}%`;
                damageOverlay.style.opacity = '1';
            } else {
                damageOverlay.style.height = '0';
                damageOverlay.style.opacity = '0';
            }
        }
    }

    /**
     * Clean up resources and remove the element from the DOM.
     */
    destroy() {
        if (this.stabilizationTimer) {
            clearTimeout(this.stabilizationTimer);
            this.stabilizationTimer = null;
        }
        if (this.abilityButton) {
            this.abilityButton.destroy();
            this.abilityButton = null;
        }
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.gridContainer = null;
    }

    // Add method to load saved preference
    async loadImagePreference() {
        const token = canvas.tokens.get(this.gridContainer.ui.manager.currentTokenId);
        if (!token?.actor) return;

        // First check for actor-specific saved preference
        const saved = await token.actor.getFlag(CONFIG.MODULE_NAME, "useTokenImage");
            // savedBend = await token.actor.getFlag(CONFIG.MODULE_NAME, "overrideBendMode");
        
        if (saved !== undefined) {
            this.useTokenImage = saved;
            // this.overrideBendMode = savedBend;
        } else {
            // If no actor-specific preference, use the default setting
            const defaultPref = game.settings.get(CONFIG.MODULE_NAME, 'defaultPortraitPreferences');
            this.useTokenImage = defaultPref === 'token';
            // const defaultPrefBend = game.settings.get(CONFIG.MODULE_NAME, 'overlayModePortrait');
            // this.useTokenImage = defaultPrefBend;
        }
        
        // Update the image immediately if we have one
        this._updatePortraitImage(this.useTokenImage ? token.document.texture.src : token.actor.img);
        /* const portraitImg = this.element.querySelector('.portrait-image');
        if (portraitImg) {
            portraitImg.src = this.useTokenImage ? token.document.texture.src : token.actor.img;
        } */
    }

    // Add method to save preference
    async saveImagePreference() {
        const token = canvas.tokens.get(this.gridContainer.ui.manager.currentTokenId);
        if (!token?.actor) return;
        await token.actor.setFlag(CONFIG.MODULE_NAME, "useTokenImage", this.useTokenImage);
        // await token.actor.setFlag(CONFIG.MODULE_NAME, "overrideBendMode", this.overrideBendMode);
    }
} 