import { BG3CONFIG } from "../../utils/config.js";

export class ThemeSettingDialog extends FormApplication {
    constructor () {
        super();
        this.keys = [];
        this.fields = {};
        /* if (this.useMonkSettings()) {
            let user = game.users.find(u => u.id === game.settings.sheet.userId);
            let cs = foundry.utils.getProperty(user, "flags.monks-player-settings.client-settings");
            this.clientSettings[user.id] = cs ? foundry.utils.flattenObject(JSON.parse(cs)) : null;
        } */
    }

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            id: "bg3-inspired-hotbar-setting-dialog",
            template: `modules/${BG3CONFIG.MODULE_NAME}/templates/dialog/setting-dialog.hbs`,
            height: "auto",
            submitOnClose: false
        };
    }

    getInputType(setting) {
        if(setting.choices) return {type: 'select', choices: setting.choices}
        else if(setting.range) return {type: 'range', range: setting.range}
        else if(setting.subtype) return {type: setting.subtype}
        else return {type: setting.type.name.toLowerCase()}
    }

    async getData() {
        for(let i = 0; i < this.keys.length; i++) {
            const cFields = {};
            for(let j = 0; j < this.keys[i].fields.length; j++) {
                const setting = game.settings.settings.get(`${BG3CONFIG.MODULE_NAME}.${this.keys[i].fields[j]}`) ?? null;
                if(setting) {
                    if((setting?.scope === 'client' || game.user.isGM) && (setting.visible === undefined || setting.visible())) {
                        cFields[this.keys[i].fields[j]] = {
                            name: setting.name,
                            hint: setting.hint,
                            value: this._getClientData(this.keys[i].fields[j]),
                            ...this.getInputType(setting)
                        };
                    }
                } else {
                    const menu = game.settings.menus.get(`${BG3CONFIG.MODULE_NAME}.${this.keys[i].fields[j]}`);
                    if((menu?.scope === 'client' || game.user.isGM) && (menu.visible === undefined || menu.visible())) {
                        cFields[this.keys[i].fields[j]] = {
                            name: menu.name,
                            label: menu.label,
                            hint: menu.hint,
                            icon: menu.icon,
                            type: 'menu'
                        };
                    }
                }
            }
            this.fields[this.keys[i].label] = cFields;
        }
        return {fields: this.fields};
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find(".submenu button").click(this._onClickSubmenu.bind(this));
    }

    _onClickSubmenu(event) {
        event.preventDefault();
        const menu = game.settings.menus.get(event.currentTarget.dataset.key);
        if ( !menu ) return ui.notifications.error("No submenu found for the provided key");
        const app = new menu.type();
        return app.render(true);
    }

    async _onSubmit(event) {
        event.preventDefault();
        const form = this.element[0].querySelectorAll('div.form-fields:not([data-exclude="true"])'),
            formData = {};
        for (let i = 0; i < form.length; i++) {
            const input = form[i].querySelector("input") ?? form[i].querySelector("select");
            if(!input) continue;
            const value = input.type == 'checkbox' ? input.checked : input.value;
            if (this.useMonkSettings() && value != this._getClientData(input.name)) formData[`${BG3CONFIG.MODULE_NAME}.${input.name}`] = input.dataset?.dtype === 'Number' ? Number(value) : value;
            else game.settings.set(BG3CONFIG.MODULE_NAME, input.name, input.dataset?.dtype === 'Number' ? Number(value) : value);
        }
        if (this.useMonkSettings()) {
            await game.settings.sheet._updateObject(event, formData);
            if(Object.keys(formData).length) await game.settings.sheet.getData({});
        }
        this.close();
    }

    useMonkSettings() {
        return game.modules.get("monks-player-settings")?.active && game.user.isGM && game.user.id !== game.settings.sheet.userId;
    }

    _getClientData(key) {
        if (this.useMonkSettings()) {
            let gmchanges = game.settings.sheet.userId != game.user.id ? game.settings.sheet.gmchanges[game.settings.sheet.userId] || {} : {};
            let clientSettings = game.settings.sheet.userId != game.user.id ? game.settings.sheet.clientSettings[game.settings.sheet.userId] || {} : {};
            let originalValue;
            try {
                originalValue = (game.settings.sheet.userId != game.user.id ? game.settings.sheet.getClientSetting(BG3CONFIG.MODULE_NAME, key, clientSettings) : game.settings.get(BG3CONFIG.MODULE_NAME, key));
            } catch (err) {
                log(`Settings detected issue ${s.namespace}.${s.key}`, err);
            }
            let value = (game.settings.sheet.userId != game.user.id ? (gmchanges[BG3CONFIG.MODULE_NAME] && gmchanges[BG3CONFIG.MODULE_NAME][key]) ?? originalValue : originalValue);
            return value;
        }
        return game.settings.get(BG3CONFIG.MODULE_NAME, key);
    }
}

