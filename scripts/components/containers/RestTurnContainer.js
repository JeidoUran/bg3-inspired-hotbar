import { BaseButton } from "../buttons/BaseButton.js";
import { BG3Component } from "../component.js";
import { BG3CONFIG } from "../../utils/config.js";

export class RestTurnContainer extends BG3Component {
    constructor(data) {
        super(data);
    }

    get classes() {
        return ["bg3-restturn-container"]
    }

    get btnData() {
        let btnData = [];
        if(game.settings.get(BG3CONFIG.MODULE_NAME, 'showRestTurnButton') && ui.BG3HOTBAR.manager.actor) {
            btnData = [...btnData, ...[
                {
                    type: 'div',
                    class: ["rest-turn-button", "turn-button"], 
                    label: 'End Turn',
                    icon: 'fa-clock-rotate-left',
                    visible: () => !!game.combat?.started && game.combat?.combatant?.actor === this.actor,
                    events: {
                        'click': function() {
                            game.combat.nextTurn.bind(game.combat)()
                        }
                    }
                },
                {
                    type: 'div',
                    class: ["rest-turn-button"],
                    label: 'Short Rest',
                    icon: "fa-campfire",
                    visible: () => !game.combat?.started,
                    events: {
                        'click': this.actor.shortRest.bind(this.actor)
                    }
                },
                {
                    type: 'div',
                    class: ["rest-turn-button"],
                    label: 'Long Rest',
                    icon: "fa-tent",
                    visible: () => !game.combat?.started,
                    events: {
                        'click': this.actor.longRest.bind(this.actor)
                    }
                }
            ]]
        } else if(ui.BG3HOTBAR.manager.canGMHotbar()) {
            btnData = [...btnData, ...[
                {
                    type: 'div',
                    class: ["rest-turn-button"],
                    label: 'Macros',
                    icon: "fa-folder",
                    events: {
                        'click': ev => ui.macros.renderPopout(true)
                    }
                }
            ]]
        };
        btnData = [...btnData, ...[
            {
                type: 'label',
                class: ["btn-toggle", "fas", "fa-caret-down"],
                attr: {"title": 'Show/Hide HotBar UI', "for": 'toggle-input'},
                events: {
                    'click': ev => ui.BG3HOTBAR._onToggleMinimize(ev)
                }
            }
        ]];
        return btnData;
    }

    async render() {
        await super.render();
        this.components = this.btnData.map((btn) => new BaseButton(btn));
        for(const btn of this.components) this.element.appendChild(btn.element);
        await Promise.all(this.components.map((btn) => btn.render()));
        return this.element;
    }
}