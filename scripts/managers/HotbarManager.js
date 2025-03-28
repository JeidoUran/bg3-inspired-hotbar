// Hotbar Manager Component

import { CONFIG } from '../utils/config.js';
import { HotbarUI } from '../components/HotbarUI.js';
import { fromUuid } from '../utils/foundryUtils.js';
import { ItemUpdateManager } from './ItemUpdateManager.js';

export class HotbarManager {
    constructor() {
        this.ui = null;
        this.currentTokenId = null;
        this.containers = [];
        this.weaponsContainers = [];
        this.combatContainer = [];
        this.tokenConfigs = new Map(); // Store configurations per token
        this.portraitVisible = true;
        this.itemManager = new ItemUpdateManager(this);
        this.activeSet = 0;
        this.combatActionsArray = [];
        this._initializeContainers();
    }

    _initializeContainers() {
        // Create 3 containers with identical row counts
        this.containers = [];
        for (let i = 0; i < 3; i++) {
            this.containers.push({
                index: i,
                cols: CONFIG.INITIAL_COLS,
                rows: CONFIG.ROWS,
                items: {}
            });
        }
        
        this.weaponsContainers = [];
        // Create 3 weapons containers
        for(let i = 0; i < 3; i++) {
            this.weaponsContainers.push({
                id: 'weapon-container',
                index: i,
                cols: 2,
                rows: 1,
                items: {},
                type: 'label',
                for: 'weapon-set',
                size: 1.5,
                delOnly: true,
                allowDuplicate: true
            });
        }

        // Create 1 combat container
        this.combatContainer = [{
            id: 'combat-container',
            index: 0,
            cols: 2,
            rows: 3,
            items: {},
            size: 1.5,
            locked: !!game.settings.get(CONFIG.MODULE_NAME, 'lockCombatContainer')
        }];

    }

    async updateHotbarForControlledToken(forceUpdate = false) {
        // Get currently controlled token
        const controlled = canvas.tokens.controlled[0];
        
        // Case 1: No token or multiple tokens selected
        if (!controlled || canvas.tokens.controlled.length > 1) {
            // If multiple tokens are selected, always hide the hotbar
            if (canvas.tokens.controlled.length > 1) {
                if (this.ui) {
                    this.ui.destroy();
                    this.ui = null;
                    this.currentTokenId = null;
                }
                return;
            }
            // For no tokens selected, just return as cleanup is handled in controlToken hook
            return;
        }

        // Case 2: Same token selected - only proceed if forcing update
        if (this.currentTokenId === controlled.id && !forceUpdate) {
            return;
        }

        // Case 3: New token selected or force update - create new UI
        
        // Save current config if we have one
        if (this.currentTokenId && !forceUpdate) {
            const containersToCache = this.containers.map(container => ({
                index: container.index,
                cols: container.cols,
                rows: container.rows,
                items: foundry.utils.deepClone(container.items)
            }));

            const weaponsContainersToCache = this.weaponsContainers.map(container => ({
                id: container.id,
                index: container.index,
                cols: container.cols,
                rows: container.rows,
                items: foundry.utils.deepClone(container.items),
                type: container.type,
                for: container.for,
                size: container.size,
                delOnly: container.delOnly,
                allowDuplicate: container.allowDuplicate
            }));

            const combatContainersToCache = [{
                id: this.combatContainer[0].id,
                index: this.combatContainer[0].index,
                cols: this.combatContainer[0].cols,
                rows: this.combatContainer[0].rows,
                items: foundry.utils.deepClone(this.combatContainer[0].items),
                size: this.combatContainer[0].size
            }];
            
            this.tokenConfigs.set(this.currentTokenId, {
                containers: containersToCache,
                weaponsContainers: weaponsContainersToCache,
                combatContainer: combatContainersToCache,
                portraitVisible: this.portraitVisible,
                activeSet: this.activeSet
            });
        }

        // Always destroy old UI for new token or force update
        if (this.ui) {
            this.ui.destroy();
            this.ui = null;
        }

        // Update current token and load its config
        this.currentTokenId = controlled.id;
        
        if (this.tokenConfigs.has(this.currentTokenId) && !forceUpdate) {
            const config = this.tokenConfigs.get(this.currentTokenId);
            this.containers = config.containers.map(container => ({
                index: container.index,
                cols: container.cols,
                rows: container.rows,
                items: foundry.utils.deepClone(container.items)
            }));
            this.weaponsContainers = config.weaponsContainers.map(container => ({
                id: container.id,
                index: container.index,
                cols: container.cols,
                rows: container.rows,
                items: foundry.utils.deepClone(container.items),
                type: container.type,
                for: container.for,
                size: container.size,
                delOnly: container.delOnly,
                allowDuplicate: container.allowDuplicate
            }));
            this.combatContainer = [{
                id: config.combatContainer[0].id,
                index: config.combatContainer[0].index,
                cols: config.combatContainer[0].cols,
                rows: config.combatContainer[0].rows,
                items: foundry.utils.deepClone(config.combatContainer[0].items),
                size: config.combatContainer[0].size,
                locked: !!game.settings.get(CONFIG.MODULE_NAME, 'lockCombatContainer')
            }];
            this.portraitVisible = config.portraitVisible;
            this.activeSet = config.activeSet;
        } else {
            await this._loadTokenData();
        }

        // Create new UI
        this.ui = new HotbarUI(this);
        console.log(`${CONFIG.MODULE_NAME} | Created UI for token: ${controlled.name}`);
    }

