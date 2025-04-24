import { BG3Component } from "../component.js";
import { AbilityContainer } from "./AbilityContainer.js";
import { DeathSavesContainer } from "./DeathSavesContainer.js";
import { MenuContainer } from "./MenuContainer.js";
import { BG3CONFIG } from "../../utils/config.js";

export class PortraitContainer extends BG3Component {
    constructor(data) {
        super(data);
        this.components = {};
        this.useTokenImage = this.actor.getFlag(BG3CONFIG.MODULE_NAME, "useTokenImage") ?? false;
    }

    get classes() {
        return ["bg3-portrait-container"]
    }

    get img() {
        return (async () => {
            const saved = await this.actor.getFlag(BG3CONFIG.MODULE_NAME, "useTokenImage");
            if (saved !== undefined) this.useTokenImage = saved;
            else {
                const defaultPref = game.settings.get(BG3CONFIG.MODULE_NAME, 'defaultPortraitPreferences');
                this.useTokenImage = defaultPref === 'token';
            }
            return this.useTokenImage ? this.token.document.texture.src : this.actor.img;
        })();
    }

    get health() {
        const hpValue = this.actor.system.attributes?.hp?.value || 0;
        const hpMax = this.actor.system.attributes?.hp?.max || 1;
        const hpPercent = Math.max(0, Math.min(100, (hpValue / hpMax) * 100));
        const damagePercent = 100 - hpPercent;
        const tempHp = this.actor.system.attributes?.hp?.temp || 0;
        return {
            current: hpValue,
            max: hpMax,
            percent: hpPercent,
            damage: damagePercent,
            temp: tempHp
        }
    }

    get extraInfos() {
        return (async () => {
            const savedData = await game.settings.get(BG3CONFIG.MODULE_NAME, 'dataExtraInfo'),
                extraInfos = [];
            for(let i = 0; i < savedData.length; i++) {
                let extraData = {};
                if(savedData[i].attr && savedData[i].attr !== '') {
                    const attr = foundry.utils.getProperty(this.actor.system, savedData[i].attr) ?? foundry.utils.getProperty(this.actor.system, savedData[i].attr + ".value") ?? this._getInfoFromSettings(savedData[i].attr);
                    if(attr) extraData = {icon: savedData[i].icon, value: attr, color: savedData[i].color};
                }
                extraInfos.push(extraData);
            }
            return extraInfos;
        })();
    }

    _getInfoFromSettings(stringInfo) {
        try {
            const [module, data] = stringInfo.split('.');
            return game.settings.get(module, data);            
        } catch (error) {
            return null;
        }
    }

    async getData() {
        return {
            img: await this.img,
            health: this.health,
            opacity: 1,
            extraInfos: await this.extraInfos
        };
    }

    async _registerEvents() {
        const image = this.element.querySelector('.portrait-image-subcontainer');
        if(!image) return;

        this.element.addEventListener('dblclick', (event) => {
            if(game.settings.get(BG3CONFIG.MODULE_NAME, 'showSheetSimpleClick')) return;
            this.actor.sheet.render(true);
        });

        this.element.addEventListener('click', (event) => {
            if(!game.settings.get(BG3CONFIG.MODULE_NAME, 'showSheetSimpleClick')) return;
            this.actor.sheet.render(true);
        });

        this.element.querySelector('.portrait-image-container').addEventListener('contextmenu', (event) => MenuContainer.toggle(this.getPortraitMenu(), this.element, event));

        // this.element.querySelector('.ability-button').addEventListener('click', (event) => MenuContainer.toggle(this.getMenuData(), this.element.querySelector('.ability-button'), event));
    }

