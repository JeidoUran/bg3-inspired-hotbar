// Hotbar Manager Component

import { BG3CONFIG } from '../utils/config.js';

export class HotbarManager {
    constructor() {

        this.containers = {};
        this.currentTokenId = null;

        this.globalMenu = null;
        
        this._initializeContainers();
    }

    get token() {
        return canvas?.tokens?.get(this.currentTokenId) ?? null;
    }

    get actor() {
        return this.token?.actor ?? null;
    }

    _initializeContainers() {
        Object.entries(BG3CONFIG.CONTAINERSDATA).forEach(([index, data]) => {
            this.containers[index] = [];
            for(let i = 0; i < data.count; i++) {
                this.containers[index].push({...foundry.utils.deepClone(data.config), ...{id: `${index}-container`, index: i}});
            }
        })
    }

    convertOldFormat(savedData) {
        return [foundry.utils.deepClone(savedData.containers), foundry.utils.deepClone(savedData.weaponsContainers), foundry.utils.deepClone(savedData.combatContainer)];
    }
    
    // Clean up specific token data
    async cleanupTokenData(tokenId) {
        const token = canvas.tokens.get(tokenId);
        if (!token) return;

        // For unlinked tokens, also remove the flag data
        if (token.actor && !token.actorLink) {
            await token.actor.unsetFlag(BG3CONFIG.MODULE_NAME, BG3CONFIG.CONTAINERS_NAME);
        }
    }

    async _loadTokenData() {
        if(!this.token || !this.actor) return;
        const containersData = this.actor.getFlag(BG3CONFIG.MODULE_NAME, BG3CONFIG.CONTAINERS_NAME),
            savedData = this.actor.getFlag(BG3CONFIG.MODULE_NAME, BG3CONFIG.FLAG_NAME);
        
        if(containersData) {
            this.containers = foundry.utils.deepClone(containersData);
            // Update Chris Premade Common Actions Section if needed
            if(this.containers.combat?.[0]?.items && game.modules.get("chris-premades")?.active) {
                for(const key in this.containers.combat[0].items) {
                    const item = this.actor.items.find(i => i.name === this.containers.combat[0].items[key].name);
                    if(item && item.getFlag('chris-premades', 'info')?.source === 'chris-premades' && item.getFlag('tidy5e-sheet', 'section') !== 'CHRISPREMADES.Generic.Actions') item.setFlag('tidy5e-sheet', 'section', 'CHRISPREMADES.Generic.Actions')
                }
            }
        } else if(savedData) {
            let hotbarContainersData, weaponsContainersData, combatContainerData;
            if (Array.isArray(savedData)) {
                // Old format: direct array of containers
                hotbarContainersData = foundry.utils.deepClone(savedData);
                this.portraitVisible = true; // Default for old format
                // Using old data format, portrait defaulted to hidden
            } else {
                // New format: object with containers and portraitVisible
                /* containersData = foundry.utils.deepClone(savedData.containers);
                weaponsContainersData = foundry.utils.deepClone(savedData.weaponsContainers);
                combatContainerData = foundry.utils.deepClone(savedData.combatContainer); */
                // console.log(this.convertAllFormat(savedData));
                const [hotbarData, weaponData, combatData] = this.convertOldFormat(savedData);
                if(Array.isArray(hotbarData)) {
                    hotbarData.forEach(c => {
                        this.containers.hotbar[c.index].cols = c.cols;
                        this.containers.hotbar[c.index].rows = c.rows;
                        this.containers.hotbar[c.index].items = c.items;
                    });
                }
                if(Array.isArray(weaponData)) {
                    weaponData.forEach(c => {
                        this.containers.weapon[c.index].cols = c.cols;
                        this.containers.weapon[c.index].rows = c.rows;
                        this.containers.weapon[c.index].items = c.items;
                    });
                }
                if(Array.isArray(combatData)) {
                    combatData.forEach(c => {
                        this.containers.combat[c.index].cols = c.cols;
                        this.containers.combat[c.index].rows = c.rows;
                        this.containers.combat[c.index].items = c.items;
                    });
                }
            }
        } else {
            // No saved data so we create blank ones
            this._initializeContainers();
        }
    }

    async socketUpdateData(actor, changes) {
        if(this.currentTokenId) {
            // Check if this update affects our current token to force UI update
            const token = canvas.tokens.get(this.currentTokenId);
            if (!!token && this.actor?.id === actor.id && !!ui.BG3HOTBAR.element?.[0]) {
                await ui.BG3HOTBAR.generate(token);
            }
        }
    }

    async persist() {
        this.actor.setFlag(BG3CONFIG.MODULE_NAME, BG3CONFIG.CONTAINERS_NAME, this.containers)
    }
} 