export class PortraitSettingDialog extends ThemeSettingDialog {
    constructor () {
        super();
        this.keys = [
            {label: 'Show/Hide settings',
            fields: ['hidePortraitImage', 'showHealthOverlay', 'showHPText', 'showDeathSavingThrow', 'showExtraInfo', 'menuExtraInfo']},
            {label: 'Portrait settings',
            fields: ['defaultPortraitPreferences', 'shapePortraitPreferences', 'borderPortraitPreferences', 'backgroundPortraitPreferences', 'overlayModePortrait']},
            {label: 'Other settings',
            fields: ['showSheetSimpleClick']}
        ]
    }

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: "Portrait settings"
        }
    }
}

export class HotbarSettingDialog extends ThemeSettingDialog {
    constructor () {
        super();
        this.keys = [
            {label: 'General',
            fields: ['showItemNames', 'showItemUses', 'highlightStyle']},
            {label: 'Common Actions',
            fields: ['showCombatContainer', 'autoPopulateCombatContainer', 'chooseCPRActions', 'lockCombatContainer']},
            {label: 'Others',
            fields: ['fadeControlsMenu', 'showRestTurnButton']}
        ]
    }

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: "Hotbar settings"
        }
    }
}

export class CombatSettingDialog extends ThemeSettingDialog {
    constructor () {
        super();
        this.keys = [
            {label: 'none',
            fields: ['showCombatContainer', 'autoPopulateCombatContainer', 'lockCombatContainer']}
        ]
    }

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: "Common Actions settings"
        }
    }
}

export class AutoPopulateSettingDialog extends ThemeSettingDialog {
    constructor () {
        super();
        this.keys = [
            {label: 'none',
            fields: ['enforceSpellPreparationPC', 'enforceSpellPreparationNPC', 'autoPopulateLinkedTokens', 'autoPopulateUnlinkedTokens', 'containerAutoPopulateSettings']}
        ]
    }

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: "Auto-Populating settings"
        }
    }
}

export class MidiQoLSettingDialog extends ThemeSettingDialog {
    constructor () {
        super();
        this.keys = [
            {label: 'none',
            fields: ['synchroBRMidiQoL', 'addAdvBtnsMidiQoL']}
        ]
    }

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: "Auto-Populating settings"
        }
    }
}

export class TooltipSettingDialog extends ThemeSettingDialog {
    constructor () {
        super();
        this.keys = [
            {label: 'none',
            fields: ['enableLightTooltip', 'tooltipDelay', 'showMaterialDescription', 'showDamageRanges']}
        ]
    }

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: "Tooltip settings"
        }
    }
}

export class GlobalSettingDialog extends ThemeSettingDialog {
    constructor () {
        super();
        this.keys = [
            {label: 'Foundry UI',
            fields: ['collapseFoundryMacrobar', 'playerListVisibility', 'underPause']},
            {label: 'Scale & Position',
            fields: ['autoScale', 'uiScale', 'uiPosition', 'posPadding', 'posPaddingBottom']},
            {label: 'Opacity & Hide',
            fields: ['normalOpacity', 'fadedOpacity', 'fadeOutDelay', 'autoHideCombat']}
        ]
    }

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: "General settings"
        }
    }
}