import { BG3Hotbar } from "../bg3-hotbar.js";


export class RestTurnContainer {
    constructor(ui) {
        this.element = null;
        this.ui = ui;
        this._buttons = [];

        this._createContainer();
    }

    _createContainer() {
        this.element = document.createElement("div");
        this.element.classList.add("rest-turn-container");

        this.render();
    }

    render() {
        // Clear existing buttons
        this.element.innerHTML = '';
        this._buttons = [];

        const dataToggle = {
            type: 'label',
            class: ["btn-toggle", "fas", "fa-caret-down"],
            attr: {"title": 'Show/Hide HotBar UI', "for": 'toggle-input'}
        }
        this._buttons.push(new RestTurnButton(dataToggle));

        const dataEnd = {
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
        }
        this._buttons.push(new RestTurnButton(dataEnd));

        const dataShort = {
            type: 'div',
            class: ["rest-turn-button"],
            label: 'Short Rest',
            icon: "fa-campfire",
            visible: () => !game.combat?.started,
            events: {
                'click': this.actor.shortRest.bind(this.actor)
            }
        }
        if(this.actor?.type != 'vehicle') this._buttons.push(new RestTurnButton(dataShort));

        const dataLong = {
            type: 'div',
            class: ["rest-turn-button"],
            label: 'Long Rest',
            icon: "fa-tent",
            visible: () => !game.combat?.started,
            events: {
                'click': this.actor.longRest.bind(this.actor)
            }
        }
        if(this.actor?.type != 'vehicle') this._buttons.push(new RestTurnButton(dataLong));

        // Add buttons to container
        for(let i = 0; i < this._buttons.length; i++) {
            this.element.appendChild(this._buttons[i].element);
        }

        // Handle toggle input
        if (!document.getElementById('toggle-input')) {
            const toggleInput = document.createElement('input');
            toggleInput.setAttribute('type', 'checkbox');
            toggleInput.setAttribute('id', 'toggle-input');
            // Insert before the main container if it exists
            const container = document.getElementById('bg3-hotbar-container');
            if (container && container.parentNode) {
                container.parentNode.insertBefore(toggleInput, container);
            } else {
                // If container doesn't exist yet, append to body
                document.body.appendChild(toggleInput);
            }
        }
    }

    updateVisibility() {
      this._buttons.forEach(button => button.element.classList.toggle('hidden', !button.visible));
    }

    get actor() {
        return canvas.tokens.get(BG3Hotbar.manager.currentTokenId)?.actor;
    }
}

class RestTurnButton {
    constructor({...args}) {
        this.args = args;
        this.type = args['type'];
        this.class = args['class'] ?? [];
        this.attr = args['attr'] ?? {};
        this.label = args['label'] ?? null;
        this.icon = args['icon'] ?? null;

        this.element = this._createButton();
        if(args['events']) this._registerEvents(args['events']);
    }

    _createButton() {
        const btnContainer = document.createElement(this.type);
        btnContainer.classList.add(...this.class);
        if(!this.visible) btnContainer.classList.add('hidden');
        Object.entries(this.attr).forEach(([value, index]) => btnContainer.setAttribute(value, index));
        if(this.label) {
            const btnLabel = document.createElement("span");
            btnLabel.classList.add("rest-turn-label");
            btnLabel.innerText = this.label;
            btnContainer.appendChild(btnLabel);
        }
        if(this.icon) {
            const btnIcon = document.createElement("i");
            btnIcon.classList.add("fas", this.icon);
            btnContainer.appendChild(btnIcon);
        }

        return btnContainer;
    }

    _registerEvents(events) {
        Object.entries(events).forEach(([trigger, fn]) => {
            this.element.addEventListener(trigger, fn);
        })
    }

    get visible() {
        if(this.args['visible']) return this.args['visible']();
        else return true;
    }
}