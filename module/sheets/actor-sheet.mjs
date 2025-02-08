import { HowToBeAHeroActor } from '../documents/actor.mjs';
import { HowToBeAHeroDragDropHandler } from '../helpers/drag-drop-handler.mjs';
import { formatNumber, simplifyBonus, staticID } from "../helpers/utils.mjs";

/**
 * A specialized subclass of Tabs that handles tabs which exist outside an Application's inner HTML.
 * @extends {Tabs}
 */
class TabsHtbah extends Tabs {
  /** @override */
  bind(html) {
    super.bind(html);
    this._nav = this._nav || html.closest(".app")?.querySelector(this._navSelector);
    if (this._nav) this._nav.addEventListener("click", this._onClickNav.bind(this));
    this._content = html.querySelector(this._contentSelector) || html.closest(".app")?.querySelector(this._contentSelector);
    this.activate(this.active);
  }

  /** @override */
  activate(tabName, {triggerCallback=false}={}) {
    if (!this._nav) return false;
    const result = super.activate(tabName, {triggerCallback});
    
    if (this._content) {
      this._content.querySelectorAll(`.tab[data-tab]`).forEach(t => {
        t.classList.toggle("active", t.dataset.tab === tabName);
      });
    }

    const form = this._nav.closest("form");
    if (form) {
      form.className = form.className.replace(/tab-\w+/g, "");
      form.classList.add(`tab-${this.active}`);
    }

    return result;
  }
}

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class HowToBeAHeroActorSheet extends ActorSheet {
  constructor(object, options={}) {
    const key = `character${object.limited ? ":limited" : ""}`;
    const { width, height } = game.user.getFlag("how-to-be-a-hero", `sheetPrefs.${key}`) ?? {};
    if (width) options.width = width;
    if (height) options.height = height;
    super(object, options);
    this.dragDropHandler = new HowToBeAHeroDragDropHandler(this);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['how-to-be-a-hero', 'sheet', 'actor', 'character'],
      tabs: [{
        navSelector: '.tabs',
        contentSelector: '.sheet-body .tab-body',
        initial: 'details',
        group: "primary"
      }],
      dragDrop: [
        {dragSelector: ".item-list .item", dropSelector: ".favorites"},
        {dragSelector: ".favorites [data-favorite-id]", dropSelector: ".favorites"}
      ],
      scrollY: [".main-content"],
      width: 1000,
      height: 1000,
      resizable: true
    });
  }

  static MODES = { PLAY: 1, EDIT: 2 };
  
  static TABS = [
    { tab: "details", label: "HTBAH.Details", icon: "fas fa-cog" },
    { tab: "inventory", label: "HTBAH.Inventory", svg: "backpack" },
    { tab: "effects", label: "HTBAH.Effects", icon: "fas fa-bolt" },
    { tab: "biography", label: "HTBAH.Biography", icon: "fas fa-feather" }
  ];

  _mode = this.constructor.MODES.PLAY;

  get template() {
    return `systems/how-to-be-a-hero/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  _createTabHandlers() {
    return this.options.tabs.map(t => new TabsHtbah(foundry.utils.mergeObject({
      navSelector: ".tabs",
      contentSelector: ".tab-body",
      initial: "details",
      group: "primary",
      callback: this._onChangeTab.bind(this)
    }, t)));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _renderOuter() {
    const html = await super._renderOuter();
    const header = html[0].querySelector(".window-header");
    
    // Add edit <-> play slide toggle.
    if ( this.isEditable ) {
      const toggle = document.createElement("slide-toggle");
      toggle.checked = this._mode === this.constructor.MODES.EDIT;
      toggle.classList.add("mode-slider");
      toggle.dataset.tooltip = "HTBAH.SheetModeEdit";
      toggle.setAttribute("aria-label", game.i18n.localize("HTBAH.SheetModeEdit"));
      toggle.addEventListener("change", this._onChangeSheetMode.bind(this));
      toggle.addEventListener("dblclick", event => event.stopPropagation());
      header.insertAdjacentElement("afterbegin", toggle);
    }
    
    // Adjust header buttons.
    header.querySelectorAll(".header-button").forEach(btn => {
      const label = btn.querySelector(":scope > i").nextSibling;
      btn.dataset.tooltip = label.textContent;
      btn.setAttribute("aria-label", label.textContent);
      label.remove();
    });

    const idLink = header.querySelector(".document-id-link");
    if ( idLink ) {
      const firstButton = header.querySelector(".header-button");
      firstButton?.insertAdjacentElement("beforebegin", idLink);
    }

    /*
    if ( !game.user.isGM && this.actor.limited ) {
      html[0].classList.add("limited");
      return html;
    }
    */
    // Render tabs.
    const nav = document.createElement("nav");
    nav.classList.add("tabs");
    nav.dataset.group = "primary";
    nav.append(...this.constructor.TABS.map(({ tab, label, icon, svg }) => {
      const item = document.createElement("a");
      item.classList.add("item", "control");
      item.dataset.group = "primary";
      item.dataset.tab = tab;
      item.dataset.tooltip = game.i18n.localize(label);
      if (icon) item.innerHTML = `<i class="${icon}"></i>`;
      else if (svg) item.innerHTML = `<htbah-icon src="systems/how-to-be-a-hero/ui/icons/svg/${svg}.svg"></htbah-icon>`;
      item.setAttribute("aria-label", game.i18n.localize(label));
      return item;
    }));
    html[0].insertAdjacentElement("afterbegin", nav);

    return html;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _render(force = false, options = {}) {
    // Store the current active tab before rendering
    const currentActiveTab = this._activeTab || 'details';

    await super._render(force, options);
    
    if (!this.rendered) return;

    const context = options.renderContext ?? options.action;
    const data = options.renderData ?? options.data;
    const isUpdate = (context === "update") || (context === "updateActor");
    const hp = foundry.utils.getProperty(data ?? {}, "system.attributes.hp.value");

    // Restore the active tab after rendering
    if (currentActiveTab) {
      this._tabs.forEach(t => {
        if (t instanceof TabsHtbah) {
          t.active = currentActiveTab;
        }
      });

      // Ensure the correct tab content is displayed
      this._activateTab(currentActiveTab);
    }
  }
  
  /* -------------------------------------------- */

  /**
   * Activate a specific tab
   * @param {string} tabName - The name of the tab to activate
   * @private
   */
  _activateTab(tabName) {
    const content = this.element[0].querySelector('.sheet-body .tab-body');
    if (content) {
      content.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });
    }

    // Update the form's class
    this.element[0].className = this.element[0].className.replace(/tab-\w+/g, "");
    this.element[0].classList.add(`tab-${tabName}`);

    // Ensure _activeTab is updated
    this._activeTab = tabName;
  }

  /* -------------------------------------------- */

  /**
 * @typedef {Object} GetDataOptions
 * @property {boolean} [editable] - Whether the sheet is editable
 */

/**
 * @typedef {Object} SheetContext
 * @property {boolean} editable - Whether the sheet is editable
 * @property {string} cssClass - CSS classes for the sheet
 * @property {Object} portrait - Portrait data
 * @property {number} healthPercentage - Character's health percentage
 * @property {Object} system - Actor's system data
 * @property {Object} flags - Actor's flags
 * @property {string} rollableClass - CSS class for rollable elements
 * @property {Object} rollData - Roll data for TinyMCE editors
 * @property {Array} effects - Prepared active effects
 */

/** @override */
async getData(options) {
  const context = await super.getData(options);
  
  await Promise.all([
    this._prepareBasicContext(context, options),
    this._preparePortraitData(context),
    this._prepareHealthData(context),
    this._prepareActorData(context),
    this._prepareHeaderItems().then(items => context.headerItems = items),
    this._prepareItemsAndEffects(context)
  ]);

  if (this.actor.type === "character") {
    context.favorites = await this._prepareFavorites();
    context.favorites.sort((a, b) => a.sort - b.sort);
  }

  return context;
}

/**
 * Prepares basic context data
 * @param {SheetContext} context
 * @param {GetDataOptions} options
 */
_prepareBasicContext(context, options) {
  context.editable = this.isEditable && (this._mode === this.constructor.MODES.EDIT);
  context.cssClass = this._getContextCssClass(context.editable);
  context.rollableClass = this.isEditable ? 'rollable' : '';
}

/**
 * Generates CSS class string for the context
 * @param {boolean} editable
 * @returns {string}
 */
_getContextCssClass(editable) {
  const baseClass = editable ? 'editable' : this.isEditable ? 'interactable' : 'locked';
  const activeTab = this._getActiveTab();
  const sidebarClass = this._getSidebarClass(activeTab);
  const actorType = this.actor.type;
  //return `${baseClass} ${sidebarClass}`;
  return `${baseClass} ${actorType} ${sidebarClass}`;
}

/**
 * Determines the active tab
 * @returns {string}
 */
_getActiveTab() {
  return (game.user.isGM || !this.actor.limited) ? this._tabs?.[0]?.active ?? 'details' : 'biography';
}

/**
 * Determines sidebar class based on user preferences
 * @param {string} activeTab
 * @returns {string}
 */
_getSidebarClass(activeTab) {
  const SIDEBAR_PREF_KEY = 'how-to-be-a-hero';
  const sidebarCollapsed = game.user.getFlag(SIDEBAR_PREF_KEY, `sheetPrefs.character.tabs.${activeTab}.collapseSidebar`);
  return sidebarCollapsed ? ' collapsed' : '';
}

/**
 * Prepares portrait data for the context
 * @param {SheetContext} context
 */
_preparePortraitData(context) {
  const PORTRAIT_FLAG_KEY = 'how-to-be-a-hero';
  const showTokenPortrait = this.actor.getFlag(PORTRAIT_FLAG_KEY, 'showTokenPortrait') === true;
  const token = this.actor.isToken ? this.actor.token : this.actor.prototypeToken;
  
  context.portrait = {
    token: showTokenPortrait,
    src: showTokenPortrait ? token.texture.src : this.actor.img,
    path: showTokenPortrait ? (this.actor.isToken ? '' : 'prototypeToken.texture.src') : 'img'
  };
}

/**
 * Prepares health data for the context
 * @param {SheetContext} context
 */
_prepareHealthData(context) {
  const health = this.actor.system.baseattributes.health;
  context.healthPercentage = health.max ? (health.value / health.max) * 100 : 0;
}

/**
 * Prepares actor data for the context
 * @param {SheetContext} context
 */
_prepareActorData(context) {
  const actor = this.actor;
  const actorData = context.data;

  context.system = actorData.system;
  context.flags = actorData.flags;
  context.rollData = actor.getRollData();
  // Add any other actor-specific properties here
}

/**
 * Get the current header items for the character
 * @returns {Promise<Object>}
 * @protected
 */
async _prepareHeaderItems() {
  const headerItems = {
    skill: null,
    weapon: null
  };

  // Get the stored header item IDs from flags
  const skillId = this.actor.getFlag("how-to-be-a-hero", "headerSkill");
  const weaponId = this.actor.getFlag("how-to-be-a-hero", "headerWeapon");

  if (skillId) {
    const item = this.actor.items.get(skillId);
    if (item) {
      headerItems.skill = {
        id: item.id,
        name: item.name,
        img: item.img,
        type: item.type
      };
    }
  }

  if (weaponId) {
    const item = this.actor.items.get(weaponId);
    if (item) {
      headerItems.weapon = {
        id: item.id,
        name: item.name,
        img: item.img,
        type: item.type
      };
    }
  }

  return headerItems;
}

/**
 * Prepares items and effects for the context
 * @param {SheetContext} context
 */
async _prepareItemsAndEffects(context) {
  const actorData = context.data;
  
  if (actorData.type === 'character') {
    await this._prepareCharacterData(context);
    await this._prepareItems(context);
  } else if (actorData.type === 'npc') {
    await this._prepareNPCData(context);
    await this._prepareItems(context);
  }
  
  await this._prepareEffects(context);
}

/**
 * Prepares effects for the context
 * @param {SheetContext} context
 */
async _prepareEffects(context) {
  // Conditions
  if (game.howtobeahero?.managers?.conditions) {
    context.conditions = game.howtobeahero.managers.conditions.getAllConditions().map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      disabled: !game.howtobeahero.managers.conditions.isConditionActive(this.actor, c)
    }));
  } else {
    console.warn('HowToBeAHero | ConditionManager not available. Skipping condition preparation.');
    context.conditions = [];
  }

  // Effects
  if (game.howtobeahero?.managers?.effects) {
    context.effects = game.howtobeahero.managers.effects.prepareActiveEffectCategories(this.actor.effects);
    
    // ... rest of the effects preparation ...
  } else {
    console.warn('HowToBeAHero | EffectsManager not available. Skipping effects preparation.');
    context.effects = {};
  }
}

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    //super._prepareCharacterData();
    //if ( ("how-to-be-a-hero" in this.flags) && this._systemFlagsDataModel ) {
      //this.flags.howtobeahero = new this._systemFlagsDataModel(this._source.flags.howtobeahero, { parent: this });
    //}
    // Handle talent scores
    // Talent Scores
    context.talentRows = Object.entries(context.system.baseattributes.talents).reduce((obj, [k, talent]) => {
      talent.key = k;
      talent.abbr = game.i18n.localize(CONFIG.HTBAH.talents[k]?.abbreviation) ?? "";
      talent.long = game.i18n.localize(CONFIG.HTBAH.talents[k]?.long) ?? "";
      //talent.sign = Math.sign(ability.mod) < 0 ? "-" : "+";
      //talent.mod = Math.abs(ability.mod);
      talent.baseValue = context.system.baseattributes.talents[k]?.value ?? 0;
      switch (k) {
        case 'knowledge':
            obj.knowledge.push(talent);
            break;
        case 'action':
            obj.action.push(talent);
            break;
        case 'social':
            obj.social.push(talent);
            break;
        default:
            // Handle talents that do not fit into any category if necessary
            break;
      }
      return obj;
    }, { knowledge: [], action: [], social: []  });
    context.talentRows.optional = Object.keys(CONFIG.HTBAH.talents).length - 6;
    for (let [k, v] of Object.entries(context.system.baseattributes.talents)) {
       v.label = game.i18n.localize(CONFIG.HTBAH.talents[k].label) ?? k;
     }
  }
  
  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareNPCData(context) {
    //super._prepareCharacterData();
    //if ( ("how-to-be-a-hero" in this.flags) && this._systemFlagsDataModel ) {
      //this.flags.howtobeahero = new this._systemFlagsDataModel(this._source.flags.howtobeahero, { parent: this });
    //}
    // Handle talent scores
    // Talent Scores
    context.talentRows = Object.entries(context.system.baseattributes.talents).reduce((obj, [k, talent]) => {
      talent.key = k;
      talent.abbr = game.i18n.localize(CONFIG.HTBAH.talents[k]?.abbreviation) ?? "";
      talent.long = game.i18n.localize(CONFIG.HTBAH.talents[k]?.long) ?? "";
      //talent.sign = Math.sign(ability.mod) < 0 ? "-" : "+";
      //talent.mod = Math.abs(ability.mod);
      talent.baseValue = context.system.baseattributes.talents[k]?.value ?? 0;
      switch (k) {
        case 'knowledge':
            obj.knowledge.push(talent);
            break;
        case 'action':
            obj.action.push(talent);
            break;
        case 'social':
            obj.social.push(talent);
            break;
        default:
            // Handle talents that do not fit into any category if necessary
            break;
      }
      return obj;
    }, { knowledge: [], action: [], social: []  });
    context.talentRows.optional = Object.keys(CONFIG.HTBAH.talents).length - 6;
    for (let [k, v] of Object.entries(context.system.baseattributes.talents)) {
       v.label = game.i18n.localize(CONFIG.HTBAH.talents[k].label) ?? k;
     }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} context The context object to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const items = [];
    const consumables = [];
    const weapons = [];
    const armors = [];
    const tools = [];

    const all = [];

    const knowledge = [];
    const action = [];
    const social = [];

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      
      // Prepare item data
      const itemData = i.system;
      
      // Prepare context data
      const ctx = {
        subtitle: this._getItemSubtitle(i),
        equip: this._getEquipData(i),
        quantity: itemData.quantity,
        description: itemData.description
      };

      // Add type-specific properties
      switch(i.type) {
        case 'consumable':
        case 'item':
          ctx.roll = itemData.roll;
          ctx.formula = itemData.formula;
          break;
        case 'armor':
          ctx.armor = itemData.armor;
          break;
        case 'tool':
          ctx.hasUses = true;
          break;
      }

      // Add item properties
      /*
      const properties = this._getItemProperties(i);
      ctx.properties = properties.map(p => ({
        label: p,
        icon: CONFIG.HTBAH.propertyIcons[p] || null
      }));
      */

      // Append to appropriate array
      const itemWithContext = { ...i, ctx };
      switch (i.type) {
        case 'item':
          items.push(itemWithContext);
          break;
        case 'consumable':
          consumables.push(itemWithContext);
          break;
        case 'weapon':
          weapons.push(itemWithContext);
          break;
        case 'armor':
          armors.push(itemWithContext);
          break;
        case 'tool':
          tools.push(itemWithContext);
          break;
        case 'knowledge':
          knowledge.push(itemWithContext);
          break;
        case 'action':
          action.push(itemWithContext);
          break;
        case 'social':
          social.push(itemWithContext);
          break;
      }
    }

    // Assign and return
    context.all = all;
    context.items = items;
    context.consumables = consumables;
    context.weapons = weapons;
    context.armors = armors;
    context.tools = tools;
    context.knowledge = knowledge;
    context.action = action;
    context.social = social;

    // Create sections array for use in the template
    context.sections = [
      { label: "HTBAH.ItemPl", dataset: { type: "item" }, items: items },
      { label: "HTBAH.consumablePl", dataset: { type: "consumable" }, items: consumables },
      { label: "HTBAH.weaponPl", dataset: { type: "weapon" }, items: weapons },
      { label: "HTBAH.armorPl", dataset: { type: "armor" }, items: armors },
      { label: "HTBAH.toolPl", dataset: { type: "tool" }, items: tools },
      { label: "HTBAH.Names", dataset: { type: "all" }, items: all }
      /*
      { label: "HTBAH.ItemTypeKnowledge", dataset: { type: "knowledge" }, items: knowledge },
      { label: "HTBAH.ItemTypeAction", dataset: { type: "action" }, items: action },
      { label: "HTBAH.ItemTypeSocial", dataset: { type: "social" }, items: social }
       */
    ];

    // Remove empty sections
    //context.sections = context.sections.filter(s => s.items.length > 0);

    // Sort items within each section
    for (let section of context.sections) {
      section.items?.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    }
  }

  /**
   * Get the subtitle for an item
   * @param {Object} item
   * @returns {string|null}
   * @private
   */
  _getItemSubtitle(item) {
    switch(item.type) {
      case 'weapon':
        return `${item.system.formula}`;
      case 'armor':
        return `Armor: ${item.system.armor}`;
      case 'tool':
      case 'consumable':
      case 'item':
        return item.system.type || null;
      default:
        return null;
    }
  }

  /**
   * Get equip data for an item
   * @param {Object} item
   * @returns {Object}
   * @private
   */
  _getEquipData(item) {
    const isEquippable = ['weapon', 'armor'].includes(item.type);
    if (!isEquippable) return { applicable: false };

    return {
      applicable: true,
      cls: item.system.equipped ? "active" : "",
      title: `HTBAH.${item.system.equipped ? "Equipped" : "Unequipped"}`,
      disabled: !this.isEditable
    };
  }

/* -------------------------------------------- */
/*  Drop handling                               */
/* -------------------------------------------- */
/** @override */
_onDropItem(event, data) {
  if (!event.target.closest(".favorites")) return super._onDropItem(event, data);
  
  // For favorites, just store the reference
  event.preventDefault();
  const itemId = data.uuid.split('.').pop();
  return this._onDropFavorite(event, { type: "item", id: itemId });
}

/**
 * Handle dropping an item in a header slot
 * @param {DragEvent} event - The drop event
 * @param {string} dropZone - The drop zone identifier ("skill" or "weapon")
 * @returns {Promise<void>}
 * @private
 */
async _onHeaderDrop(event, dropZone) {
  event.preventDefault();
  
  let data;
  try {
    data = JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch(e) {
    return false;
  }

  // Validate the drop
  if (data.type !== "Item") return false;

  const item = await Item.implementation.fromDropData(data);
  if (!item) return false;

  // Validate item type based on drop zone
  if (dropZone === "skill" && !["knowledge", "social", "action"].includes(item.type)) {
    ui.notifications.warn(game.i18n.localize("HTBAH.WarningOnlySkillsAllowed"));
    return false;
  }
  
  if (dropZone === "weapon" && item.type !== "weapon") {
    ui.notifications.warn(game.i18n.localize("HTBAH.WarningOnlyWeaponsAllowed"));
    return false;
  }
  await this._setHeaderItem(dropZone, item.id);
}

/**
 * Set an item as a header item
 * @param {string} slot - The header slot ("skill" or "weapon")
 * @param {string} itemId - The item ID
 * @returns {Promise<Actor>}
 * @private
 */
async _setHeaderItem(slot, itemId) {
  const flagKey = slot === "skill" ? "headerSkill" : "headerWeapon";
  return this.actor.setFlag("how-to-be-a-hero", flagKey, itemId);
}

/**
 * Remove an item from a header slot
 * @param {string} slot - The header slot ("skill" or "weapon")
 * @returns {Promise<Actor>}
 * @private
 */
async _removeHeaderItem(slot) {
  const flagKey = slot === "skill" ? "headerSkill" : "headerWeapon";
  return this.actor.unsetFlag("how-to-be-a-hero", flagKey);
}

/* -------------------------------------------- */

/**
 * Handle an owned item or effect being dropped in the favorites area.
 * @param {PointerEvent} event         The triggering event.
 * @param {ActorFavoritesHTBAH} favorite  The favorite that was dropped.
 * @returns {Promise<ActorHTBAH>|void}
 * @protected
 */
async _onDropFavorite(event, favorite) {
  event.preventDefault();
  event.stopPropagation();

  // Check if it's already a favorite
  if (this.actor.system.hasFavorite(favorite.id)) {
    return this._onSortFavorites(event, favorite.id);
  }

  // Add as favorite using just the item ID
  return this.actor.system.addFavorite({
    type: "item",
    id: `Actor.${this.actor.id}.Item.${favorite.id}` // Use full UUID format
  });
}

/* -------------------------------------------- */

/**
 * Handle removing a favorite.
 * @param {PointerEvent} event  The triggering event.
 * @returns {Promise<ActorHTBAH>|void}
 * @protected
 */
_onRemoveFavorite(event) {
  const { favoriteId } = event.currentTarget.closest("[data-favorite-id]")?.dataset ?? {};
  if ( !favoriteId ) return;
  return this.actor.system.removeFavorite(favoriteId);
}

/* -------------------------------------------- */

/**
 * Handle re-ordering the favorites list.
 * @param {DragEvent} event  The drop event.
 * @param {string} srcId     The identifier of the dropped favorite.
 * @returns {Promise<ActorHTBAH>|void}
 * @protected
 */
async _onSortFavorites(event, srcId) {
  const dropTarget = event.target.closest("[data-favorite-id]");
  if (!dropTarget) return;
  const targetId = dropTarget.dataset.favoriteId;
  if (srcId === targetId) return;

  // Wait for all favorites to be resolved
  const favorites = await Promise.all(this.actor.system.favorites.map(async f => {
    if (f.id === targetId || f.id === srcId) {
      const resolved = await fromUuid(f.id);  // Changed from fromUuidSync
      return { ...f, resolved };
    }
    return f;
  }));

  const source = favorites.find(f => f.id === srcId);
  const target = favorites.find(f => f.id === targetId);
  const siblings = favorites.filter(f => f.id !== srcId);

  const updates = SortingHelpers.performIntegerSort(source, { target, siblings });
  const favoritesMap = favorites.reduce((map, f) => map.set(f.id, { ...f }), new Map());
  
  for (const { target, update } of updates) {
    const favorite = favoritesMap.get(target.id);
    foundry.utils.mergeObject(favorite, update);
  }

  return this.actor.update({ "system.favorites": Array.from(favoritesMap.values()) });
}

/* -------------------------------------------- */

/**
 * Handle using a favorited item.
 * @param {PointerEvent} event  The triggering event.
 * @returns {Promise|void}
 * @protected
 */
async _onUseFavorite(event) {
  const { favoriteId } = event.currentTarget.closest("[data-favorite-id]").dataset;
  const favorite = await fromUuid(favoriteId, { relative: this.actor });  // Changed from fromUuidSync
  if (favorite instanceof HowToBeAHeroItemBase) return favorite.use({}, { event });
  if (favorite instanceof ActiveEffect) return favorite.update({ disabled: !favorite.disabled });
}
  /* -------------------------------------------- */

  /**
   * Get favorite data for a specific type and ID
   * @param {string} type - The type of favorite
   * @param {string} id - The ID of the favorite
   * @returns {Promise<Object|null>} The favorite data
   * @private
   */
  async _getFavoriteData(type, id) {
    // Handle different types of favorites
    switch(type) {
      case 'effect':
        const effect = await fromUuid(id);
        if (!effect) return null;
        return {
          img: effect.icon,
          title: effect.label,
          subtitle: effect.description,
          toggle: !effect.disabled
        };
        
      default:
        const item = await fromUuid(id);
        if (!item) return null;
        return {
          img: item.img,
          title: item.name,
          subtitle: this._getItemSubtitle(item),
          value: item.system.value,
          uses: item.system.uses,
          quantity: item.system.quantity,
          toggle: item.system.equipped !== undefined ? item.system.equipped : undefined
        };
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare favorites for display.
   * @returns {Promise<object>}
   * @protected
   */
  async _prepareFavorites() {
    const favoritePromises = this.actor.system.favorites.map(async f => {
      const { id, type, sort } = f;
      const favorite = await fromUuid(id);
      if (!favorite && ((type === "item") || (type === "effect"))) return null;
  
      let data;
      if (type === "item") data = await favorite.system.getFavoriteData();
      else if (type === "effect") data = await favorite.getFavoriteData();
      else data = await this._getFavoriteData(type, id);
      if (!data) return null;
  
      const { img, title, subtitle, value, uses, quantity, modifier, passive, save, range, reference, toggle, suppressed, level } = data;
  
      const css = [];
      if (uses) css.push("uses");
      else if (modifier !== undefined) css.push("modifier");
      else if (save?.dc) css.push("save");
      else if (value !== undefined) css.push("value");
  
      if (toggle === false) css.push("disabled");
      if (uses?.max > 100) css.push("uses-sm");
      if (modifier !== undefined) {
        const value = Number(modifier.replace?.(/\s+/g, "") ?? modifier);
        if (!isNaN(value)) modifier = { abs: Math.abs(value), sign: value < 0 ? "-" : "+" };
      }
  
      const rollableClass = [];
      if (this.isEditable && (type !== "slots")) rollableClass.push("rollable");
      if (type === "skill") rollableClass.push("skill-name");
      else if (type === "tool") rollableClass.push("tool-name");
  
      if (suppressed) subtitle = game.i18n.localize("DND5E.Suppressed");
      
      return {
        id, img, type, title, value, uses, sort, save, modifier, passive, range, reference, suppressed, level,
        itemId: type === "item" ? favorite.id : null,
        effectId: type === "effect" ? favorite.id : null,
        parentId: (type === "effect") && (favorite.parent !== favorite.target) ? favorite.parent.id : null,
        preparationMode: type === "slots" ? id === "pact" ? "pact" : "prepared" : null,
        key: (type === "skill") || (type === "tool") ? id : null,
        toggle: toggle === undefined ? null : { applicable: true, value: toggle },
        quantity: quantity > 1 ? quantity : "",
        rollableClass: rollableClass.filterJoin(" "),
        css: css.filterJoin(" "),
        bareName: type === "slots",
        subtitle: Array.isArray(subtitle) ? subtitle.filterJoin(" &bull; ") : subtitle
      };
    });
  
    // Wait for all promises to resolve and filter out null values
    const resolvedFavorites = (await Promise.all(favoritePromises)).filter(f => f !== null);
    return resolvedFavorites;
  }

  /**
   * Get properties for an item
   * @param {Object} item
   * @returns {string[]}
   * @private
   */
  _getItemProperties(item) {
    const properties = [];
    
    // Add type-specific properties
    switch(item.type) {
      case 'weapon':
        properties.push(item.system.roll.diceSize);
        break;
      case 'armor':
        properties.push(`Armor ${item.system.armor}`);
        break;
      case 'consumable':
      case 'item':
        if (item.system.type) properties.push(item.system.type);
        break;
    }

    // Add quantity if more than 1
    if (item.system.quantity > 1) {
      properties.push(`Qty: ${item.system.quantity}`);
    }

    return properties;
  }

  /* -------------------------------------------- */
  /* activateListener                             */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Common listeners
    this._activateCommonListeners(html);
    
    // Edit mode only listeners
    if (this.isEditable) {
      this._activateEditModeListeners(html);
    }

    // Header roll handlers
    html.find('.header-item').on('click', ev => {
      // Don't trigger on remove button clicks
      if (ev.target.closest('.item-remove')) return;
      
      const item = ev.currentTarget;
      const action = item.dataset.action;
      
      switch(action) {
        case 'rollSkill':
          return this._onRollHeaderSkill(ev);
        case 'rollWeapon':
          return this._onRollHeaderWeapon(ev);
      }
    });

    // Add wealth roll listener
    html.find('.wealth-roll').on('click', this._onRollWealth.bind(this));

    // Initiative roll handler
    html.find('.header-stat-column .fa-dice-d20').parent().on('click', this._onRollInitiative.bind(this));

    // Handle number input changes
    html.find('input[type="number"]').change(this._onNumberChange.bind(this));

    // Initialize tabs
    this._tabs = this._createTabHandlers();
    this._tabs.forEach(tabSet => {
      tabSet.activate(tabSet.active);
      this._onChangeTab(null, tabSet, tabSet.active);
    });
  }

  _activateCommonListeners(html) {
    const commonSelectors = {
      ".pips[data-prop]": this._onTogglePip,
      "[data-action]": this._onAction,
      "[data-action]": this._onItemAction,
      ".rollable:is(.talent-check)": this._onRollTalent,
      ".item-roll": this._onItemRoll,
      ".create-child": this._onCreateChild
    };

    Object.entries(commonSelectors).forEach(([selector, handler]) => {
      html.find(selector).on("click", handler.bind(this));
    });
    
    // Add bonus input change handlers
    html.find('.item-bonus input[name="system.roll.diceBonus"]').on('change', this._onBonusInputChange.bind(this));

    // Apply tooltips
    this._initializeTooltips();
  }

  _activateEditModeListeners(html) {
    // Add drag and drop functionality
    if (this.actor.isOwner) {
      this._initializeDragDrop(html);
    }

    // Favorites and header item management
    html.find('.deletion-control[data-action="removeFavorite"]').on('click', this._onRemoveFavorite.bind(this));
    html.find('.item-remove[data-action="removeSkill"]').click(event => {
      event.preventDefault();
      this._removeHeaderItem("skill");
    });
    
    html.find('.item-remove[data-action="removeWeapon"]').click(event => {
      event.preventDefault();
      this._removeHeaderItem("weapon");
    });
    
    html.find(".meter > .hit-points").on("click", event => this._toggleEditHP(event, true));
    html.find(".meter > .hit-points > input").on("blur", event => this._toggleEditHP(event, false));
  }

  _initializeTooltips() {
    this.form.querySelectorAll(".item-tooltip").forEach(this._applyItemTooltips.bind(this));
    this.form.querySelectorAll("[data-reference-tooltip]").forEach(this._applyReferenceTooltips.bind(this));
  }

  _initializeDragDrop(html) {
    html.find('li.item').each((i, li) => {
      if (!li.classList.contains('inventory-header')) {
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', this.dragDropHandler.onDragStart.bind(this.dragDropHandler), false);
      }
    });

    html.find('.favorites, .header-stat-column').each((i, zone) => {
      zone.addEventListener('dragover', this.dragDropHandler.onDragOver.bind(this.dragDropHandler));
      zone.addEventListener('drop', this.dragDropHandler.onDrop.bind(this.dragDropHandler));
    });
  }

  async _onRollInitiative(event) {
    event.preventDefault();
    return this.actor.rollInitiative({createCombatants: true});
  }
  
  async _onRollHeaderSkill(event) {
    event.preventDefault();
    const skillId = this.actor.getFlag("how-to-be-a-hero", "headerSkill");
    if (!skillId) return;
    
    const item = this.actor.items.get(skillId);
    if (!item) return;
    
    return item.roll();
  }
  
  async _onRollHeaderWeapon(event) {
    event.preventDefault();
    const weaponId = this.actor.getFlag("how-to-be-a-hero", "headerWeapon");
    if (!weaponId) return;
    
    const item = this.actor.items.get(weaponId);
    if (!item) return;
    
    return item.roll();
  }

  _onNumberChange(event) {
    event.preventDefault();
    const input = event.currentTarget;
    const value = input.value;
    const name = input.name;
    
    this.actor.update({[name]: value});
  }
  /**
     * Handle wealth roll button click
     * @param {Event} event The originating click event
     * @private
     */
  async _onRollWealth(event) {
    event.preventDefault();
    await this.actor.rollWealth();
  }

  /* -------------------------------------------- */

  /**
   * Clamps a bonus value between -99 and 99
   * @param {number} value - The value to clamp
   * @returns {number} The clamped value
   * @private
   */
  _clampBonus(value) {
    return Math.min(Math.max(value, -99), 99);
  }

  async _onItemBonusClick(event) {
    const itemId = event.currentTarget.closest('[data-item-id]').dataset.itemId;
    const item = this.actor.items.get(itemId);
    const delta = event.currentTarget.dataset.action === "incrementBonus" ? 1 : -1;
    const currentBonus = Number(item.system.roll.diceBonus) || 0;
    const newBonus = this._clampBonus(currentBonus + delta);
    
    if (newBonus !== currentBonus) {
      await item.update({"system.roll.diceBonus": newBonus});
    }
  }

  // Updated _onBonusInputChange method
  async _onBonusInputChange(event) {
    event.preventDefault();
    const input = event.currentTarget;
    const itemId = input.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;

    const item = this.actor.items.get(itemId);
    if (!item) return;

    const newValue = Math.clamped(Number(input.value) || 0, -99, 99);
    if (isNaN(newValue)) return;

    // Update the item with the new bonus value
    await item.update({
        "system.roll.diceBonus": newValue
    });

    // Update the input value to show the clamped value
    input.value = newValue;
  }
  
  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[talent] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }
  
  _onItemRoll(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) {
      item.roll();
    }
  }
  /* -------------------------------------------- */

  /** @override */
  _disableOverriddenFields(html) {
    // When in edit mode, field values will be the base value, rather than the derived value, so it should not be
    // necessary to disable them anymore.
  }

  /* -------------------------------------------- */

  /** @override */
  _getSubmitData(updateData={}) {
    // Skip over ActorSheet#_getSubmitData to allow for editing overridden values.
    return FormApplication.prototype._getSubmitData.call(this, updateData);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _disableFields(form) {
    super._disableFields(form);
    form.querySelectorAll(".interface-only").forEach(input => input.disabled = false);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeTab(event, tabs, active) {
    super._onChangeTab(event, tabs, active);
    this._activeTab = active;
    this._activateTab(active);
  
    // Update the active tab for all TabsHtbah instances
    this._tabs.forEach(tab => {
      if (tab instanceof TabsHtbah) {
        tab.active = active;
      }
    });

    // Update the create child button
    const createChild = this.form.querySelector(".create-child");
    if (createChild) {
      createChild.setAttribute("aria-label", game.i18n.format("SIDEBAR.Create", {
        type: game.i18n.localize(`DOCUMENT.${active === "effects" ? "ActiveEffect" : "Item"}`)
      }));
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async activateEditor(name, options={}, initialContent="") {
    options.relativeLinks = true;
    options.plugins = {
      menu: ProseMirror.ProseMirrorMenu.build(ProseMirror.defaultSchema, {
        compact: true,
        destroyOnSave: false,
        onSave: () => this.saveEditor(name, { remove: false })
      })
    };
    return super.activateEditor(name, options, initialContent);
  }

  /* -------------------------------------------- */
  
  /**
   * Handle changing the eureka value for a talent.
   * @param {Event} event - The change event.
   * @private
   */
  async _onChangeEureka(event) {
    event.preventDefault();
    const input = event.currentTarget;
    const talentKey = input.name.split('.')[3]; // Extracting the talent key from the input name
    const newValue = Number(input.value);

    await this.actor.update({
      [`system.baseattributes.talents.${talentKey}.eureka`]: newValue
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle the user toggling the sheet mode.
   * @param {Event} event  The triggering event.
   * @protected
   */
  async _onChangeSheetMode(event) {
    const { MODES } = this.constructor;
    const toggle = event.currentTarget;
    const label = game.i18n.localize(`HTBAH.SheetMode${toggle.checked ? "Play" : "Edit"}`);
    toggle.dataset.tooltip = label;
    toggle.setAttribute("aria-label", label);
    this._mode = toggle.checked ? MODES.EDIT : MODES.PLAY;
    await this.submit();
    this.render();
  }
  /* -------------------------------------------- */

  /**
   * Handle toggling a pip on the character sheet.
   * @param {PointerEvent} event  The triggering event.
   * @returns {Promise<HowToBeAHeroActor>|void}
   * @protected
   */
  _onTogglePip(event) {
    const n = Number(event.target.closest("[data-n]")?.dataset.n);
    if ( !n || isNaN(n) ) return;
    const prop = event.currentTarget.dataset.prop;
    let value = foundry.utils.getProperty(this.actor, prop);
    if ( value === n ) value--;
    else value = n;
    return this.actor.update({ [prop]: value });
  }

  /* -------------------------------------------- */

  /**
   * Toggle editing hit points.
   * @param {PointerEvent} event  The triggering event.
   * @protected
   */
  async _toggleEditHP(event, toggle) {
    event.preventDefault();
    event.stopPropagation();

    // Check if in edit mode
    const isEditMode = this._mode === this.constructor.MODES.EDIT;
    if (isEditMode) return;
    
    // Check if user has permission to edit
    const hasPermission = this.actor.isOwner || game.user.isGM;
    if (!hasPermission) return;

    const container = event.currentTarget.closest(".hit-points");
    const input = container.querySelector("input[name='system.baseattributes.health.value']");
    const value = container.querySelector(".value");

    // Toggle edit mode
    if (toggle) {
      // Hide the span and show the input
      value.style.display = "none";
      input.style.display = "inline";
      input.focus();
      input.select();
    } else {
      // Hide the input and show the span
      value.style.display = "inline";
      input.style.display = "none";

      // Update the actor with the new value
      if (input.value !== value.textContent) {
        await this.actor.update({
          "system.baseattributes.health.value": Math.clamped(
            parseInt(input.value) || 0,
            0,
            this.actor.system.baseattributes.health.max
          )
        });
      }
    }
  }
  
  /**
   * Handle the user toggling the sidebar collapsed state.
   * @protected
   
  _onToggleSidebar() {
    const collapsed = this._toggleSidebar();
    const activeTab = this._tabs?.[0]?.active ?? "details";
    game.user.setFlag("how-to-be-a-hero", `sheetPrefs.character.tabs.${activeTab}.collapseSidebar`, collapsed);
  }
  */
  /* -------------------------------------------- */

  /**
   * Toggle the sidebar collapsed state.
   * @param {boolean} [collapsed]  Force a particular collapsed state.
   * @returns {boolean}            The new collapsed state.
   * @protected
   
  _toggleSidebar(collapsed) {
    this.form.classList.toggle("collapsed", collapsed);
    collapsed = this.form.classList.contains("collapsed");
    const collapser = this.form.querySelector(".sidebar .collapser");
    const icon = collapser.querySelector("i");
    collapser.dataset.tooltip = `JOURNAL.View${collapsed ? "Expand" : "Collapse"}`;
    collapser.setAttribute("aria-label", game.i18n.localize(collapser.dataset.tooltip));
    icon.classList.remove("fa-caret-left", "fa-caret-right");
    icon.classList.add(`fa-caret-${collapsed ? "right" : "left"}`);
    return collapsed;
  }
  */
  /* -------------------------------------------- */

  /**
   * Handle showing the character's portrait or token art.
   * @protected
   */
  _onShowPortrait() {
    const showTokenPortrait = this.actor.getFlag("howtobeahero", "showTokenPortrait") === true;
    const token = this.actor.isToken ? this.actor.token : this.actor.prototypeToken;
    const img = showTokenPortrait ? token.texture.src : this.actor.img;
    new ImagePopout(img, { title: this.actor.name, uuid: this.actor.uuid }).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Handle the user performing some sheet action.
   * @param {PointerEvent} event  The triggering event.
   * @protected
   */
  _onAction(event) {
    const target = event.currentTarget;
    switch ( target.dataset.action ) {
      //case "findItem": this._onFindItem(target.dataset.itemType); break;
      case "toggleInspiration": this._onToggleInspiration(); break;
    }
  }

  /* -------------------------------------------- */

  /**
 * Handle creating a new embedded child.
 * @returns {Item|Weapon|Knowledge|Action|Social|void}
 * @protected
 */
  _onCreateChild() {
    const activeTab = this._tabs[0].active;

    console.log(`Active tab in _onCreateChild: ${activeTab}`); // Debugging log

    let types = {
      inventory: ["item", "consumable", "weapon", "tool", "armor"],
      details: ["knowledge", "action", "social"],
      effects: [], // Currently no effects are added through this
      biography: [] // Assuming no item types are created from the biography tab
    }[activeTab] ?? [];

    types = types.filter(type => {
      const model = CONFIG.Item.dataModels[type];
      return !model.metadata?.singleton || !this.actor.itemTypes[type].length;
    });

    if (types.length) return Item.implementation.createDialog({}, {
      parent: this.actor, pack: this.actor.pack, types
    });
  }
  
  /* -------------------------------------------- */

  /**
   * Show available items of a given type.
   * There is no need for this function yet. I am not using the drag and drop class, race or background selection in HowToBeAHero
   * @param {string} type  The item type.
   * @protected
   */
  _onFindItem(type) {
    /*
    switch ( type ) {
      case "class": game.packs.get("dnd5e.classes").render(true); break;
      case "race": game.packs.get("dnd5e.races").render(true); break;
      case "background": game.packs.get("dnd5e.backgrounds").render(true); break;
    }
    */
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling inspiration.
   * @protected
   */
  _onToggleInspiration() {
    this.actor.update({ "system.baseattributes.inspiration.status": !this.actor.system.baseattributes.inspiration.status });
  }

  /* -------------------------------------------- */

  /**
   * Initialize item tooltips on an element.
   * @param {HTMLElement} element  The tooltipped element.
   * @protected
   */
  _applyItemTooltips(element) {
    if ( "tooltip" in element.dataset ) return;
    const target = element.closest("[data-item-id], [data-uuid]");
    let uuid = target.dataset.uuid;
    if ( !uuid ) {
      const item = this.actor.items.get(target.dataset.itemId);
      uuid = item?.uuid;
    }
    if ( !uuid ) return;
    element.dataset.tooltip = `
      <section class="loading" data-uuid="${uuid}"><i class="fas fa-spinner fa-spin-pulse"></i></section>
    `;
    element.dataset.tooltipClass = "how-to-be-a-hero-tooltip item-tooltip";
    element.dataset.tooltipDirection ??= "LEFT";
  }

  /* -------------------------------------------- */

  /**
   * Initialize a rule tooltip on an element.
   * @param {HTMLElement} element  The tooltipped element.
   * @protected
   */
  _applyReferenceTooltips(element) {
    if ( "tooltip" in element.dataset ) return;
    const uuid = element.dataset.referenceTooltip;
    element.dataset.tooltip = `
      <section class="loading" data-uuid="${uuid}"><i class="fas fa-spinner fa-spin-pulse"></i></section>
    `;
  }
  /* -------------------------------------------- */

  /**
   * Handle performing some action on an owned Item.
   * @param {PointerEvent} event  The triggering event.
   * @protected
   */
  _onItemAction(event) {
    if ( event.target.closest("select") ) return;
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.currentTarget.closest("[data-item-id]")?.dataset.itemId;
    const action = event.currentTarget.dataset.action;
    const item = this.actor.items.get(itemId);

    switch ( action ) {
      case "edit": item?.sheet.render(true); break;
      case "delete": item?.deleteDialog(); break;
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling an ability check or saving throw.
   * @param {PointerEvent} event  The triggering event.
   * @protected
   */
  _onRollTalent(event) {
    const talentId = event.currentTarget.closest("[data-action]").dataset.talent;
    this.actor.rollTalent(talentId, { event });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onResize(event) {
    super._onResize(event);
    const { width, height } = this.position;
    const key = `character${this.actor.limited ? ":limited": ""}`;
    game.user.setFlag("how-to-be-a-hero", `sheetPrefs.${key}`, { width, height });
  }

   /* -------------------------------------------- */

  /** @inheritDoc */
  _filterItem(item) {
    if ( item.type === "container" ) return true;
  }

}
