import { BG3Component } from "../component.js";
import { MenuContainer } from "./MenuContainer.js";

export class AbilityContainer extends BG3Component {
    constructor(data) {
        super(data);
    }

    get classes() {
        return ["ability-button"]
    }

    async _registerEvents() {    
        this.element.addEventListener('click', (event) => MenuContainer.toggle(this.getMenuData(), this, event));
        this.element.querySelector('.fa-dice-d20').addEventListener('contextmenu', async (event) => {
            this.actor.rollInitiativeDialog({ rerollInitiative: true, createCombatants: true, event });
        });
    }

    get abilities() {
        return CONFIG.DND5E.abilities;
    }

    get skills() {
        return CONFIG.DND5E.skills;
    }

    getAbilityMod(key) {
        const abilityScore = this.actor.system.abilities?.[key] || { value: 10, proficient: false },
            mod = abilityScore.mod ?? 0,
            modString = mod >= 0 ? `+${mod}` : mod.toString();
        return {value: modString, style: abilityScore.proficient === 1 ?  'color: #3498db' : ''  };
    }

    getSaveMod(key) {
        const abilityScore = this.actor.system.abilities?.[key] || { value: 10, proficient: false, save: {value: 0} },
            mod = abilityScore.save?.value ?? abilityScore.save ?? 0,
            modString = mod >= 0 ? `+${mod}` : mod.toString();
        return {value: modString, style: abilityScore.proficient === 1 ?  'color: #3498db' : ''  };
    }
    
    skillRoll(event) {
        event.stopPropagation();
        const parent = event.target.closest('[data-key]');
        try {
            const rollData = {
                event: event,
                advantage: event.altKey,
                disadvantage: event.ctrlKey,
                fastForward: event.shiftKey
            };
            if(ui.BG3HOTBAR.isDnDPrev4()) {
                this.actor.rollSkill(parent.dataset.key, rollData);
            } else {
                this.actor.rollSkill({
                    skill: parent.dataset.key,
                    ...rollData
                });
            }
        } catch (error) {
            ui.notifications.error(`Error rolling ${parent.dataset.key.toUpperCase()} save. See console for details.`);
        }
    };

    getSkillMod(key) {
        const skills = {};
        let count = 0;
        Object.entries(this.skills).forEach(([k, v]) => {
            if(v.ability !== key) return;
            count++;
            const skill = this.actor.system.skills?.[k] || { proficient: false },
                mod = skill.total ?? 0,
                modStr = mod >= 0 ? `+${mod}` : mod.toString();
            skills[k] = {label:  v.label, icon: 'fas fa-dice-d20', value: modStr, style: skill.proficient === 1 ?  'color: #3498db' : '', click: this.skillRoll.bind(this)}
        });
        return count > 0 ? skills : null;
    };

    getMenuData() {
        const saveRoll = (event) => {
            event.stopPropagation();
            const parent = event.target.closest('.ability-container');
            try {
                const rollData = {
                    event: event,
                    advantage: event.altKey,
                    disadvantage: event.ctrlKey,
                    fastForward: event.shiftKey
                };
                if(ui.BG3HOTBAR.isDnDPrev4()) {
                    this.actor.rollAbilitySave(
                        parent.dataset.key, rollData
                    )
                } else {
                    this.actor.rollSavingThrow({
                        ability: parent.dataset.key,
                        ...rollData
                    });
                };
                // this.element.querySelectorAll('.bg3-menu-container').forEach(e => e.classList.add('hidden'));
            } catch (error) {
                ui.notifications.error(`Error rolling ${parent.dataset.key.toUpperCase()} save. See console for details.`);
            }
        };

        const checkRoll = (event) => {
            event.stopPropagation();
            const parent = event.target.closest('.ability-container');
            try {
                const rollData = {
                    event: event,
                    advantage: event.altKey,
                    disadvantage: event.ctrlKey,
                    fastForward: event.shiftKey
                };
                if(ui.BG3HOTBAR.isDnDPrev4()) {
                    this.actor.rollAbilityTest(
                        parent.dataset.key, rollData
                    )
                } else {
                    this.actor.rollAbilityCheck({
                        ability: parent.dataset.key,
                        ...rollData
                    });
                };
                // this.element.querySelectorAll('.bg3-menu-container').forEach(e => e.classList.add('hidden'));
            } catch (error) {
                ui.notifications.error(`Error rolling ${parent.dataset.key.toUpperCase()} save. See console for details.`);
            }
        };

        const tooltip = "BG3.Hotbar.Ability.Tooltip";

        return {
            position: 'top',
            event: 'click',
            name: 'baseMenu',
            keepOpen: true,
            closeParent: true,
            buttons: (() => {
                const btns = {};
                for(const abl in this.abilities) {
                    const abilityMod = this.getAbilityMod(abl);
                    btns[abl] = {
                        ...{
                            label: this.abilities[abl].label,
                            class: 'ability-container'
                        },
                        ...abilityMod,
                        subMenu: [
                            {
                                position: 'topright', name: 'saveMenu', event: 'click', 
                                buttons: {
                                    [`check${abl.toUpperCase()}`]: {...{label: 'Check', icon: 'fas fa-dice-d20', click: checkRoll}, ...abilityMod},
                                    [`save${abl.toUpperCase()}`]: {...{label: 'Save', icon: 'fas fa-dice-d20', click: saveRoll}, ...this.getSaveMod(abl)}
                                }
                            },
                            {
                                position: 'topleft', name: 'skillMenu', event: 'click',
                                buttons: this.getSkillMod(abl)
                            }
                        ]
                    }
                };
                return btns;
            })()
        };
    };
}