    /* getSkillLabel(key) {
        return {
            "ath": "Athletics",
            "acr": "Acrobatics",
            "slt": "Sleight of Hand",
            "ste": "Stealth",
            "arc": "Arcana",
            "his": "History",
            "inv": "Investigation",
            "nat": "Nature",
            "rel": "Religion",
            "ani": "Animal Handling",
            "ins": "Insight",
            "med": "Medicine",
            "prc": "Perception",
            "sur": "Survival",
            "dec": "Deception",
            "itm": "Intimidation",
            "prf": "Performance",
            "per": "Persuasion"
        }[key];
    }

    get abilities() {
        return {
            str: { label: "Strength", mod: this.getAbilityMod('str'), skills: this.getSkillMod(["ath"]) },
            dex: { label: "Dexterity", mod: this.getAbilityMod('dex'), skills: this.getSkillMod(["acr", "slt", "ste"]) },
            con: { label: "Constitution", mod: this.getAbilityMod('con'), skills: [] },
            int: { label: "Intelligence", mod: this.getAbilityMod('int'), skills: this.getSkillMod(["arc", "his", "inv", "nat", "rel"]) },
            wis: { label: "Wisdom", mod: this.getAbilityMod('wis'), skills: this.getSkillMod(["ani", "ins", "med", "prc", "sur"]) },
            cha: { label: "Charisma", mod: this.getAbilityMod('cha'), skills: this.getSkillMod(["dec", "itm", "prf", "per"]) }
        };
    }

    getAbilityMod(key) {
        const abilityScore = this.actor.system.abilities?.[key] || { value: 10, proficient: false },
            mod = abilityScore.save.value,
            modString = mod >= 0 ? `+${mod}` : mod.toString();
        return {value: modString, style: abilityScore.proficient === 1 ?  'color: #3498db' : ''  };
    }
    
    skillRoll(event) {
        event.stopPropagation();
        const parent = event.target.closest('[data-key]');
        try {
            this.actor.rollSkill({
                skill: parent.dataset.key,
                event: event,
                advantage: event.altKey,
                disadvantage: event.ctrlKey,
                fastForward: event.shiftKey
            });
            // this.element.querySelectorAll('.bg3-menu-container').forEach(e => e.classList.add('hidden'));
        } catch (error) {
            ui.notifications.error(`Error rolling ${parent.dataset.key.toUpperCase()} save. See console for details.`);
        }
    };

    getSkillMod(keys) {
        const skills = {};
        keys.forEach(k => {
            const skill = this.actor.system.skills?.[k] || { proficient: false },
                mod = skill.total,
                modStr = mod >= 0 ? `+${mod}` : mod.toString();
            skills[k] = {label:  this.getSkillLabel(k), icon: 'fas fa-dice-d20', value: modStr, style: skill.proficient === 1 ?  'color: #3498db' : '', click: this.skillRoll.bind(this)}
        })
        return skills;
    };

    getMenuData() {
        const saveRoll = (event) => {
            event.stopPropagation();
            const parent = event.target.closest('[data-key]');
            try {
                this.actor.rollAbilitySave({
                    ability: parent.dataset.key,
                    event: event,
                    advantage: event.altKey,
                    disadvantage: event.ctrlKey,
                    fastForward: event.shiftKey
                });
                // this.element.querySelectorAll('.bg3-menu-container').forEach(e => e.classList.add('hidden'));
            } catch (error) {
                ui.notifications.error(`Error rolling ${parent.dataset.key.toUpperCase()} save. See console for details.`);
            }
        };
        const checkRoll = (event) => {
            event.stopPropagation();
            const parent = event.target.closest('[data-key]');
            try {
                this.actor.rollAbilityCheck({
                    ability: parent.dataset.key,
                    event: event,
                    advantage: event.altKey,
                    disadvantage: event.ctrlKey,
                    fastForward: event.shiftKey
                });
                // this.element.querySelectorAll('.bg3-menu-container').forEach(e => e.classList.add('hidden'));
            } catch (error) {
                ui.notifications.error(`Error rolling ${parent.dataset.key.toUpperCase()} save. See console for details.`);
            }
        };

        return {
            position: 'top',
            event: 'click',
            name: 'baseMenu',
            buttons: {
                str: { ...{label: "Strength", skills: this.getSkillMod(["ath"]), tooltip: "Click to show ability checks and saving throws"}, ...this.getAbilityMod('str'),
                subMenu: [
                    {position: 'topright', name: 'saveMenu', event: 'click', buttons: {checkSTR: {...{label: 'Check', icon: 'fas fa-dice-d20', click: checkRoll}, ...this.getAbilityMod('str')}, saveSTR: {...{label: 'Save', icon: 'fas fa-dice-d20', click: saveRoll}, ...this.getAbilityMod('str')}}},
                    {position: 'topleft', name: 'skillMenu', event: 'click', buttons: this.getSkillMod(["ath"])}
                ] },
                dex: { ...{label: "Dexterity", skills: this.getSkillMod(["acr", "slt", "ste"]), tooltip: "Click to show ability checks and saving throws"}, ...this.getAbilityMod('dex'),
                subMenu: [
                    {position: 'topright', name: 'saveMenu', event: 'click', buttons: {checkDEX: {...{label: 'Check', icon: 'fas fa-dice-d20', click: checkRoll}, ...this.getAbilityMod('dex')}, saveDEX: {...{label: 'Save', icon: 'fas fa-dice-d20', click: saveRoll}, ...this.getAbilityMod('dex')}}},
                    {position: 'topleft', name: 'skillMenu', event: 'click', buttons: this.getSkillMod(["acr", "slt", "ste"])}
                ] },
                con: { ...{label: "Constitution", skills: [], tooltip: "Click to show ability checks and saving throws"}, ...this.getAbilityMod('con'),
                subMenu: [
                    {position: 'topright', name: 'saveMenu', event: 'click', buttons: {checkCON: {...{label: 'Check', icon: 'fas fa-dice-d20', click: checkRoll}, ...this.getAbilityMod('con')}, saveCON: {...{label: 'Save', icon: 'fas fa-dice-d20', click: saveRoll}, ...this.getAbilityMod('con')}}},
                    {position: 'topleft', name: 'skillMenu', event: 'click', buttons: null}
                ] },
                int: { ...{label: "Intelligence", skills: this.getSkillMod(["arc", "his", "inv", "nat", "rel"]), tooltip: "Click to show ability checks and saving throws"}, ...this.getAbilityMod('int'),
                subMenu: [
                    {position: 'topright', name: 'saveMenu', event: 'click', buttons: {checkINT: {...{label: 'Check', icon: 'fas fa-dice-d20', click: checkRoll}, ...this.getAbilityMod('int')}, saveINT: {...{label: 'Save', icon: 'fas fa-dice-d20', click: saveRoll}, ...this.getAbilityMod('int')}}},
                    {position: 'topleft', name: 'skillMenu', event: 'click', buttons: this.getSkillMod(["arc", "his", "inv", "nat", "rel"])}
                ] },
                wis: { ...{label: "Wisdom", skills: this.getSkillMod(["ani", "ins", "med", "prc", "sur"]), tooltip: "Click to show ability checks and saving throws"}, ...this.getAbilityMod('wis'),
                subMenu: [
                    {position: 'topright', name: 'saveMenu', event: 'click', buttons: {checkWIS: {...{label: 'Check', icon: 'fas fa-dice-d20', click: checkRoll}, ...this.getAbilityMod('wis')}, saveWIS: {...{label: 'Save', icon: 'fas fa-dice-d20', click: saveRoll}, ...this.getAbilityMod('wis')}}},
                    {position: 'topleft', name: 'skillMenu', event: 'click', buttons: this.getSkillMod(["ani", "ins", "med", "prc", "sur"])}
                ] },
                cha: { ...{label: "Charisma", skills: this.getSkillMod(["dec", "itm", "prf", "per"]), tooltip: "Click to show ability checks and saving throws"}, ...this.getAbilityMod('cha'),
                subMenu: [
                    {position: 'topright', name: 'saveMenu', event: 'click', buttons: {checkCHA: {...{label: 'Check', icon: 'fas fa-dice-d20', click: checkRoll}, ...this.getAbilityMod('cha')}, saveCHA: {...{label: 'Save', icon: 'fas fa-dice-d20', click: saveRoll}, ...this.getAbilityMod('cha')}}},
                    {position: 'topleft', name: 'skillMenu', event: 'click', buttons: this.getSkillMod(["dec", "itm", "prf", "per"])}
                ] }
            }
        };
    }; */