    async _loadTokenData() {
        const token = canvas.tokens.get(this.currentTokenId);
        if (!token?.actor) return;

        const savedData = token.actor.getFlag(CONFIG.MODULE_NAME, CONFIG.FLAG_NAME);
        // Loading hotbar data

        if (savedData) {
            // Handle both old and new data formats
            let containersData, weaponsContainersData, combatContainerData;
            if (Array.isArray(savedData)) {
                // Old format: direct array of containers
                containersData = foundry.utils.deepClone(savedData);
                this.portraitVisible = true; // Default for old format
                // Using old data format, portrait defaulted to hidden
            } else {
                // New format: object with containers and portraitVisible
                containersData = foundry.utils.deepClone(savedData.containers);
                weaponsContainersData = foundry.utils.deepClone(savedData.weaponsContainers);
                combatContainerData = foundry.utils.deepClone(savedData.combatContainer);
                if(!weaponsContainersData) {
                  weaponsContainersData = []
                  for(let i=0;i<3;i++) {
                    weaponsContainersData.push({
                        id: 'weapon-container',
                        index: this.weaponsContainers.length,
                        cols: 2,
                        rows: 1,
                        items: {},
                        type: 'label',
                        for: 'weapon-set',
                        size: 1.5,
                        delOnly: true,
                        allowDuplicate: true
                    });
                  }
                }
                if(!combatContainerData) {
                    combatContainerData = [{
                        id: 'combat-container',
                        index: 0,
                        cols: 2,
                        rows: 3,
                        items: {},
                        size: 1.5,
                        locked: !!game.settings.get(CONFIG.MODULE_NAME, 'lockCombatContainer')
                    }];
                }
                this.activeSet = savedData.activeSet ?? 0;
                this.portraitVisible = savedData.portraitVisible ?? true;
                // Using new data format
            }
     
            const maxRows = Math.max(...containersData.map(container => container.rows || CONFIG.ROWS));
            
            // Initialize containers with consistent row count
            this.containers = containersData.map((container, index) => ({
                index: index,
                cols: container.cols || CONFIG.INITIAL_COLS,
                rows: maxRows, // Use the maximum row count for all containers
                items: foundry.utils.deepClone(container.items || {})
            }));
              
            this.weaponsContainers = weaponsContainersData.map((container, index) => ({
                id: container.id,
                index: index,
                cols: container.cols,
                rows: container.rows,
                items: foundry.utils.deepClone(container.items || {}),
                type: container.type,
                for: container.for,
                size: container.size,
                delOnly: container.delOnly,
                allowDuplicate: container.allowDuplicate
            }));

            this.combatContainer = [{
                id: combatContainerData[0].id,
                index: combatContainerData[0].index,
                cols: combatContainerData[0].cols,
                rows: combatContainerData[0].rows,
                items: foundry.utils.deepClone(combatContainerData[0].items || {}),
                size: combatContainerData[0].size,
                locked: !!game.settings.get(CONFIG.MODULE_NAME, 'lockCombatContainer')
            }];

            // Final state after loading

            // Ensure we have exactly 3 containers
            while (this.containers.length < 3) {
                this.containers.push({
                    index: this.containers.length,
                    cols: CONFIG.INITIAL_COLS,
                    rows: maxRows, // Use same row count
                    items: {}
                });
            }
            while (this.weaponsContainers.length < 3) {
                this.weaponsContainers.push({
                    id: 'weapon-container',
                    index: this.weaponsContainers.length,
                    cols: 2,
                    rows: 1,
                    items: {},
                    type: 'label',
                    for: 'weapon-set',
                    size: 1.5,
                    delOnly: true,
                    allowDuplicate: true
                });
            }
        } else {
            // No saved hotbar data found, initializing default state with portrait hidden
            this.portraitVisible = true;
            this.activeSet = 0;
            this._initializeContainers();
        }

        // Store in memory cache with deep clones
        const cacheData = {
            containers: this.containers.map(container => ({
                index: container.index,
                cols: container.cols,
                rows: container.rows,
                items: foundry.utils.deepClone(container.items)
            })),
            weaponsContainers: this.weaponsContainers.map(container => ({
              id: container.id,
              index: container.index,
              cols: container.cols,
              rows: container.rows,
              items: foundry.utils.deepClone(container.items),
              type: container.type,
              for: container.for,
              size: container.size,
              delOnly: container.delOnly,
              allowDuplicate: container.allowDuplicate
            })),
            combatContainer: [{
                id: this.combatContainer[0].id,
                index: this.combatContainer[0].index,
                cols: this.combatContainer[0].cols,
                rows: this.combatContainer[0].rows,
                items: foundry.utils.deepClone(this.combatContainer[0].items),
                size: this.combatContainer[0].size
            }],
            activeSet: this.activeSet,
            portraitVisible: this.portraitVisible
        };
        this.tokenConfigs.set(this.currentTokenId, cacheData);
        // Stored in memory cache
    }

