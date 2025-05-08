import { BG3CONFIG } from "../../utils/config.js";
import { BG3Component } from "../component.js";
import { GridContainer } from "./GridContainer.js";

export class WeaponContainer extends BG3Component {
    constructor(data) {
        super(data);
        this.components = {
            combat: [],
            weapon: []
        }
    }

    get classes() {
        return ["bg3-weapon-container"]
    }

    get activeSet() {
        return this.actor.getFlag(BG3CONFIG.MODULE_NAME, 'activeSet') ?? 0;
    }

    set activeSet(index) {
        this.actor.setFlag(BG3CONFIG.MODULE_NAME, 'activeSet', index);
        this.element.setAttribute('data-active-set', index);
        for(let i = 0; i < this.components.weapon.length; i++) {
            const container = this.components.weapon[i].element;
            if(i === index) container.removeAttribute('data-tooltip');
            else {
                container.dataset.tooltip = `Click: Switch to weapon set #${i+1}`;
                container.dataset.tooltipDirection = i === index + 1 || (index === this.components.weapon.length - 1 && i === 0) ? 'UP' : 'DOWN';
            };
        }
    }

    async switchSet(c) {
        if(c.index === this.activeSet && c.oldWeapons === c.data.items) return;

        if(game.settings.get(BG3CONFIG.MODULE_NAME, 'enableWeaponAutoEquip')) {
            const weaponsList = this.actor.items.filter(w => w.type == 'weapon'),
                compareOld = c.index === this.activeSet ? c.oldWeapons : this.components.weapon[this.activeSet].data.items;
            let toUpdate = [];
            weaponsList.forEach(w => {
                if(w.system.equipped && !Object.values(c.data.items).find(wc => wc?.uuid && w.id === wc.uuid.split('.').pop())) {
                    toUpdate.push({_id: w.id, "system.equipped": 0});
                } else if(!w.system.equipped && Object.values(c.data.items).find(wc => wc?.uuid && w.id === wc.uuid.split('.').pop())) {
                    toUpdate.push({_id: w.id, "system.equipped": 1});
                }
            });
            Object.values(c.data.items).forEach(nw => {
                if(!nw?.uuid) return;
                const itemId = nw.uuid.split('.').pop(),
                    item = this.actor.items.get(itemId);
                if(item && item.type !== 'weapon' && !item.system.equipped) toUpdate.push({_id: itemId, "system.equipped": 1});
            });
            if(compareOld) {
                Object.values(compareOld).forEach(ow => {
                    if(!ow?.uuid) return;
                    const itemId = ow.uuid.split('.').pop(),
                        item = this.actor.items.get(itemId);
                    if(item && item.type !== 'weapon' && item.system.equipped && !Object.values(c.data.items).find(w => w.uuid === ow.uuid)) toUpdate.push({_id: itemId, "system.equipped": 0});
                });
            }
            
            // Update active set & equipped items
            c.oldWeapons = foundry.utils.deepClone(c.data.items);
            if(toUpdate.length) {
                for(const update of toUpdate) {
                    const item = this.actor.items.get(update._id);
                    if(item) item.updateSource({"system.equipped": update["system.equipped"]})
                }
            }
        }
        this.activeSet = c.index;
    }

    async render() {
        await super.render();
        this.components.weapon.forEach(c => {
            c.element.addEventListener('click', async (e) => this.switchSet(c));
        });
        this.switchSet(this.components.weapon[this.activeSet]);
        return this.element;
    }

    async _renderInner() {
        await super._renderInner();
        this.components = {
            combat: [],
            weapon: []
        };
        // Weapons Containers
        this.components.weapon = this.data.weapon.map((gridData, i) => {
            const container = new GridContainer(gridData);
            container.index = i;
            container.id = 'weapon';
            container.element.setAttribute('data-container-index', i);
            container._parent = this;

            return container;
        });
        for(const cell of this.components.weapon) this.element.appendChild(cell.element);
        await Promise.all(this.components.weapon.map((cell) => cell.render()));

        // Combat Container
        const combatContainer = new GridContainer(this.data.combat[0]);
        combatContainer.locked = game.settings.get(BG3CONFIG.MODULE_NAME, 'lockCombatContainer');
        combatContainer.id = 'combat';
        this.components.combat.push(combatContainer);
        this.element.appendChild(combatContainer.element);
        await combatContainer.render();
        combatContainer.element.classList.toggle('hidden', !game.settings.get(BG3CONFIG.MODULE_NAME, 'showCombatContainer'));
    }
}