    async updateImagePreference() {
        this.useTokenImage = !this.useTokenImage;
        await this.actor.setFlag(BG3CONFIG.MODULE_NAME, "useTokenImage", this.useTokenImage);
        this._renderInner();
    }

    setImgBGColor() {
        const value = game.settings.get(BG3CONFIG.MODULE_NAME, 'backgroundPortraitPreferences');
        this.element.style.setProperty('--img-background-color', (value && value != '' ? value : 'transparent'));
    }

    setPortraitBendMode() {
        const imageContainer = this.element.getElementsByClassName('portrait-image-subcontainer');
        if(imageContainer[0]) imageContainer[0].setAttribute('data-bend-mode', game.settings.get(BG3CONFIG.MODULE_NAME, 'overlayModePortrait'));
    }

    togglePortraitOverlay() {
        const overlay = this.element.getElementsByClassName('health-overlay');
        if(overlay && overlay[0]) overlay[0].classList.toggle('hidden', !game.settings.get(BG3CONFIG.MODULE_NAME, 'showHealthOverlay'));
    }

    toggleHPText() {
        const text = this.element.getElementsByClassName('hp-text');
        if(text && text[0]) text[0].classList.toggle('hidden', !game.settings.get(BG3CONFIG.MODULE_NAME, 'showHPText'));
    }