    async persist() {
        const token = canvas.tokens.get(this.currentTokenId);
        if (!token?.actor) return;

        // Ensure all containers have the same number of rows before saving
        const maxRows = Math.max(...this.containers.map(container => container.rows));
        this.containers.forEach(container => container.rows = maxRows);

        // Create deep copies of the containers for saving
        const containersToSave = this.containers.map(container => ({
            index: container.index,
            cols: container.cols,
            rows: container.rows,
            items: foundry.utils.deepClone(container.items)  // Use Foundry's deep clone utility
        }));
        
        // Create deep copies of the weapons containers for saving
        const weaponsToSave = this.weaponsContainers.map(container => ({
            id: 'weapon-container',
            index: container.index,
            cols: container.cols,
            rows: container.rows,
            items: foundry.utils.deepClone(container.items),  // Use Foundry's deep clone utility
            type: 'label',
            for: 'weapon-set',
            size: 1.5,
            delOnly: true,
            allowDuplicate: true
        }));

        const combatToSave = [{
            id: this.combatContainer[0].id,
            index: this.combatContainer[0].index,
            cols: this.combatContainer[0].cols,
            rows: this.combatContainer[0].rows,
            items: foundry.utils.deepClone(this.combatContainer[0].items),
            size: this.combatContainer[0].size
        }];

        // Create the data object including portrait visibility
        const dataToSave = {
            containers: containersToSave,
            weaponsContainers: weaponsToSave,
            combatContainer: combatToSave,
            activeSet: this.activeSet,
            portraitVisible: this.portraitVisible
        };

        // Update the in-memory cache with the current state
        this.tokenConfigs.set(this.currentTokenId, foundry.utils.deepClone(dataToSave));

        // Determine the correct actor to save to
        const targetActor = token.actorLink ? token.actor.prototypeToken.actorLink ? game.actors.get(token.actor.id) : token.actor : token.actor;

        // Saving hotbar data

        // Save to actor flags
        await targetActor.setFlag(CONFIG.MODULE_NAME, CONFIG.FLAG_NAME, dataToSave);
        console.log(targetActor.getFlag(CONFIG.MODULE_NAME, CONFIG.FLAG_NAME).combatContainer[0].items)
    }

    async cleanupInvalidItems(actor) {
        return this.itemManager.cleanupInvalidItems(actor);
    }

    // Clean up specific token data
    async cleanupTokenData(tokenId) {
        const token = canvas.tokens.get(tokenId);
        if (!token) return;

        // Remove from memory cache
        this.tokenConfigs.delete(tokenId);

        // For unlinked tokens, also remove the flag data
        if (token.actor && !token.actorLink) {
            await token.actor.unsetFlag(CONFIG.MODULE_NAME, CONFIG.FLAG_NAME);
        }
    }

    // Clean up all data
    async cleanupAllData() {
        this.tokenConfigs.clear();
        if (this.ui) {
            this.ui.destroy();
            this.ui = null;
        }
        this.currentTokenId = null;
        this._initializeContainers();

        // Only clean up flags for unlinked token actors
        for (const token of canvas.tokens.placeables) {
            if (token.actor && !token.actorLink) {
                await token.actor.unsetFlag(CONFIG.MODULE_NAME, CONFIG.FLAG_NAME);
            }
        }
    }

    checkSpellPoint() {
        if (game.modules.get("dnd5e-spellpoints")?.active) {
            const token = canvas.tokens.get(this.currentTokenId);
            if(token && token.actor.items.find(i => i.system.identifier == "spell-points")) return true;
        }
        return false;
    }
    
    async socketUpdateData(actor, changes) {
        // Check if we have saved data for this token
        if(this.currentTokenId && this.tokenConfigs.has(this.currentTokenId)) {
            // Check if this update affects our current token to force UI update
            const token = canvas.tokens.get(this.currentTokenId);
            if (!!token && token.actor?.id === actor.id && !!this.ui) {
                await this.updateHotbarForControlledToken(true);
            }
        }
    }
} 