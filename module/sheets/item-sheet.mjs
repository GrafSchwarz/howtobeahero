import { HowToBeAHeroItem } from '../documents/item.mjs';

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * How To Be A Hero Item Sheet - AppV2 Implementation
 * @extends {foundry.applications.sheets.ItemSheetV2}
 */
export class HowToBeAHeroItemSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["how-to-be-a-hero", "sheet", "item"],
    position: {
      width: 560,
      height: "auto"
    },
    window: {
      resizable: true
    },
    actions: {
      effectControl: this.prototype._onEffectControl,
      editDescription: this.prototype._onEditDescription,
      updateValue: this.prototype._onUpdateValue,
      showPortrait: this.prototype._onShowPortrait,
      rollItem: this.prototype._onRollItem
    }
  };

  static PARTS = {
    form: {
      template: "systems/how-to-be-a-hero/templates/item/item-sheet.hbs",
      scrollable: [".tab[data-tab=description] .editor-content"]
    }
  };

  get title() {
    return this.document.name;
  }

  /** @override */
  async _prepareContext(options) {
    try {
      const context = await super._prepareContext(options);
      const item = this.document;

      this._prepareBaseItemData(context, item);
      this._prepareGameConfig(context);
      this._prepareAdditionalData(context, item);
      
      // Add dice type options for selects
      context.diceTypes = {
        "d4": "d4",
        "d6": "d6",
        "d8": "d8", 
        "d10": "d10",
        "d12": "d12",
        "d20": "d20",
        "d100": "d100"
      };

      // Add armor type options
      context.armorTypes = {
        "light": "Light",
        "medium": "Medium", 
        "heavy": "Heavy",
        "shield": "Shield"
      };
      
      // Prepares active effects but is not used for items at the moment!!!
      //context.effects = game.howtobeahero.managers.effects.prepareActiveEffectCategories(this.document.effects);

      // Ensure item type is available for template partials
      context.itemType = this._getLocalizedItemType(item);
      context.document = this.document; // Ensure document is available in template

      // Ensure rollable property exists with proper default for template rendering
      if (this.document.system.rollable === undefined) {
        // Set default rollable state based on item type for template
        const defaultRollable = this.document.type === 'weapon' || this.document.type === 'ability';
        console.log(`HowToBeAHero | Setting default rollable to ${defaultRollable} for ${this.document.type} item template`);
        
        // Set context for template rendering only
        context.system.rollable = defaultRollable;
      }

      return context;
    } catch (error) {
      console.error('Error in _prepareContext:', error);
      throw error;
    }
  }

  _prepareBaseItemData(context, item) {
    const source = item.toObject();
    
    context.source = source.system;
    context.system = item.system;
    context.flags = item.flags;
    context.labels = item.labels;
    context.isEmbedded = item.isEmbedded;
    context.rollData = item.getRollData();
    context.user = game.user;
  }

  _prepareGameConfig(context) {
    context.config = CONFIG.HTBAH;
  }

  _prepareAdditionalData(context, item) {
    context.itemType = this._getLocalizedItemType(item);
    context.concealDetails = !game.user.isGM;
  }

  _getLocalizedItemType(item) {
    return game.i18n.localize(CONFIG.Item.typeLabels[item.type]);
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Setup form input handling for automatic saving
    this._setupFormHandling();

    // Handle rollable checkbox changes
    const rollableCheckbox = this.element.querySelector('input[name="system.rollable"]');
    if (rollableCheckbox) {
      // Remove any existing event listeners to prevent duplicates
      rollableCheckbox.removeEventListener('change', this._onRollableChange.bind(this));
      
      // Add the event listener with proper binding
      this._rollableChangeHandler = this._onRollableChange.bind(this);
      rollableCheckbox.addEventListener('change', this._rollableChangeHandler);
      
      // Set initial height based on rollable state
      const isRollable = this.document.system.rollable ?? (this.document.type === 'weapon' || this.document.type === 'ability');
      this._updateSheetHeight(isRollable);
    }

    // Handle roll field changes for all item types that have roll fields
    const itemTypesWithRolls = ['weapon', 'item', 'consumable', 'tool'];
    if (itemTypesWithRolls.includes(this.document.type)) {
      this.element.querySelectorAll('input[name="system.roll.diceNum"], select[name="system.roll.diceSize"]').forEach(input => {
        input.addEventListener('change', this._onUpdateRollFields.bind(this));
      });
    }

    // Update calculated value display when base value changes
    const valueInput = this.element.querySelector('input[name="system.value"]');
    if (valueInput) {
      valueInput.addEventListener('change', (event) => {
        const calculatedValueInput = this.element.querySelector('input[name="system.calculatedValue"]');
        if (calculatedValueInput) {
          calculatedValueInput.value = this.document.calculatedValue;
        }
      });
    }

  }

  /**
   * Setup form input handling for ApplicationV2
   */
  _setupFormHandling() {
    console.log("HowToBeAHero | Setting up item sheet form handling");
    
    // Handle all input changes for automatic saving
    this.element.querySelectorAll('input[type="text"], input[type="number"], textarea, select').forEach(input => {
      // Skip inputs that shouldn't auto-save (like disabled fields or rollable checkbox)
      if (input.name && (input.name.startsWith('system.') || input.name === 'name') && !input.disabled && input.name !== 'system.rollable') {
        input.addEventListener('change', this._onFormInput.bind(this));
        input.addEventListener('blur', this._onFormInput.bind(this)); // Also save on blur
      }
    });
    
    // Handle checkbox inputs separately (they don't have blur events)
    this.element.querySelectorAll('input[type="checkbox"]').forEach(input => {
      if (input.name && input.name.startsWith('system.') && input.name !== 'system.rollable') {
        input.addEventListener('change', this._onFormInput.bind(this));
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
    
    console.log(`HowToBeAHero | Item form input changed: ${name} = ${value}`);
    
    if (!name || !(name.startsWith('system.') || name === 'name')) return;
    
    // Create update data
    const updateData = {};
    
    // Handle different data types
    let processedValue = value;
    if (target.dataset.dtype === "Number") {
      processedValue = Number(value) || 0;
    } else if (target.dataset.dtype === "Boolean") {
      processedValue = target.checked;
    }
    
    updateData[name] = processedValue;
    
    try {
      console.log("HowToBeAHero | Updating item with:", updateData);
      await this.document.update(updateData);
    } catch (error) {
      console.error("HowToBeAHero | Error updating item:", error);
      ui.notifications.error("Failed to save changes.");
    }
  }
  
  async _onUpdateRollFields(event) {
    event.preventDefault();
    
    // Check if roll object exists
    if (!this.document.system.roll) {
      console.warn(`HowToBeAHero | No roll data found for item ${this.document.name}`);
      return;
    }
    
    // Get current values from form inputs (they may have changed but not saved yet)
    const diceNumInput = this.element.querySelector('input[name="system.roll.diceNum"]');
    const diceSizeInput = this.element.querySelector('select[name="system.roll.diceSize"]');
    
    const diceNum = diceNumInput ? parseInt(diceNumInput.value) || 1 : this.document.system.roll.diceNum || 1;
    const diceSize = diceSizeInput ? diceSizeInput.value || 'd10' : this.document.system.roll.diceSize || 'd10';
                    
    // Create new formula without bonus (bonus will be added at roll time)
    const formula = `${diceNum}${diceSize}`;
    
    console.log(`HowToBeAHero | Updating formula to: ${formula}`);
  
    // Update the formula display
    const formulaInput = this.element.querySelector('input[name="system.formula"]');
    if (formulaInput) {
      formulaInput.value = formula;
    }
    
    // Save the formula to the document
    try {
      await this.document.update({"system.formula": formula});
    } catch (error) {
      console.error("HowToBeAHero | Error updating formula:", error);
    }
  }


  /**
   * Handle active effect actions
   * @param {Event} event The originating click event
   * @param {HTMLElement} target The clicked element
   * @private
   */
  _onEffectControl(event, target) {
    event.preventDefault();
    const effectId = target.closest('li')?.dataset.effectId;
    const effect = this.document.effects.get(effectId);
    const action = target.dataset.subAction || target.dataset.action;

    switch (action) {
      case "create":
        return this.document.createEmbeddedDocuments("ActiveEffect", [{
          label: "New Effect",
          icon: "icons/svg/aura.svg",
          origin: this.document.uuid,
          disabled: false
        }]);
      case "edit":
        return effect.sheet.render(true);
      case "delete":
        return effect.delete();
      case "toggle":
        return effect.update({disabled: !effect.disabled});
    }
  }

  /**
   * Handle description editing
   */
  _onEditDescription(event, target) {
    this.editingDescriptionTarget = target.dataset.target;
    this.render();
  }

  /**
   * Handle value updates
   */
  _onUpdateValue(event, target) {
    const newBaseValue = Number(target.value);
    const calculatedValueInput = this.element.querySelector('input[name="system.calculatedValue"]');
    if (calculatedValueInput) {
      calculatedValueInput.value = this.document.calculatedValue;
    }
  }

  /**
   * Handle portrait display or editing
   */
  _onShowPortrait(event, target) {
    const img = this.document.img;
    
    // If editable, open file picker to change the image
    if (this.isEditable) {
      const fp = new foundry.applications.apps.FilePicker.implementation({
        type: "image",
        current: img,
        callback: (path) => {
          this.document.update({ img: path });
        }
      });
      fp.render(true);
    } else {
      // In play mode, show the image popup
      new ImagePopout(img, { title: this.document.name, uuid: this.document.uuid }).render(true);
    }
  }

  /**
   * Handle rollable checkbox changes
   */
  async _onRollableChange(event) {
    // Stop event propagation to prevent bubbling
    event.stopPropagation();
    
    const checkbox = event.target;
    
    // Ensure we're handling the correct checkbox
    if (checkbox.name !== 'system.rollable') {
      console.warn(`HowToBeAHero | Unexpected checkbox triggered rollable handler: ${checkbox.name}`);
      return;
    }
    
    const isRollable = checkbox.checked;
    console.log(`HowToBeAHero | Item rollable changed to: ${isRollable}`);
    
    // Manually show/hide roll elements and update height immediately
    this._toggleRollFields(isRollable);
    this._updateSheetHeight(isRollable);
    
    // Update the document with rollable property and ensure roll object exists
    const updateData = {};
    
    // Explicitly set the rollable boolean value
    updateData["system.rollable"] = Boolean(isRollable);
    
    // If item doesn't have roll data, initialize it
    if (!this.document.system.roll) {
      updateData["system.roll"] = {
        diceNum: 1,
        diceSize: "d10"
      };
      console.log(`HowToBeAHero | Initializing roll data for item ${this.document.name}`);
    }
    
    // Also ensure formula is initialized if missing
    if (!this.document.system.formula) {
      updateData["system.formula"] = "";
    }
    
    try {
      // Always use document.update() for proper persistence across all item types
      console.log(`HowToBeAHero | Updating item rollable property via document.update()`);
      
      await this.document.update(updateData);
      console.log(`HowToBeAHero | Item updated - rollable: ${this.document.system.rollable}`);
    } catch (error) {
      console.error(`HowToBeAHero | Error updating rollable state:`, error);
      // Revert UI changes if update failed
      this._toggleRollFields(!isRollable);
      this._updateSheetHeight(!isRollable);
      checkbox.checked = !isRollable;
    }
  }

  /**
   * Toggle roll fields visibility
   */
  _toggleRollFields(isRollable) {
    const rollFields = this.element.querySelector('.roll-fields');
    const formulaField = this.element.querySelector('.formula-field');
    const rollButton = this.element.querySelector('.roll-button');
    
    if (rollFields) {
      rollFields.style.display = isRollable ? 'block' : 'none';
    }
    if (formulaField) {
      formulaField.style.display = isRollable ? 'block' : 'none';
    }
    if (rollButton) {
      rollButton.style.display = isRollable ? 'block' : 'none';
    }
  }

  /**
   * Update sheet height based on rollable state
   */
  _updateSheetHeight(isRollable) {
    if (isRollable) {
      this.element.classList.add('rollable-expanded');
    } else {
      this.element.classList.remove('rollable-expanded');
    }
  }


  /**
   * Handle item roll actions
   */
  async _onRollItem(event, target) {
    event.preventDefault();
    console.log(`HowToBeAHero | Rolling item: ${this.document.name}`);
    console.log(`HowToBeAHero | Item type: ${this.document.type}`);
    console.log(`HowToBeAHero | Item rollable: ${this.document.system.rollable}`);
    
    // Check if item is rollable
    if (!this.document.system.rollable && this.document.type !== 'ability') {
      console.warn(`HowToBeAHero | Item ${this.document.name} is not rollable - rollable: ${this.document.system.rollable}, type: ${this.document.type}`);
      ui.notifications.warn("This item is not configured as rollable.");
      return;
    }
    
    // Call the item's roll method
    await this.document.roll();
  }
}
