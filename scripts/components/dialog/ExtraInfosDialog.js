import { BG3CONFIG } from "../../utils/config.js";

/* export class PortraitSettingDialog extends FormApplication {
    constructor () {
        super();
    }

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: 'Portrait settings',
            id: "bg3-inspired-hotbar-portrait-settings",
            template: `modules/${BG3CONFIG.MODULE_NAME}/templates/dialog/portrait-dialog.hbs`,
            height: "auto",
            submitOnClose: false
        };
    }

    getData() {
        const dataKeys = ['hidePortraitImage', 'showExtraInfo', 'defaultPortraitPreferences', 'shapePortraitPreferences', 'borderPortraitPreferences', 'showSheetSimpleClick', 'backgroundPortraitPreferences', 'showHealthOverlay', 'showHPText', 'overlayModePortrait', 'showDeathSavingThrow'],
            configData = {},
            configAdv = {};
        for(let i = 0; i < dataKeys.length; i++) {
            const setting = game.settings.settings.get(`${BG3CONFIG.MODULE_NAME}.${dataKeys[i]}`);
            if(setting.scope === 'client' || game.user.isGM) configData[dataKeys[i]] = game.settings.get(BG3CONFIG.MODULE_NAME, dataKeys[i]);
        }
        return {configData};
    }

    activateListeners(html) {
        super.activateListeners(html);
    }

    async _onSubmit(event) {
        event.preventDefault();
        let data = [];
        const form = this.element[0].querySelectorAll('div.form-fields:not([data-exclude="true"])');
        for (let i = 0; i < form.length; i++) {
            const input = form[i].querySelector("input") ?? form[i].querySelector("select"),
                value = input.type == 'checkbox' ? input.checked : input.value;
            game.settings.set(BG3CONFIG.MODULE_NAME, input.name.split('.')[1], value);
        }
        this.close();
    }
} */

export class ExtraInfosDialog extends FormApplication {
    constructor () {
        super();
    }

    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            title: 'Portrait extra datas settings',
            id: "bg3-inspired-hotbar-extradatas-settings",
            template: `modules/bg3-inspired-hotbar/templates/dialog/extra-infos-dialog.hbs`,
            height: "auto",
            submitOnClose: false
        };
    }

    getData() {
        let listAttr = TokenDocument.implementation.getTrackedAttributes();
        listAttr.bar.forEach(a => a.push("value"));
        const listAttrChoices = TokenDocument.implementation.getTrackedAttributeChoices(listAttr);
        return {extraInfos: game.settings.get(BG3CONFIG.MODULE_NAME, "dataExtraInfo"), listAttrChoices};
    }

    activateListeners(html) {
        super.activateListeners(html);
        html[0].querySelectorAll(".list-attr").forEach((select) => {
            select.addEventListener("change", (event) => {
                const value = event.target.value;
                const inputAttr = event.target.closest(".form-group").querySelector(".attr");
                inputAttr.value = value;
            });
        });
    }

    async _onSubmit(event) {
        event.preventDefault();
        let data = [];
        const form = this.element[0].querySelectorAll('div.container-section');
        for (let i = 0; i < form.length; i++) {
            const attr = form[i].querySelector(".attr").value;
            const icon = form[i].querySelector(".icon").value;
            const color = form[i].querySelector(".color").value;
            const pos = form[i].querySelector(".notes").innerHTML;
            data.push({attr, icon, color, pos})
        }
        await game.settings.set(BG3CONFIG.MODULE_NAME, "dataExtraInfo", data);
        this.close();
    }
}