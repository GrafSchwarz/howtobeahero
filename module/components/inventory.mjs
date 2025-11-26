import {parseInputDelta} from "../helpers/utils.mjs";
//import CurrencyManager from "../currency-manager.mjs";
import ContextMenuHTBAH from "../helpers/context-menu.mjs";
import { ActorSelectorDialog } from "../helpers/actor-selector-dialog.mjs";

/**
 * Custom element that handles displaying actor & container inventories.
 */
export default class InventoryElement extends HTMLElement {
  connectedCallback() {
    
    // Try different ways to find the app element for AppV2 compatibility
    let appElement = this.closest(".app") || 
                     this.closest(".how-to-be-a-hero") || 
                     this.closest('[data-appid]') ||
                     this.closest('form')?.closest('.window-app');
    
    
    // Try to get the app reference in different ways
    let app = null;
    if (appElement?.dataset?.appid) {
      app = ui.windows[appElement.dataset.appid];
    }
    
    // If that fails, try to get it from the _sheet property set by the actor sheet
    if (!app && appElement?._sheet) {
      app = appElement._sheet;
    }
    
    // If that fails, try to find it via the closest how-to-be-a-hero element
    if (!app) {
      const sheetElement = this.closest('.how-to-be-a-hero');
      if (sheetElement?._sheet) {
        app = sheetElement._sheet;
      }
    }
    
    // If still no app, try to use the sheet property that should be provided by AppV2 setup
    if (!app && this.sheet) {
      app = this.sheet;
    }
    
    // Last resort: if we still don't have an app, try again after a delay
    if (!app) {
      // Try again after the sheet has finished setting up
      setTimeout(() => {
        let retryApp = null;
        
        // Try all the same methods again
        const retryAppElement = this.closest(".how-to-be-a-hero");
        if (retryAppElement?._sheet) {
          retryApp = retryAppElement._sheet;
        } else if (this.sheet) {
          retryApp = this.sheet;
        }
        
        if (retryApp) {
          this.#app = retryApp;
          // Re-setup context menu now that we have the app
          this.setupContextMenu();
        } else {
          console.warn("Still no app found on retry");
        }
      }, 100);
    }
    
    this.#app = app;

    this._initializeFilterLists();

    if ( !this.canUse ) {
      for ( const element of this.querySelectorAll('[data-action="use"]') ) {
        element.dataset.action = null;
        element.closest(".rollable")?.classList.remove("rollable");
      }
    }

    for ( const input of this.querySelectorAll('input[type="number"]') ) {
      input.addEventListener("change", this._onChangeInput.bind(this));
    }

    for ( const input of this.querySelectorAll('input[inputmode="numeric"]') ) {
      input.addEventListener("change", this._onChangeInputDelta.bind(this));
    }

    for ( const button of this.querySelectorAll(".adjustment-button") ) {
      button.addEventListener("click", this._onAdjustInput.bind(this));
    }

    for ( const control of this.querySelectorAll(".item-action[data-action]") ) {
      control.addEventListener("click", event => {
        this._onAction(event.currentTarget, event.currentTarget.dataset.action);
      });
    }

    for ( const control of this.querySelectorAll("[data-context-menu]") ) {
      control.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const { clientX, clientY } = event;
        event.currentTarget.closest("[data-item-id]").dispatchEvent(new PointerEvent("contextmenu", {
          view: window, bubbles: true, cancelable: true, clientX, clientY
        }));
      });
    }

    this.setupContextMenu();
  }

  /* -------------------------------------------- */

  /**
   * Set up the context menu for items.
   */
  setupContextMenu() {
    new ContextMenuHTBAH(this, "[data-item-id]", [], {
      onOpen: this._onOpenContextMenu.bind(this),
      jQuery: false
    });
  }

  /* -------------------------------------------- */

  /**
   * Prepare filter lists and attach their listeners.
   * @protected
   */
  _initializeFilterLists() {
    const filterLists = this.querySelectorAll(".filter-list");
    if ( !this._app || !this._app._filters || !filterLists.length ) return;

    // Activate the set of filters which are currently applied
    for ( const list of filterLists ) {
      const state = this._app._filters[list.dataset.filter];
      if ( !state ) continue;
      const set = state.properties;
      const filters = list.querySelectorAll(".filter-item");
      for ( const filter of filters ) {
        if ( set.has(filter.dataset.filter) ) filter.classList.add("active");
        filter.addEventListener("click", () => {
          const f = filter.dataset.filter;
          if ( set.has(f) ) set.delete(f);
          else set.add(f);
          filter.classList.toggle("active", set.has(f));
          this._applyFilters(state);
        });
      }
      this._applyFilters(state);
    }
  }

  /* -------------------------------------------- */

  /**
   * TODO: Remove filtering code from htbah-inventory when all sheets use item-list-controls.
   * Apply the current set of filters to the inventory list.
   * @param {FilterState5e} state  The filter state to apply.
   * @protected
   */
  _applyFilters(state) {
    let items = this._app._filterItems?.(this._app.object.items, state.properties);
    if ( !items ) return;
    const elementMap = {};
    this.querySelectorAll(".inventory-list .item-list .item").forEach(el => {
      elementMap[el.dataset.itemId] = el;
      el.hidden = true;
    });
    for ( const item of items ) {
      const el = elementMap[item.id];
      if ( el ) el.hidden = false;
    }
  }

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Reference to the application that contains this component.
   * @type {Application}
   */
  #app;

  /**
   * Reference to the application that contains this component.
   * @type {Application}
   * @protected
   */
  get _app() { return this.#app; }

  /* -------------------------------------------- */

  /**
   * Can items be used directly from the inventory?
   * @type {boolean}
   */
  get canUse() {
    return !(!this.actor || !this.actor.isOwner || this.actor.pack);
  }

  /* -------------------------------------------- */

  /**
   * Containing actor for this inventory, either the document or its parent if document is an item.
   * @type {Actor|null}
   */
  get actor() {
    if ( !this.document ) return null;
    if ( this.document instanceof Actor ) return this.document;
    return this.document.actor ?? null;
  }

  /* -------------------------------------------- */

  /**
   * Document whose inventory is represented.
   * @type {Actor|Item}
   */
  get document() {
    return this._app?.document || null;
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /**
   * Retrieve an item with the specified ID.
   * @param {string} id
   * @returns {Item|Promise<Item>}
   */
  getItem(id) {
    if ( this.document.type === "container" ) return this.document.system.getContainedItem(id);
    return this.document.items.get(id);
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Prepare an array of context menu options which are available for inventory items.
   * @param {Item5e} item           The Item for which the context menu is activated.
   * @returns {ContextMenuEntry[]}  An array of context menu options offered for the Item.
   * @protected
   */
  _getContextOptions(item) {
    // Check if the sheet is in edit mode
    const isEditMode = this._app && this._app._mode === this._app.constructor.MODES.EDIT;
    
    // Standard Options
    const options = [
      {
        name: "HTBAH.ContextMenuActionEdit",
        icon: "<i class='fas fa-edit fa-fw'></i>",
        condition: () => item.isOwner && !isEditMode,
        callback: li => this._onAction(li, "edit")
      },
      {
        name: "HTBAH.ItemView",
        icon: '<i class="fas fa-eye"></i>',
        condition: () => !item.isOwner,
        callback: li => this._onAction(li, "view")
      },
      {
        name: "HTBAH.ContextMenuActionDuplicate",
        icon: "<i class='fas fa-copy fa-fw'></i>",
        condition: () => !item.system.metadata?.singleton && !["class", "subclass"].includes(item.type) && item.isOwner,
        callback: li => this._onAction(li, "duplicate")
      },
      {
        name: "HTBAH.ContextMenuActionDelete",
        icon: "<i class='fas fa-trash fa-fw'></i>",
        condition: () => item.isOwner && !isEditMode,
        callback: li => this._onAction(li, "delete")
      },
      {
        name: "HTBAH.ContextMenuActionGiveItem",
        icon: "<i class='fas fa-handshake fa-fw'></i>",
        condition: () => {
          const transferableTypes = ["item", "consumable", "weapon", "armor", "tool"];
          return item.isOwner && transferableTypes.includes(item.type);
        },
        callback: li => this._onAction(li, "giveItem")
      }
    ];

    if ( !this.actor || (this.actor.type === "group") ) return options;

    // Toggle Equipped State - only show in edit mode (in play mode it's shown as a button)
    if ( "equipped" in item.system ) options.push({
      name: item.system.equipped ? "HTBAH.Unequip" : "HTBAH.Equip",
      icon: "<i class='fas fa-shield-alt fa-fw'></i>",
      condition: () => item.isOwner && isEditMode,
      callback: li => this._onAction(li, "equip"),
      group: "state"
    });
    
    // Toggle Favorite State
    if ( ("favorites" in this.actor.system) ) {
      const uuid = item.getRelativeUUID(this.actor);
      const isFavorited = this.actor.system.hasFavorite(uuid);
      options.push({
        name: isFavorited ? "HTBAH.FavoriteRemove" : "HTBAH.Favorite",
        icon: "<i class='fas fa-star fa-fw'></i>",
        condition: () => item.isOwner,
        callback: li => this._onAction(li, isFavorited ? "unfavorite" : "favorite"),
        group: "state"
      });
    }

    return options;
  }

  /* -------------------------------------------- */

  /**
   * Handle changing the quantity or charges fields.
   * @param {Event} event  Triggering change event.
   * @returns {Promise}
   * @protected
   */
  async _onChangeInput(event) {
    const itemId = event.target.closest("[data-item-id]")?.dataset.itemId;
    if ( !itemId ) return;

    event.stopImmediatePropagation();
    const item = await this.getItem(itemId);
    const min = event.target.min !== "" ? Number(event.target.min) : -Infinity;
    const max = event.target.max !== "" ? Number(event.target.max) : Infinity;
    const value = Math.clamped(event.target.valueAsNumber, min, max);
    if ( !item || Number.isNaN(value) ) return;

    event.target.value = value;
    item.update({[event.target.dataset.name]: value});
  }

  /* -------------------------------------------- */

  /**
   * Handle input changes to numeric form fields, allowing them to accept delta-typed inputs.
   * @param {Event} event  Triggering event.
   * @protected
   */
  async _onChangeInputDelta(event) {
    const input = event.target;
    const itemId = input.closest("[data-item-id]")?.dataset.itemId;
    const item = await this.getItem(itemId);
    if ( !item ) return;
    const result = parseInputDelta(input, item);
    if ( result !== undefined ) item.update({ [input.dataset.name]: result });
  }

  /* -------------------------------------------- */

  /**
   * Handle incrementing or decrementing a numeric input.
   * @param {PointerEvent} event  The triggering event.
   * @protected
   */
  _onAdjustInput(event) {
    const button = event.currentTarget;
    const { action } = button.dataset;
    const input = button.parentElement.querySelector("input");
    const min = input.min ? Number(input.min) : -Infinity;
    const max = input.max ? Number(input.max) : Infinity;
    let value = Number(input.value);
    if ( isNaN(value) ) return;
    value += action === "increase" ? 1 : -1;
    input.value = Math.clamped(value, min, max);
    input.dispatchEvent(new Event("change"));
  }

  /* -------------------------------------------- */

  /**
   * Handle item actions.
   * @param {Element} target  Button or context menu entry that triggered this action.
   * @param {string} action   Action being triggered.
   * @returns {Promise}
   * @protected
   */
  async _onAction(target, action) {
    const event = new CustomEvent("inventory", {
      bubbles: true,
      cancelable: true,
      detail: action
    });
    if ( target.dispatchEvent(event) === false ) return;

    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = await this.getItem(itemId);
    if ( !["create", "currency"].includes(action) && !item ) return;

    switch ( action ) {
      case "create":
        if ( this.document.type === "container" ) return;
        return this._onCreate(target);
      case "crew":
        return item.update({"system.crewed": !item.system.crewed});
      case "delete":
        return item.deleteDialog();
      case "duplicate":
        return item.clone({name: game.i18n.format("DOCUMENT.CopyOf", {name: item.name})}, {save: true});
      case "edit":
      case "view":
        return item.sheet.render(true);
      case "equip":
        return item.update({"system.equipped": !item.system.equipped});
      case "expand":
        return this._onExpand(target, item);
      case "favorite":
        return this.actor.system.addFavorite({
          type: item.type,
          id: `Actor.${this.actor.id}.Item.${item.id}` // Use the full UUID
        });
      case "unfavorite":
        return this.actor.system.removeFavorite(`Actor.${this.actor.id}.Item.${item.id}`); // Use the full UUID
      case "use":
        if (!this.actor?.isOwner && !game.user.isGM) return;
        return item.use({}, { event });
      case "giveItem":
        return this._onGiveItem(item);
    }
  }

  /* -------------------------------------------- */

  /**
   * Create a new item.
   * @param {HTMLElement} target  Button or context menu entry that triggered this action.
   * @returns {Promise<Item>}
   */
  async _onCreate(target) {
    const { type, ...dataset } = (target.closest(".spellbook-header") ?? target).dataset;
    delete dataset.action;
    delete dataset.tooltip;

    const itemData = {
      name: game.i18n.format("HTBAH.ItemNew", {type: game.i18n.localize(CONFIG.Item.typeLabels[type])}),
      type,
      system: foundry.utils.expandObject({ ...dataset })
    };
    delete itemData.system.type;
    return this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  /* -------------------------------------------- */

  /**
   * Expand or collapse an item's summary.
   * @param {HTMLElement} target  Button or context menu entry that triggered this action.
   * @param {Item} item         Item to being expanded or collapsed.
   */
  async _onExpand(target, item) {
    const li = target.closest("[data-item-id]");
    if ( this._app._expanded.has(item.id) ) {
      const summary = $(li.querySelector(".item-summary"));
      summary.slideUp(200, () => summary.remove());
      this._app._expanded.delete(item.id);
    } else {
      const enrichment = {secrets: this.document.isOwner};
      const chatData = item.system.getCardData ? item.system.getCardData(enrichment) : item.getChatData(enrichment);
      const summary = $(await foundry.applications.handlebars.renderTemplate("systems/how-to-be-a-hero/templates/items/parts/item-summary.hbs", await chatData));
      $(li).append(summary.hide());
      summary.slideDown(200);
      this._app._expanded.add(item.id);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle giving an item to another actor.
   * @param {Item} item  Item to give away.
   * @returns {Promise}
   * @protected
   */
  async _onGiveItem(item) {
    return ActorSelectorDialog.show(item);
  }

  /* -------------------------------------------- */

  /**
   * Handle opening the context menu.
   * @param {HTMLElement} element  The element the context menu was triggered on.
   * @protected
   */
  _onOpenContextMenu(element) {
    const item = this.getItem(element.closest("[data-item-id]")?.dataset.itemId);
    if ( !item || (item instanceof Promise) ) return;
    ui.context.menuItems = this._getContextOptions(item);
    Hooks.call("HTBAH.getItemContextOptions", item, ui.context.menuItems);
  }
}
