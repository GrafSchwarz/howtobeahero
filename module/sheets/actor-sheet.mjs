import { HowToBeAHeroActor } from '../documents/actor.mjs';
import { HowToBeAHeroDragDropHandler } from '../helpers/drag-drop-handler.mjs';
import { initializeCustomElements } from '../components/_module.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A specialized subclass for handling external tabs in AppV2
 */
class TabsHtbah {
  constructor(options = {}) {
    this.navSelector = options.navSelector || ".tabs";
    this.contentSelector = options.contentSelector || ".tab-body";
    this.initial = options.initial || "details";
    this.active = this.initial;
    this.callback = options.callback;
  }

  bind(html) {
    if (!html || !(html instanceof HTMLElement)) {
      console.warn("HowToBeAHero | TabsHtbah.bind called with invalid element:", html);
      return;
    }

    this._nav = html.querySelector(this.navSelector);
    this._content = html.querySelector(this.contentSelector);
    
    if (this._nav) {
      this._nav.addEventListener("click", this._onClickNav.bind(this));
    } else {
      console.warn("HowToBeAHero | Navigation element not found:", this.navSelector);
    }
    
    this.activate(this.active);
  }

  _onClickNav(event) {
    const target = event.target.closest("[data-tab]");
    if (!target) return;
    
    event.preventDefault();
    this.activate(target.dataset.tab, { triggerCallback: true });
  }

  activate(tabName, { triggerCallback = false } = {}) {
    if (!this._nav) return false;
    
    // Update navigation
    this._nav.querySelectorAll("[data-tab]").forEach(t => {
      t.classList.toggle("active", t.dataset.tab === tabName);
    });
    
    // Update content
    if (this._content) {
      this._content.querySelectorAll(".tab[data-tab]").forEach(t => {
        t.classList.toggle("active", t.dataset.tab === tabName);
      });
    }
    
    // Update form classes
    const form = this._nav.closest("form");
    if (form) {
      form.className = form.className.replace(/tab-\w+/g, "");
      form.classList.add(`tab-${tabName}`);
    }
    
    this.active = tabName;
    
    if (triggerCallback && this.callback) {
      this.callback(null, this, tabName);
    }
    
    return true;
  }
}

/**
 * Simple name input dialog for item creation using AppV2
 */
class NameInputDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor({ defaultName = "", onSubmit } = {}) {
    super();
    this.defaultName = defaultName;
    this.onSubmit = onSubmit;
  }

  static DEFAULT_OPTIONS = {
    id: "create-item-dialog",
    tag: "dialog",
    window: {
      title: "Name",
      minimizable: false,
      resizable: false
    },
    position: {
      width: 400,
      height: "auto"
    },
    classes: ["dialog", "how-to-be-a-hero"],
    actions: {
      cancel: this.prototype._onCancel,
      submit: this.prototype._onSubmit
    }
  };

  static PARTS = {
    form: {
      template: "systems/how-to-be-a-hero/templates/dialogs/create-item.hbs"
    }
  };

  async _prepareContext(options) {
    return {
      defaultName: this.defaultName
    };
  }


  _onRender(context, options) {
    
    // Ensure the dialog is opened (HTML dialog element needs open attribute)
    if (this.element && !this.element.open) {
      this.element.showModal();
    }
    
    const input = this.element.querySelector('input[name="name"]');
    if (input) {
      input.focus();
      input.select();
    }
  }


  _onCancel(event, target) {
    this.close();
  }

  _onSubmit(event, target) {
    event.preventDefault();
    this._submit();
  }

  _submit() {
    const name = this.element.querySelector('input[name="name"]')?.value?.trim();
    if (!name) {
      ui.notifications.warn(game.i18n.localize("HTBAH.WarnNameRequired"));
      return;
    }
    this.close();
    this.onSubmit?.(name);
  }
}

/**
 * How To Be A Hero Actor Sheet - AppV2 Implementation
 * @extends {foundry.applications.sheets.ActorSheetV2}
 */
export class HowToBeAHeroActorSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  constructor(options = {}) {
    const key = `character${options.document?.limited ? ":limited" : ""}`;
    const prefs = game.user.getFlag("how-to-be-a-hero", `sheetPrefs.${key}`) ?? {};
    
    if (prefs.width) options.position = { ...options.position, width: prefs.width };
    if (prefs.height) options.position = { ...options.position, height: prefs.height };
    
