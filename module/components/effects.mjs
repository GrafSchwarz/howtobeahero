import { HowToBeAHeroActor } from '../documents/actor.mjs';
import { HowToBeAHeroActiveEffect } from '../documents/active-effect.mjs';
import { staticID } from "../helpers/utils.mjs";
import ContextMenu from "../helpers/context-menu.mjs";

export default class EffectsElement extends HTMLElement {
  connectedCallback() {
    this.#app = ui.windows[this.closest(".app")?.dataset.appid];

    this.setupEventListeners();
    this.setupContextMenu();
  }

  setupEventListeners() {
    this.querySelectorAll("[data-action]").forEach(control => {
      control.addEventListener("click", event => {
        this._onAction(event.currentTarget, event.currentTarget.dataset.action);
      });
    });

    this.querySelectorAll(".effect-source a").forEach(source => {
      source.addEventListener("click", this._onClickEffectSource.bind(this));
    });

    this.querySelectorAll("[data-context-menu]").forEach(control => {
      control.addEventListener("click", this._onContextMenuClick.bind(this));
    });
  }

  setupContextMenu() {
    new ContextMenu(this, "[data-effect-id]", [], {
      onOpen: element => {
        const effect = this.getEffect(element.dataset);
        if (!effect) return;
        ui.context.menuItems = this._getContextOptions(effect);
        Hooks.call("HTBAH.getActiveEffectContextOptions", effect, ui.context.menuItems);
      },
      jQuery: false
    });
  }

  #app;

  get _app() { return this.#app; }

  get document() {
    return this._app?.document;
  }

  static prepareCategories(effects) {
    const categories = {
      temporary: {
        type: "temporary",
        label: game.i18n.localize("HTBAH.EffectTemporary"),
        effects: []
      },
      passive: {
        type: "passive",
        label: game.i18n.localize("HTBAH.EffectPassive"),
        effects: []
      },
      inactive: {
        type: "inactive",
        label: game.i18n.localize("HTBAH.EffectInactive"),
        effects: []
      }
    };

    for (const e of effects) {
      if (e.disabled) categories.inactive.effects.push(e);
      else if (e.isTemporary) categories.temporary.effects.push(e);
      else categories.passive.effects.push(e);
    }

    return categories;
  }

  _getContextOptions(effect) {
    const options = [
      {
        label: "HTBAH.ContextMenuActionEdit",
        icon: "<i class='fas fa-edit fa-fw'></i>",
        visible: () => effect.isOwner,
        callback: li => this._onAction(li[0], "edit")
      },
      {
        label: "HTBAH.ContextMenuActionDuplicate",
        icon: "<i class='fas fa-copy fa-fw'></i>",
        visible: () => effect.isOwner,
        callback: li => this._onAction(li[0], "duplicate")
      },
      {
        label: "HTBAH.ContextMenuActionDelete",
        icon: "<i class='fas fa-trash fa-fw'></i>",
        visible: () => effect.isOwner,
        callback: li => this._onAction(li[0], "delete")
      },
      {
        label: effect.disabled ? "HTBAH.ContextMenuActionEnable" : "HTBAH.ContextMenuActionDisable",
        icon: effect.disabled ? "<i class='fas fa-check fa-fw'></i>" : "<i class='fas fa-times fa-fw'></i>",
        visible: () => effect.isOwner,
        callback: li => this._onAction(li[0], "toggle")
      }
    ];

    if ((this.document instanceof HowToBeAHeroActor) && ("favorites" in this.document.system)) {
      const uuid = effect.getRelativeUUID(this.document);
      const isFavorited = this.document.system.hasFavorite(uuid);
      options.push({
        label: isFavorited ? "HTBAH.FavoriteRemove" : "HTBAH.Favorite",
        icon: "<i class='fas fa-star fa-fw'></i>",
        visible: () => effect.isOwner,
        callback: li => this._onAction(li[0], isFavorited ? "unfavorite" : "favorite")
      });
    }

    return options;
  }

  async _onAction(target, action) {
    const event = new CustomEvent("effect", {
      bubbles: true,
      cancelable: true,
      detail: action
    });
    if (target.dispatchEvent(event) === false) return;

    if (!this.document) {
      return;
    }

    if (action === "toggleCondition") {
      const conditionId = target.closest("[data-condition-id]")?.dataset.conditionId;
      if (conditionId) {
        return game.howtobeahero.managers.conditions.toggleCondition(this.document, conditionId);
      }
      return;
    }

    const dataset = target.closest("[data-effect-id]")?.dataset;
    const effect = this.getEffect(dataset);
    if ((action !== "create") && !effect) return;

    switch (action) {
      case "create":
        return this._onCreate(target);
      case "delete":
        return effect.deleteDialog();
      case "duplicate":
        return effect.clone({name: game.i18n.format("DOCUMENT.CopyOf", {name: effect.name})}, {save: true});
      case "edit":
        return effect.sheet.render(true);
      case "favorite":
        return this.document.system.addFavorite({type: "effect", id: effect.getRelativeUUID(this.document)});
      case "toggle":
        return effect.update({disabled: !effect.disabled});
      case "unfavorite":
        return this.document.system.removeFavorite(effect.getRelativeUUID(this.document));
    }
  }

  async _onCreate(target) {
    const isActor = this.document instanceof HowToBeAHeroActor;
    const li = target.closest("li");
    return this.document.createEmbeddedDocuments("ActiveEffect", [{
      name: isActor ? game.i18n.localize("HTBAH.EffectNew") : this.document.name,
      icon: isActor ? "icons/svg/aura.svg" : this.document.img,
      origin: this.document.uuid,
      duration: {
        rounds: li.dataset.effectType === "temporary" ? 1 : undefined
      },
      disabled: li.dataset.effectType === "inactive"
    }]);
  }

  async _onClickEffectSource(event) {
    const { uuid } = event.currentTarget.dataset;
    const doc = await fromUuid(uuid);
    if (!doc) return;
    if (!doc.testUserPermission(game.user, "LIMITED")) {
      ui.notifications.warn("HTBAH.DocumentViewWarn", { localize: true });
      return;
    }
    doc.sheet.render(true);
  }

  _onContextMenuClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const { clientX, clientY } = event;
    event.currentTarget.closest("[data-effect-id]").dispatchEvent(new PointerEvent("contextmenu", {
      view: window, bubbles: true, cancelable: true, clientX, clientY
    }));
  }

  getEffect({ effectId, parentId }={}) {
    if (!parentId) return this.document.effects.get(effectId);
    return this.document.items.get(parentId).effects.get(effectId);
  }
}