    toggleExtraInfos() {
        const text = this.element.getElementsByClassName('extra-infos-container');
        if(text && text[0]) text[0].classList.toggle('hidden', !game.settings.get(BG3CONFIG.MODULE_NAME, 'showExtraInfo'));
    }

    getPortraitMenu() {
        return {
            position: 'mouse',
            event: 'contextmenu',
            name: 'baseMenu',
            buttons: {
                token: {
                    label: 'Use Token Image', icon: 'fas fa-chess-pawn', custom: this.useTokenImage ? '<i class="fas fa-check"></i>' : '', click: !this.useTokenImage ? this.updateImagePreference.bind(this) : null
                },
                portrait: {
                    label: 'Use Character Portrait', icon: 'fas fa-user', custom: !this.useTokenImage ? '<i class="fas fa-check"></i>' : '', click: this.useTokenImage ? this.updateImagePreference.bind(this) : null
                }
            }
        }
    }

    applySettings() {
        this.element.setAttribute("data-shape", game.settings.get(BG3CONFIG.MODULE_NAME, 'shapePortraitPreferences'));
        this.element.setAttribute("data-border", game.settings.get(BG3CONFIG.MODULE_NAME, 'borderPortraitPreferences'));
        this.setImgBGColor();
        this.element.classList.toggle('portrait-hidden', !game.settings.get(BG3CONFIG.MODULE_NAME, 'hidePortraitImage'));
        this.setPortraitBendMode();
        this.togglePortraitOverlay();
        this.toggleHPText();
        this.toggleExtraInfos();
    }
    
    async _renderInner() {
        // this.useTokenImage = await this.actor.getFlag(BG3CONFIG.MODULE_NAME, "useTokenImage") ?? false;
        await super._renderInner();
        this.applySettings();
        // Death Save
        this.components.deathSavesContainer = new DeathSavesContainer();
        this.components.deathSavesContainer.render();
        this.element.appendChild(this.components.deathSavesContainer.element);
        // Ability Container 
        this.components.abilityContainer = new AbilityContainer();
        this.components.abilityContainer.render();
        this.element.appendChild(this.components.abilityContainer.element);

        // this.abilityMenu = new MenuContainer(this.getMenuData(), this.element.querySelector('.ability-button'));
        // this.abilityMenu.render();
        // this.portraitMenu = new MenuContainer(this.getPortraitMenu(), this.element);
        // this.portraitMenu.render();
    }
}