    super(options);
    this.dragDropHandler = new HowToBeAHeroDragDropHandler(this);
    this._activeTab = "details";
    this._mode = this.constructor.MODES.PLAY;
    this._compactMode = prefs.compactMode ?? false;
  }

  static DEFAULT_OPTIONS = {
    classes: ["how-to-be-a-hero", "sheet", "actor", "character"],
    position: {
      width: 1200,
      height: 700
    },
    window: {
      resizable: true
    },
    actions: {
      toggleMode: this.prototype._onChangeSheetMode,
      createDocument: this.prototype._onCreateDocument,
      rollSkillSet: this.prototype._onRollSkillSet,
      itemAction: this.prototype._onItemAction,
      effectAction: this.prototype._onEffectAction,
      removeFavorite: this.prototype._onRemoveFavorite,
      showPortrait: this.prototype._onShowPortrait,
      toggleCondition: this.prototype._onToggleCondition,
      adjustQuantity: this.prototype._onAdjustQuantity,
      useFavorite: this.prototype._onUseFavorite,
      removeSkill: this.prototype._onRemoveHeaderItem,
      removeWeapon: this.prototype._onRemoveHeaderItem,
      removeParry: this.prototype._onRemoveHeaderItem,
      rollInitiative: this.prototype._onRollInitiative,
      rollHeaderAbility: this.prototype._onRollHeaderAbility,
      rollHeaderWeapon: this.prototype._onRollHeaderWeapon,
      rollHeaderParry: this.prototype._onRollHeaderParry,
      toggleEditHP: this.prototype._onToggleEditHP,
      toggleEditMana: this.prototype._onToggleEditMana,
      toggleCompactMode: this.prototype._onToggleCompactMode
    }
  };

  // Updated to use the main template
  static PARTS = {
    form: {
      template: "systems/how-to-be-a-hero/templates/actor/actor-character-sheet.hbs",
      scrollable: [".main-content"]
    }
  };

  static MODES = { PLAY: 1, EDIT: 2 };
  
  static TABS = [
    { tab: "details", label: "HTBAH.Details", icon: "fas fa-cog" },
    { tab: "inventory", label: "HTBAH.Inventory", svg: "hand-bag" },
    { tab: "effects", label: "HTBAH.Effects", icon: "fas fa-bolt" },
    { tab: "biography", label: "HTBAH.Biography", icon: "fas fa-feather" }
  ];

  get title() {
    return this.document.name;
  }

  tabGroups = {
    primary: "details"
  };

  /**
   * Prepare context data for rendering
   */
  async _prepareContext(options) {
    
    const context = await super._prepareContext(options);
    
    const isEditable = this.isEditable && (this._mode === this.constructor.MODES.EDIT);
    
    Object.assign(context, {
      editable: isEditable,
      owner: this.document.isOwner,
      limited: this.document.limited,
      actor: this.document,
      system: this.document.system,
      flags: this.document.flags,
      config: CONFIG.HTBAH,
      armorData: this.document.armorData,
      fields: this.document.schema.fields,
      systemFields: this.document.system.schema.fields,
      cssClass: this._getContextCssClass(this.isEditable),
      rollableClass: this.isEditable ? 'rollable' : '',
      rollData: this.document.getRollData(),
      tabs: this.constructor.TABS,
      activeTab: this._activeTab,
      showManaBar: game.settings.get("how-to-be-a-hero", "showManaBar"),
      showEureka: game.settings.get("how-to-be-a-hero", "showEureka"),
      compactMode: this._compactMode
    });

    // Prepare specialized data
    await Promise.all([
      this._preparePortraitData(context),
      this._prepareHealthData(context),
      this._prepareManaData(context),
      this._prepareHeaderItems().then(items => context.headerItems = items),
      this._prepareItems(context),
      this._prepareEffects(context)
    ]);

    if (this.document.type === "character") {
      context.favorites = await this._prepareFavorites();
      context.favorites.sort((a, b) => a.sort - b.sort);
    }

    context.skillSets = this.document.skillSetData || {};

    return context;
  }


  _onRender(context, options) {
    try {
      super._onRender(context, options);
      
      // Verify this.element exists and is an HTMLElement
      if (!this.element || !(this.element instanceof HTMLElement)) {
        console.error("HowToBeAHero | this.element is not a valid HTMLElement:", this.element);
        return;
      }
      
      // Initialize custom elements first - moved to this class
      this._initializeCustomElements();
      
      // Setup tab handling using simple click events
      this._setupTabHandling();
      
      // Apply tooltips
      this._initializeTooltips();
      
      // Setup drag and drop if editable
      if (this.isEditable) {
        this._initializeDragDrop();
      }

      // Setup edit mode toggle in header
      this._setupModeToggle();

      // Apply compact mode class if enabled
      this.element.classList.toggle("compact", this._compactMode);

      // Setup form input handling for ApplicationV2
      this._setupFormHandling();
      
    } catch (error) {
      console.error("HowToBeAHero | Error in _onRender:", error);
    }
  }

  /**
   * Initialize custom elements - moved from TabsHtbah to this class
   */
  _initializeCustomElements() {
    
    try {
      // Initialize custom elements from the module
      const elementStatus = initializeCustomElements();
      
      // Wait a tick and then initialize htbah-icon elements specifically
      setTimeout(() => {
        // Force upgrade of any htbah-icon elements that might not be initialized
        this.element.querySelectorAll('htbah-icon').forEach(element => {
          if (element.constructor === HTMLElement || element.constructor === HTMLUnknownElement) {
            customElements.upgrade(element);
          }
        });
        
        this._initializeHtbahIcons();
      }, 0);

      // Check for missing icon fonts and provide fallbacks
      this._ensureIconFonts();
      
      // Set up custom element contexts for AppV2
      this._setupCustomElementContexts();
      
    } catch (error) {
      // Provide fallbacks
      this._initializeFallbacks();
    }
  }

  /**
   * Set up contexts for custom elements that expect certain properties
   */
  _setupCustomElementContexts() {
    
    // Set the _sheet property on the main form element so custom elements can find it
    if (this.element) {
      this.element._sheet = this;
    }
    
    // Find and set up item-list-controls elements
    this.element.querySelectorAll('item-list-controls').forEach(element => {
      // Provide the form context that the element expects
      Object.defineProperty(element, 'form', {
        get: () => this.element.querySelector('form'),
        configurable: true
      });
      
      // Provide sheet context
      Object.defineProperty(element, 'sheet', {
        get: () => this,
        configurable: true
      });
    });

    // Find and set up inventory elements
    this.element.querySelectorAll('htbah-inventory').forEach(element => {
      
      // Provide any expected properties
      if (!element._filters) {
        element._filters = {};
      }
      
      // Provide sheet context
      Object.defineProperty(element, 'sheet', {
        get: () => this,
        configurable: true
      });
      
      // Also set _sheet property directly
      element._sheet = this;
    });

    // Find and set up effects elements
    this.element.querySelectorAll('htbah-effects').forEach(element => {
      // Provide sheet context
      Object.defineProperty(element, 'sheet', {
        get: () => this,
        configurable: true
      });
    });
  }

  /**
   * Initialize htbah-icon elements specifically
   */
  _initializeHtbahIcons() {
    const iconElements = this.element.querySelectorAll('htbah-icon');
    
    iconElements.forEach((iconElement, index) => {
      const src = iconElement.getAttribute('src');
      if (!src) return;

      try {
        // Wait for the custom element to initialize, then check if it worked
        setTimeout(() => {
          const hasVisibleContent = iconElement.shadowRoot && 
                                   iconElement.shadowRoot.children.length > 0;
          const hasFallbackContent = iconElement.querySelector('img, svg, i');
          
          if (!hasVisibleContent && !hasFallbackContent) {
            this._createIconFallback(iconElement, src, index);
          }
        }, 100);
        
        // Also create immediate fallback if element looks uninitialized
        if (iconElement.constructor === HTMLElement || iconElement.constructor === HTMLUnknownElement) {
          this._createIconFallback(iconElement, src, index);
        }
        
      } catch (error) {
        this._createIconFallback(iconElement, src, index);
      }
    });
  }
  
  /**
   * Create fallback content for failed htbah-icon elements
   */
  _createIconFallback(iconElement, src, index) {
    // Clear any existing content
    iconElement.innerHTML = '';
    
    // Try IMG fallback first
    const img = document.createElement('img');
    img.src = src;
    img.alt = iconElement.getAttribute('alt') || `Icon ${index}`;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; display: block;';
    
    // Handle image load failure
    img.onerror = () => {
      iconElement.innerHTML = '<i class="fas fa-cube" style="font-size: 1em; color: currentColor;"></i>';
    };
    
    iconElement.appendChild(img);
    
    // Set container styles
    iconElement.style.cssText = 'display: inline-block; width: 1em; height: 1em; vertical-align: middle;';
    iconElement.classList.add('fallback-icon');
  }

  /**
   * Ensure icon fonts are loaded and provide fallbacks
   */
  _ensureIconFonts() {
    // Check if FontAwesome is loaded
    const testElement = document.createElement('i');
    testElement.className = 'fas fa-test';
    testElement.style.position = 'absolute';
    testElement.style.left = '-9999px';
    document.body.appendChild(testElement);
    
    // Check computed styles to see if font loaded
    const computed = window.getComputedStyle(testElement);
    const fontFamily = computed.fontFamily;
    
    document.body.removeChild(testElement);
    
    if (!fontFamily || !fontFamily.includes('Font Awesome')) {
      console.warn("HowToBeAHero | FontAwesome not detected, icons may not display properly");
      
      // Add fallback styles for critical icons
      this._addIconFallbacks();
    }
  }

  /**
   * Add fallback styles for icons when font icons fail
   */
  _addIconFallbacks() {
    const style = document.createElement('style');
    style.textContent = `
      .how-to-be-a-hero .fas.fa-cog::before,
      .how-to-be-a-hero .fas.fa-bolt::before,
      .how-to-be-a-hero .fas.fa-feather::before,
      .how-to-be-a-hero .fas.fa-dice-d20::before {
        content: "⚙" !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }
      .how-to-be-a-hero .fas.fa-bolt::before {
        content: "⚡" !important;
      }
      .how-to-be-a-hero .fas.fa-feather::before {
        content: "✒" !important;
      }
      .how-to-be-a-hero .fas.fa-dice-d20::before {
        content: "🎲" !important;
      }
      .how-to-be-a-hero htbah-icon:not(:empty) {
        display: inline-block;
        width: 1em;
        height: 1em;
      }
      .how-to-be-a-hero htbah-icon img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Initialize basic fallbacks when custom elements fail entirely
   */
  _initializeFallbacks() {
    
    // Replace failed htbah-icon elements with img tags
    this.element.querySelectorAll('htbah-icon').forEach(element => {
      const src = element.getAttribute('src');
      if (src && !element.querySelector('img')) {
        const img = document.createElement('img');
        img.src = src;
        img.style.width = '1em';
        img.style.height = '1em';
        element.appendChild(img);
      }
    });
    
    // Replace failed slide-toggle elements with checkboxes
    this.element.querySelectorAll('slide-toggle').forEach(element => {
      if (element.constructor === HTMLUnknownElement) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = element.hasAttribute('checked');
        checkbox.className = element.className;
        element.parentNode.replaceChild(checkbox, element);
      }
    });
  }

  /**
   * Setup tab handling using simple click events
   */
  _setupTabHandling() {
    // Find all tab navigation elements
    const tabNavigation = this.element.querySelectorAll('[data-tab]');
    
    tabNavigation.forEach(tabElement => {
      tabElement.addEventListener('click', (event) => {
        event.preventDefault();
        const tabName = event.currentTarget.dataset.tab;
        if (tabName) {
          this._activateTab(tabName);
        }
      });
    });

    // Activate the initial tab
    this._activateTab(this._activeTab);
  }

  /**
   * Activate a specific tab
   */
  _activateTab(tabName) {
    this._activeTab = tabName;
    
    // Update navigation active states
    this.element.querySelectorAll('[data-tab]').forEach(nav => {
      nav.classList.toggle('active', nav.dataset.tab === tabName);
    });
    
    // Update tab content visibility
    const tabBody = this.element.querySelector('.tab-body');
    if (tabBody) {
      tabBody.querySelectorAll('.tab[data-tab]').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
      });
    }
    
    // Update form class for styling
    this.element.className = this.element.className.replace(/tab-\w+/g, "");
    this.element.classList.add(`tab-${tabName}`);
    
    // Update create child button
    const createChild = this.element.querySelector(".create-child");
    if (createChild) {
      createChild.setAttribute("aria-label", game.i18n.format("SIDEBAR.Create", {
        type: game.i18n.localize(`DOCUMENT.${tabName === "effects" ? "ActiveEffect" : "Item"}`)
      }));
    }
    
  }

  /**
   * Setup the edit mode toggle in the header
   */
  _setupModeToggle() {
    // Only show mode toggles to users with edit permission
    if (!this.isEditable) return;

    const header = this.element.querySelector(".window-header");
    if (!header || header.querySelector(".mode-slider")) return; // Avoid duplicates

    // Create edit mode toggle
    const editToggle = document.createElement("slide-toggle");
    editToggle.checked = this._mode === this.constructor.MODES.EDIT;
    editToggle.classList.add("mode-slider");
    editToggle.dataset.tooltip = "HTBAH.SheetModeEdit";
    editToggle.setAttribute("aria-label", game.i18n.localize("HTBAH.SheetModeEdit"));
    editToggle.addEventListener("change", (event) => this._onChangeSheetMode(event, editToggle));
    editToggle.addEventListener("dblclick", event => event.stopPropagation());

    // Create compact mode toggle
    const compactToggle = document.createElement("slide-toggle");
    compactToggle.checked = this._compactMode;
    compactToggle.classList.add("compact-slider");
    const compactLabel = game.i18n.localize(`HTBAH.CompactMode${this._compactMode ? "On" : "Off"}`);
    compactToggle.dataset.tooltip = compactLabel;
    compactToggle.setAttribute("aria-label", compactLabel);
    compactToggle.addEventListener("change", (event) => this._onToggleCompactMode(event, compactToggle));
    compactToggle.addEventListener("dblclick", event => event.stopPropagation());

    // Add both toggles to header in correct order (edit/play first, then compact/combat)
    header.insertAdjacentElement("afterbegin", compactToggle);
    header.insertAdjacentElement("afterbegin", editToggle);

    // Update header buttons
    header.querySelectorAll(".header-button").forEach(btn => {
      const label = btn.querySelector(":scope > i").nextSibling;
      if (label && label.nodeType === Node.TEXT_NODE) {
        btn.dataset.tooltip = label.textContent;
        btn.setAttribute("aria-label", label.textContent);
        label.remove();
      }
    });
  }

  // ... rest of the methods remain the same ...
  
  /**
   * Enhanced context CSS class generation
   */
  _getContextCssClass(editable) {
    const baseClass = editable ? 'editable' : this.isEditable ? 'interactable' : 'locked';
    const activeTab = this._activeTab;
    const sidebarClass = this._getSidebarClass(activeTab);
    const actorType = this.document.type;
    return `${baseClass} ${actorType} ${sidebarClass}`;
  }

  /**
   * Get sidebar CSS class based on user preferences
   */
  _getSidebarClass(activeTab) {
    const sidebarCollapsed = game.user.getFlag('how-to-be-a-hero', 
      `sheetPrefs.character.tabs.${activeTab}.collapseSidebar`);
    return sidebarCollapsed ? ' collapsed' : '';
  }

  /**
   * Prepare portrait data
   */
  _preparePortraitData(context) {
    const showTokenPortrait = this.document.getFlag('how-to-be-a-hero', 'showTokenPortrait') === true;
    const token = this.document.isToken ? this.document.token : this.document.prototypeToken;
    
    context.portrait = {
      token: showTokenPortrait,
      src: showTokenPortrait ? token.texture.src : this.document.img,
      path: showTokenPortrait ? (this.document.isToken ? '' : 'prototypeToken.texture.src') : 'img'
    };
  }

  /**
   * Prepare health data
   */
  _prepareHealthData(context) {
    const health = this.document.system.attributes.health;
    context.healthPercentage = health.max ? (health.value / health.max) * 100 : 0;
  }

  /**
   * Prepare mana data
   */
  _prepareManaData(context) {
    const mana = this.document.system.attributes.mana;
    context.manaPercentage = mana.max ? (mana.value / mana.max) * 100 : 0;
  }

  /**
   * Prepare header items
   */
  async _prepareHeaderItems() {
    const headerItems = { ability: null, weapon: null, parry: null };

    const abilityId = this.document.getFlag("how-to-be-a-hero", "headerAbility");
    const weaponId = this.document.getFlag("how-to-be-a-hero", "headerWeapon");
    const parryId = this.document.getFlag("how-to-be-a-hero", "headerParry");

    if (abilityId) {
      const item = this.document.items.get(abilityId);
      if (item) {
        headerItems.ability = {
          id: item.id,
          name: item.name,
          img: item.img,
          type: item.type
        };
      }
    }

    if (weaponId) {
      const item = this.document.items.get(weaponId);
      if (item) {
        headerItems.weapon = {
          id: item.id,
          name: item.name,
          img: item.img,
          type: item.type
        };
      }
    }

    if (parryId) {
      const item = this.document.items.get(parryId);
      if (item) {
        headerItems.parry = {
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
   * Prepare effects data
   */
  async _prepareEffects(context) {
    // Conditions
    if (game.howtobeahero?.managers?.conditions) {
      context.conditions = game.howtobeahero.managers.conditions.getAllConditions().map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        disabled: !game.howtobeahero.managers.conditions.isConditionActive(this.document, c)
      }));
    } else {
      console.warn('HowToBeAHero | ConditionManager not available. Skipping condition preparation.');
      context.conditions = [];
    }

    // Effects
    if (game.howtobeahero?.managers?.effects) {
      context.effects = game.howtobeahero.managers.effects.prepareActiveEffectCategories(this.document.effects);
    } else {
      console.warn('HowToBeAHero | EffectsManager not available. Skipping effects preparation.');
      context.effects = {};
    }
  }

  /**
   * Organize and classify Items for Character sheets
   */
  _prepareItems(context) {
    const allItems = this.document.items;
    
    // Containers for different item types
    const items = [];
    const consumables = [];
    const weapons = [];
    const armors = [];
    const tools = [];
    const abilities = [];

    for (const item of allItems) {
      item.img ||= Item.DEFAULT_ICON;

      // Prepare item context for template usage
      item.ctx = this._prepareItemContext(item);

      switch (item.type) {
        case "item":
          items.push(item);
          break;
        case "consumable":
          consumables.push(item);
          break;
        case "weapon":
          weapons.push(item);
          break;
        case "armor":
          armors.push(item);
          break;
        case "tool":
          tools.push(item);
          break;
        case "ability":
          abilities.push(item);
          break;
      }
    }

    // Attach to context
    context.skillSets = this.document.skillSetData || {};
    context.items = items;
    context.consumables = consumables;
    context.weapons = weapons;
    context.armors = armors;
    context.tools = tools;
    context.abilities = abilities;

    // Create sections array for use in the template
    context.sections = [
      { label: "HTBAH.ItemPl", dataset: { type: "item" }, items: items },
      { label: "HTBAH.consumablePl", dataset: { type: "consumable" }, items: consumables },
      { label: "HTBAH.weaponPl", dataset: { type: "weapon" }, items: weapons },
      { label: "HTBAH.armorPl", dataset: { type: "armor" }, items: armors },
      { label: "HTBAH.toolPl", dataset: { type: "tool" }, items: tools },
    ];

    // Sort items within each section
    for (let section of context.sections) {
      section.items?.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    }
  }

  /**
   * Prepare item context for template usage
   * @param {Item} item - The item to prepare context for
   * @returns {Object} Context object for the item
   */
  _prepareItemContext(item) {
    const ctx = {};

    // Prepare equip context
    if (["weapon", "armor"].includes(item.type)) {
      const isEquipped = item.system.equipped || false;
      ctx.equip = {
        applicable: true,
        cls: isEquipped ? "active" : "",
        title: isEquipped ? "HTBAH.Unequip" : "HTBAH.Equip",
        disabled: false
      };
    }

    // Prepare uses context
    if (item.system.uses) {
      ctx.hasUses = true;
      ctx.uses = item.system.uses;
    } else {
      ctx.hasUses = false;
    }

    // Prepare rollable context - abilities are always rollable, others need rollable property set to true
    const rollableClasses = [];
    if (this.isEditable && (item.type === "ability" || item.system.rollable === true)) {
      rollableClasses.push("rollable");
    }
    ctx.rollableClass = rollableClasses.join(" ");

    // Prepare subtitle for display
    ctx.subtitle = this._getItemSubtitle(item);

    return ctx;
  }

  /**
   * Prepare favorites for display
   */
  async _prepareFavorites() {
    const favoritePromises = this.document.system.favorites.map(async f => {
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
      // Abilities are always rollable when editable, items only if they have rollable property set to true
      if (this.isEditable && (type === "ability" || (type === "item" && favorite.system?.rollable === true) || (type === "tool"))) {
        rollableClass.push("rollable");
      }
      if (type === "ability") rollableClass.push("ability-name");
      else if (type === "tool") rollableClass.push("tool-name");

      if (suppressed) subtitle = game.i18n.localize("HTBAH.Suppressed");
      
      const finalRollableClass = rollableClass.filterJoin(" ");
      
      return {
        id, img, type, title, value, uses, sort, save, modifier, passive, range, reference, suppressed, level,
        itemId: type === "item" ? favorite.id : null,
        effectId: type === "effect" ? favorite.id : null,
        parentId: (type === "effect") && (favorite.parent !== favorite.target) ? favorite.parent.id : null,
        preparationMode: type === "slots" ? id === "pact" ? "pact" : "prepared" : null,
        key: (type === "ability") || (type === "tool") ? id : null,
        toggle: toggle === undefined ? null : { applicable: true, value: toggle },
        quantity: quantity > 1 ? quantity : "",
        rollableClass: finalRollableClass,
        css: css.filterJoin(" "),
        bareName: type === "slots",
        subtitle: Array.isArray(subtitle) ? subtitle.filterJoin(" &bull; ") : subtitle
      };
    });

    const resolvedFavorites = (await Promise.all(favoritePromises)).filter(f => f !== null);
    return resolvedFavorites;
  }

  /**
   * Get favorite data for a specific type and ID
   */
  async _getFavoriteData(type, id) {
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

  /**
   * Get subtitle for an item
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
   * Initialize tooltips
   */
  _initializeTooltips() {
    this.element.querySelectorAll(".item-tooltip").forEach(this._applyItemTooltips.bind(this));
    this.element.querySelectorAll("[data-reference-tooltip]").forEach(this._applyReferenceTooltips.bind(this));
  }

  /**
   * Setup form input handling for ApplicationV2
   */
  _setupFormHandling() {
    
    // Handle all input changes for automatic saving
    this.element.querySelectorAll('input[type="text"], input[type="number"], textarea, select').forEach(input => {
      // Skip inputs that shouldn't auto-save (like search fields)
      if (input.name && (input.name.startsWith('system.') || input.name === 'name')) {
        input.addEventListener('change', this._onFormInput.bind(this));
        input.addEventListener('blur', this._onFormInput.bind(this)); // Also save on blur
      }
    });
  }

  /**
   * Handle form input changes
   */
  async _onFormInput(event) {
    const target = event.target;
    const name = target.name;
    const value = target.value;
    
    // Check if this is an item input (has data-item-id)
    const itemId = target.dataset.itemId;
    if (itemId) {
      // This is an item input, update the embedded item
      const item = this.document.items.get(itemId);
      if (!item) {
        console.warn(`HowToBeAHero | Item ${itemId} not found`);
        return;
      }
      
      // Handle different data types for item updates
      let processedValue = value;
      if (target.dataset.dtype === "Number" || target.type === "number") {
        processedValue = Number(value) || 0;
      } else if (target.dataset.dtype === "Boolean" || target.type === "checkbox") {
        processedValue = target.checked;
      }
      
      const updateData = { [name]: processedValue };
      
      try {
        await item.update(updateData);
      } catch (error) {
        console.error("HowToBeAHero | Error updating item:", error);
        ui.notifications.error("Failed to save item changes.");
      }
      return;
    }
    
    // Actor input handling
    if (!name || !(name.startsWith('system.') || name === 'name')) return;
    
    // Create update data
    const updateData = {};
    
    // Handle different data types
    let processedValue = value;
    if (target.dataset.dtype === "Number" || target.type === "number") {
      processedValue = Number(value) || 0;
    } else if (target.dataset.dtype === "Boolean" || target.type === "checkbox") {
      processedValue = target.checked;
    }
    
    updateData[name] = processedValue;
    
    try {
      await this.document.update(updateData);
    } catch (error) {
      console.error("HowToBeAHero | Error updating actor:", error);
      ui.notifications.error("Failed to save changes.");
    }
  }

  /**
   * Initialize drag and drop
   */
  _initializeDragDrop() {
    this.element.querySelectorAll('li.item').forEach(li => {
      if (!li.classList.contains('inventory-header')) {
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', this.dragDropHandler.onDragStart.bind(this.dragDropHandler), false);
        li.addEventListener('dragend', this.dragDropHandler.onDragEnd.bind(this.dragDropHandler), false);
      }
    });

    this.element.querySelectorAll('.favorites, .header-stat-column[data-slot], .skillSet-category, .items-section').forEach(zone => {
      zone.addEventListener('dragover', this.dragDropHandler.onDragOver.bind(this.dragDropHandler));
      zone.addEventListener('dragleave', this.dragDropHandler.onDragLeave.bind(this.dragDropHandler));
      zone.addEventListener('drop', this.dragDropHandler.onDrop.bind(this.dragDropHandler));
    });

    // Add the entire sheet as a drop zone for item exchanges with other characters
    this.element.addEventListener('dragover', this.dragDropHandler.onDragOver.bind(this.dragDropHandler));
    this.element.addEventListener('dragleave', this.dragDropHandler.onDragLeave.bind(this.dragDropHandler));
    this.element.addEventListener('drop', this.dragDropHandler.onDrop.bind(this.dragDropHandler));
  }

  /**
   * Handle tab changes
   */
  _onChangeTab(event, tabs, active) {
    if (active) {
      this._activateTab(active);
    }
  }

  /**
   * Handle sheet mode changes
   */
  async _onChangeSheetMode(event, target) {
    const { MODES } = this.constructor;
    const toggle = target;
    const label = game.i18n.localize(`HTBAH.SheetMode${toggle.checked ? "Edit" : "Play"}`);
    toggle.dataset.tooltip = label;
    toggle.setAttribute("aria-label", label);
    this._mode = toggle.checked ? MODES.EDIT : MODES.PLAY;
    
    await this.submit();
    this.render();
  }

  /**
   * Handle compact mode toggle
   */
  async _onToggleCompactMode(event, target) {
    this._compactMode = target.checked;

    // Save preference
    const key = `character${this.document.limited ? ":limited" : ""}`;
    await game.user.setFlag("how-to-be-a-hero", `sheetPrefs.${key}.compactMode`, this._compactMode);

    // Add/remove CSS class for styling
    this.element.classList.toggle("compact", this._compactMode);

    // Update tooltip
    const label = game.i18n.localize(`HTBAH.CompactMode${this._compactMode ? "On" : "Off"}`);
    target.dataset.tooltip = label;
    target.setAttribute("aria-label", label);

    // Re-render to update template
    this.render();
  }

  /**
   * Handle initiative rolls
   */
  async _onRollInitiative(event, target) {
    if (!this.document.isOwner && !game.user.isGM) return;
    return this.document.rollInitiative({createCombatants: true});
  }

  /**
   * Handle header ability rolls
   */
  async _onRollHeaderAbility(event, target) {
    if (!this.document.isOwner && !game.user.isGM) return;

    const abilityId = this.document.getFlag("how-to-be-a-hero", "headerAbility");
    if (!abilityId) return;

    const item = this.document.items.get(abilityId);
    if (!item) return;

    return item.roll();
  }

  /**
   * Handle header weapon rolls
   */
  async _onRollHeaderWeapon(event, target) {
    if (!this.document.isOwner && !game.user.isGM) return;

    const weaponId = this.document.getFlag("how-to-be-a-hero", "headerWeapon");
    if (!weaponId) return;

    const item = this.document.items.get(weaponId);
    if (!item) return;

    return item.roll();
  }

  /**
   * Handle header parry rolls
   */
  async _onRollHeaderParry(event, target) {
    if (!this.document.isOwner && !game.user.isGM) return;

    const parryId = this.document.getFlag("how-to-be-a-hero", "headerParry");
    if (!parryId) return;

    const item = this.document.items.get(parryId);
    if (!item) return;

    return item.roll();
  }

  /**
   * Handle HP editing toggle
   */
  async _onToggleEditHP(event, target) {
    const isEditMode = this._mode === this.constructor.MODES.EDIT;
    if (isEditMode) return;
    
    const hasPermission = this.document.isOwner || game.user.isGM;
    if (!hasPermission) return;

    const container = target.closest(".hit-points");
    const input = container.querySelector("input[name='system.attributes.health.value']");
    const value = container.querySelector(".value");

    const shouldEdit = target.dataset.edit === "true";
    
    if (shouldEdit) {
      value.style.display = "none";
      input.style.display = "inline";
      input.focus();
      input.select();
      target.dataset.edit = "false";
    } else {
      value.style.display = "inline";
      input.style.display = "none";
      target.dataset.edit = "true";

      if (input.value !== value.textContent) {
        await this.document.update({
          "system.attributes.health.value": Math.clamped(
            parseInt(input.value) || 0,
            0,
            this.document.system.attributes.health.max
          )
        });
      }
    }
  }

  /**
   * Handle Mana editing toggle
   */
  async _onToggleEditMana(event, target) {
    const isEditMode = this._mode === this.constructor.MODES.EDIT;
    if (isEditMode) return;
    
    const hasPermission = this.document.isOwner || game.user.isGM;
    if (!hasPermission) return;

    const container = target.closest(".mana-points");
    const input = container.querySelector("input[name='system.attributes.mana.value']");
    const value = container.querySelector(".value");

    const shouldEdit = target.dataset.edit === "true";
    
    if (shouldEdit) {
      value.style.display = "none";
      input.style.display = "inline";
      input.focus();
      input.select();
      target.dataset.edit = "false";
    } else {
      value.style.display = "inline";
      input.style.display = "none";
      target.dataset.edit = "true";

      if (input.value !== value.textContent) {
        await this.document.update({
          "system.attributes.mana.value": Math.clamped(
            parseInt(input.value) || 0,
            0,
            this.document.system.attributes.mana.max
          )
        });
      }
    }
  }

  /**
   * Handle skill set rolls
   */
  async _onRollSkillSet(event, target) {
    if (!this.document.isOwner && !game.user.isGM) return;

    const skillSetId = target.dataset.skillset;
    this.document.rollSkillSet(skillSetId, { event });
  }

  /**
   * Handle item actions (edit, delete, roll, etc.)
   */
  _onItemAction(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const action = target.dataset.subAction || target.dataset.action;
    const item = this.document.items.get(itemId);

    if (!item && action !== "roll") return;

    switch (action) {
      case "edit":
        item?.sheet.render(true);
        break;
      case "delete":
        item?.deleteDialog();
        break;
      case "roll":
      case "rollItem":
        if (!this.document.isOwner && !game.user.isGM) return;
        if (item) item.roll();
        break;
      case "equip":
        if (item && ['weapon', 'armor'].includes(item.type)) {
          item.update({ "system.equipped": !item.system.equipped });
        }
        break;
    }
  }

  /**
   * Handle effect actions
   */
  _onEffectAction(event, target) {
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    const action = target.dataset.subAction || target.dataset.action;
    const effect = this.document.effects.get(effectId);

    if (!effect) return;

    switch (action) {
      case "edit":
        effect.sheet.render(true);
        break;
      case "delete":
        effect.deleteDialog();
        break;
      case "toggle":
        effect.update({ disabled: !effect.disabled });
        break;
    }
  }

  /**
   * Handle condition toggling
   */
  _onToggleCondition(event, target) {
    const conditionId = target.dataset.conditionId;
    if (game.howtobeahero?.managers?.conditions) {
      game.howtobeahero.managers.conditions.toggleCondition(this.document, conditionId);
    }
  }

  /**
   * Handle quantity adjustments
   */
  async _onAdjustQuantity(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const direction = target.dataset.direction;
    const item = this.document.items.get(itemId);

    if (!item) return;

    const currentQuantity = item.system.quantity || 0;
    const newQuantity = direction === "increase" ? currentQuantity + 1 : Math.max(0, currentQuantity - 1);
    
    await item.update({ "system.quantity": newQuantity });
  }

  /**
   * Handle using favorites
   */
  async _onUseFavorite(event, target) {
    if (!this.document.isOwner && !game.user.isGM) return;

    const { favoriteId } = target.closest("[data-favorite-id]").dataset;
    const favorite = await fromUuid(favoriteId, { relative: this.document });

    if (favorite instanceof Item) {
      return favorite.roll();
    }
    if (favorite instanceof ActiveEffect) {
      return favorite.update({ disabled: !favorite.disabled });
    }
  }

  /**
   * Handle removing header items
   */
  async _onRemoveHeaderItem(event, target) {
    const action = target.dataset.action;
    let slot, flagKey;
    
    if (action === "removeSkill") {
      slot = "ability";
      flagKey = "headerAbility";
    } else if (action === "removeWeapon") {
      slot = "weapon"; 
      flagKey = "headerWeapon";
    } else if (action === "removeParry") {
      slot = "parry";
      flagKey = "headerParry";
    }
    
    return this.document.unsetFlag("how-to-be-a-hero", flagKey);
  }

  /**
   * Set header item for a specific slot
   * @param {string} slot - The slot type ("ability", "weapon", or "parry")
   * @param {string} itemId - The ID of the item to set
   */
  async _setHeaderItem(slot, itemId) {
    
    // Validate the item exists and belongs to this actor
    const item = this.document.items.get(itemId);
    if (!item) {
      console.warn(`Item ${itemId} not found on actor ${this.document.name}`);
      ui.notifications.warn("Item not found on this character.");
      return false;
    }
    
    // Validate item type for the slot
    if (slot === "ability" && item.type !== "ability") {
      console.warn(`Cannot set ${item.type} item in ability slot`);
      ui.notifications.warn("Only abilities can be placed in the ability slot.");
      return false;
    }
    
    if (slot === "weapon" && item.type !== "weapon") {
      console.warn(`Cannot set ${item.type} item in weapon slot`);
      ui.notifications.warn("Only weapons can be placed in the weapon slot.");
      return false;
    }

    if (slot === "parry" && item.type !== "ability") {
      console.warn(`Cannot set ${item.type} item in parry slot`);
      ui.notifications.warn("Only abilities can be placed in the parry slot.");
      return false;
    }
    
    // Set the appropriate flag
    let flagKey;
    if (slot === "ability") flagKey = "headerAbility";
    else if (slot === "weapon") flagKey = "headerWeapon";
    else if (slot === "parry") flagKey = "headerParry";
    
    return this.document.setFlag("how-to-be-a-hero", flagKey, itemId);
  }

  /**
   * Handle favorite removal
   */
  _onRemoveFavorite(event, target) {
    const { favoriteId } = target.closest("[data-favorite-id]")?.dataset ?? {};
    if (!favoriteId) return;
    return this.document.system.removeFavorite(favoriteId);
  }

  /**
   * Handle document creation
   */
  async _onCreateDocument(event, target) {
    const documentClass = target.dataset.documentClass ?? "Item";
    const type = target.dataset.type ?? "item";

    let systemData = {};
    try {
      const rawSystem = target.dataset.system;
      if (rawSystem) systemData = JSON.parse(rawSystem);
    } catch (err) {
      console.warn("Invalid JSON in data-system attribute:", target.dataset.system, err);
    }

    return new Promise(resolve => {
      const dialog = new NameInputDialog({
        defaultName: "",
        onSubmit: name => {
          const data = { name, type, system: systemData };
          resolve(this.document.createEmbeddedDocuments(documentClass, [data]));
        }
      });
      dialog.render(true);
    });
  }

  /**
   * Handle portrait display or editing
   */
  _onShowPortrait(event, target) {
    const showTokenPortrait = this.document.getFlag("how-to-be-a-hero", "showTokenPortrait") === true;
    const token = this.document.isToken ? this.document.token : this.document.prototypeToken;
    const img = showTokenPortrait ? token.texture.src : this.document.img;
    
    // If in edit mode, open file picker to change the image
    if (this._mode === this.constructor.MODES.EDIT) {
      const fp = new FilePicker({
        type: "image",
        current: img,
        callback: (path) => {
          if (showTokenPortrait) {
            // Update token image
            const updateData = this.document.isToken 
              ? { "texture.src": path }
              : { "prototypeToken.texture.src": path };
            this.document.update(updateData);
          } else {
            // Update actor image
            this.document.update({ img: path });
          }
        }
      });
      fp.render(true);
    } else {
      // In play mode, show the image popup
      new ImagePopout(img, { title: this.document.name, uuid: this.document.uuid }).render(true);
    }
  }

  /**
   * Apply item tooltips
   */
  _applyItemTooltips(element) {
    if ("tooltip" in element.dataset) return;
    const target = element.closest("[data-item-id], [data-uuid]");
    let uuid = target.dataset.uuid;
    if (!uuid) {
      const item = this.document.items.get(target.dataset.itemId);
      uuid = item?.uuid;
    }
    if (!uuid) return;
    element.dataset.tooltip = `
      <section class="loading" data-uuid="${uuid}"><i class="fas fa-spinner fa-spin-pulse"></i></section>
    `;
    element.dataset.tooltipClass = "how-to-be-a-hero-tooltip item-tooltip";
    element.dataset.tooltipDirection ??= "LEFT";
  }

  /**
   * Apply reference tooltips
   */
  _applyReferenceTooltips(element) {
    if ("tooltip" in element.dataset) return;
    const uuid = element.dataset.referenceTooltip;
    element.dataset.tooltip = `
      <section class="loading" data-uuid="${uuid}"><i class="fas fa-spinner fa-spin-pulse"></i></section>
    `;
  }

  /**
   * Handle window resize
   */
  _onResize(event) {
    super._onResize(event);
    const { width, height } = this.position;
    const key = `character${this.document.limited ? ":limited" : ""}`;
    game.user.setFlag("how-to-be-a-hero", `sheetPrefs.${key}`, { width, height });
  }

  /**
   * Handle drop events for favorites and header items
   */
  async _onDropItem(event, data) {
    if (!event.target.closest(".favorites")) {
      // Check if this is a same-actor drop to prevent duplication
      if (data.type === "Item" && data.sourceActorId === this.document.id) {
        return false; // Prevent the default behavior
      }
      return super._onDropItem(event, data);
    }
    
    // For favorites, store the reference
    event.preventDefault();
    const itemId = data.uuid.split('.').pop();
    const item = this.document.items.get(itemId);
    return this._onDropFavorite(event, { type: item?.type || "item", id: itemId });
  }

  /**
   * Handle dropping favorites
   */
  async _onDropFavorite(event, favorite) {
    event.preventDefault();
    event.stopPropagation();

    // Check if it's already a favorite
    if (this.document.system.hasFavorite(favorite.id)) {
      return this._onSortFavorites(event, favorite.id);
    }

    // Add as favorite using the item ID
    const item = this.document.items.get(favorite.id);
    return this.document.system.addFavorite({
      type: item?.type || "item",
      id: `Actor.${this.document.id}.Item.${favorite.id}`
    });
  }

  /**
   * Handle sorting favorites
   */
  async _onSortFavorites(event, srcId) {
    const dropTarget = event.target.closest("[data-favorite-id]");
    if (!dropTarget) return;
    
    const targetId = dropTarget.dataset.favoriteId;
    if (srcId === targetId) return;

    const favorites = await Promise.all(this.document.system.favorites.map(async f => {
      if (f.id === targetId || f.id === srcId) {
        const resolved = await fromUuid(f.id);
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

    return this.document.update({ "system.favorites": Array.from(favoritesMap.values()) });
  }

  /**
   * Roll header ability item
   */
  async _onRollHeaderAbility(event, target) {
    const item = this.document.items.get(this.document.getFlag("how-to-be-a-hero", "headerAbility"));
    if (!item) return;
    return item.roll();
  }

  /**
   * Roll header weapon item
   */
  async _onRollHeaderWeapon(event, target) {
    const item = this.document.items.get(this.document.getFlag("how-to-be-a-hero", "headerWeapon"));
    if (!item) return;
    return item.roll();
  }

  /**
   * Roll header parry item with parry context
   */
  async _onRollHeaderParry(event, target) {
    const item = this.document.items.get(this.document.getFlag("how-to-be-a-hero", "headerParry"));
    if (!item) return;
    return item.roll({ isParry: true });
  }

  /**
   * Roll initiative for this actor
   */
  async _onRollInitiative(event, target) {
    return this.document.rollInitiative({ createCombatants: true });
  }

  /**
   * Toggle hit points edit mode
   */
  _onToggleEditHP(event, target) {
    const isEditing = target.dataset.edit === "true";
    const input = target.querySelector('input[name="system.attributes.health.value"]');
    const span = target.querySelector('.value');
    
    if (isEditing) {
      span.style.display = 'none';
      input.style.display = 'inline';
      input.focus();
      target.dataset.edit = "false";
    } else {
      span.style.display = 'inline';
      input.style.display = 'none';
      target.dataset.edit = "true";
    }
  }

  /**
   * Toggle mana points edit mode
   */
  _onToggleEditMana(event, target) {
    const isEditing = target.dataset.edit === "true";
    const input = target.querySelector('input[name="system.attributes.mana.value"]');
    const span = target.querySelector('.value');
    
    if (isEditing) {
      span.style.display = 'none';
      input.style.display = 'inline';
      input.focus();
      target.dataset.edit = "false";
    } else {
      span.style.display = 'inline';
      input.style.display = 'none';
      target.dataset.edit = "true";
    }
  }
}