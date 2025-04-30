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
    }

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
    }
}