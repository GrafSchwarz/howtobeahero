import { HowToBeAHeroItem } from '../documents/item.mjs';

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class HowToBeAHeroItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['how-to-be-a-hero', 'sheet', 'item'],
      width: 560,
      scrollY: [
        ".tab[data-tab=description] .editor-content",
      ],
      tabs: [
        {
          navSelector: '.tabs',
          contentSelector: '.sheet-body',
          initial: 'description',
        },
      ],
    });
  }

  /** @override */
  get template() {
    const path = 'systems/how-to-be-a-hero/templates/item';
    return `${path}/item-${this.item.type}-sheet.hbs`;
  }

  /** @override */
  async getData() {
    try {
      const context = await super.getData();
      const item = context.item;

      //context.item.system.calculatedValue = item.calculatedValue;
      //context.item.system.totalValue = item.totalValue;

      this._prepareBaseItemData(context, item);
      this._prepareGameConfig(context);
      this._prepareAdditionalData(context, item);

      // Prepares active effects but is not used for items at the moment!!!
      //context.effects = game.howtobeahero.managers.effects.prepareActiveEffectCategories(this.item.effects);

      return context;
    } catch (error) {
      console.error('Error in getData:', error);
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
    context.elements = this.options.elements;
    context.concealDetails = !game.user.isGM;
  }

  _getLocalizedItemType(item) {
    return game.i18n.localize(CONFIG.Item.typeLabels[item.type]);
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add bonus handlers for skills
    html.find('[data-action="incrementBonus"]').click(this._onAdjustBonus.bind(this, 1));
    html.find('[data-action="decrementBonus"]').click(this._onAdjustBonus.bind(this, -1));

    // Active Effect management
    html.on('click', '.effect-control', this._onEffectControl.bind(this));
    
    html.find(".description-edit").click(event => {
      this.editingDescriptionTarget = event.currentTarget.dataset.target;
      this.render();
    });

    // Update calculatedvalue display when base value changes
    html.find('input[name="system.value"]').on('change', (event) => {
      const newBaseValue = Number(event.target.value);
      const calculatedValueInput = html.find('input[name="system.calculatedValue"]');
      calculatedValueInput.val(this.item.calculatedValue);
    });
  }


  async _onAdjustBonus(delta, event) {
    event.preventDefault();
    const currentBonus = Number(this.item.system.roll.diceBonus) || 0;
    const newBonus = currentBonus + delta;
    await this.item.update({"system.roll.diceBonus": newBonus});
  }

  /**
   * Handle active effect actions
   * @param {Event} event The originating click event
   * @private
   */
  _onEffectControl(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const effectId = button.closest('li')?.dataset.effectId;
    const effect = this.item.effects.get(effectId);

    switch (button.dataset.action) {
      case "create":
        return this.item.createEmbeddedDocuments("ActiveEffect", [{
          label: "New Effect",
          icon: "icons/svg/aura.svg",
          origin: this.item.uuid,
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

  /** @inheritdoc */
  async _onSubmit(event, {updateData=null, preventClose=false, preventRender=false}={}) {
    return super._onSubmit(event, {updateData, preventClose, preventRender});
  }

  /** @inheritdoc 
  async _onSubmit(event, {updateData=null, preventClose=false, preventRender=false}={}) {
    // Process and validate the form data
    const formData = this._getSubmitData(updateData);
    if (!formData) return false; // Submission blocked due to validation failure

    // Adjust sheet height if the "details" tab is active
    if (this._tabs[0].active === "details") this.position.height = "auto";

    try {

      // Update the item
      await this.item.update(formData);

      // If the item is embedded in an actor, render the actor sheet
      if (this.item.actor) {
        this.item.actor.sheet.render(false);
      }

      // Call the parent _onSubmit
      return super._onSubmit(event, {updateData: formData, preventClose, preventRender});
    } catch (error) {
      console.error("Error updating item:", error);
      ui.notifications.error("Failed to update item. Please check the console for details.");
      return false;
    }
  }
  */

  /**
   * Prepare data for submission when the form is submitted.
   * @param {Object} updateData Additional data changes to apply
   * @returns {Object|null} The prepared data object, or null if the submission should be blocked
   * @private
   
  _getSubmitData(updateData={}) {
    const formData = foundry.utils.expandObject(super._getSubmitData(updateData));

    if (!this._validateFormData(formData)) return null;

    this._processFormData(formData);

    return formData;
  }
  */
  /**
   * Validate the form data
   * @param {Object} formData The form data to validate
   * @returns {boolean} Whether the form data is valid
   * @private
   
  _validateFormData(formData) {
    if (!formData.name) {
      ui.notifications.error("Item name cannot be empty.");
      return false;
    }

    if (formData.system?.value !== undefined && formData.system.value !== "" && isNaN(Number(formData.system.value))) {
      ui.notifications.error("Value must be a number.");
      return false;
    }

    return true;
  }
  */
  /**
   * Process and modify the form data as needed
   * @param {Object} formData The form data to process
   * @private
   
  _processFormData(formData) {
    if (formData.system) {
      // Process the value field
      if (formData.system.value !== undefined) {
        formData.system.value = formData.system.value === "" ? 0 : Number(formData.system.value);
        //formData.system.calculatedvalue = formData.system.value * 2;
      }

      // Process the description
      formData.system.description = formData.system.description || "";

      // Process the roll data
      if (formData.system.roll) {
        formData.system.roll.diceNum = Number(formData.system.roll.diceNum) || 1;
        formData.system.roll.diceSize = formData.system.roll.diceSize || "d100";
        formData.system.roll.diceBonus = formData.system.roll.diceBonus || "+0";
      }
    }

    // Handle image updates
    if (formData.img) {
      formData.img = formData.img.trim();
    }
  }
  */
}
