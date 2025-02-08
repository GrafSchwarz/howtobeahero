import { d100Roll } from "../dice/dice.mjs";
/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class HowToBeAHeroItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }
  
  /**
   * Getter for calculatedValue
   * Getter for totalValue
   * Getter for formula
   * @type {number}
   */
  get formula() {
    const roll = this.system.roll;
    if (!roll) return '';
    const bonusStr = roll.diceBonus > 0 ? `+${roll.diceBonus}` : roll.diceBonus === 0 ? '' : roll.diceBonus;
    return `${roll.diceNum}${roll.diceSize}${bonusStr}`;
  }

  get calculatedValue() {
    if (this.system.value >= 80) return this.system.value;
    if (!this.actor) return this.system.value;
    
    const talentValue = this.actor.system.baseattributes.talents[this.type]?.value || 0;
    return Math.min(80, talentValue + this.system.value);
  }

  get totalValue() {
    const bonus = Number(this.system?.roll?.diceBonus ?? 0);
    const inspiration = this.actor?.system?.baseattributes?.inspiration?.status ? this.actor?.system?.baseattributes?.inspiration?.value : 0;
    return this.calculatedValue + bonus + inspiration;
   }
  /**
   * @override
   * Augment the item source data with additional dynamic data that isn't 
   * handled by the actor's DataModel. Data calculated in this step should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    //const actorData = this;
    //const flags = itemData.flags.howtobeahero || {};
    super.prepareDerivedData();
    this.labels = {}
    
    // Calculate and set the calculatedValue
    //this.system.calculatedValue = this.calculatedValue;
    //this.system.totalValue = this.totalValue;

    // Specialized preparation per Item type
    switch ( this.type ) {
      case "baseitem":
        this._prepareBaseItem(); break;
      case "item":
        this._prepareItem(); break;
      case "consumable":
        this._prepareConsumable(); break;
      case "weapon":
        this._prepareWeapon(); break;
      case "armor":
        this._prepareArmor(); break;
      case "tool":
        this._prepareTool(); break;
      case "knowledge":
        this._prepareKnowledge(); break;
      case "action":
        this._prepareAction(); break;
      case "social":
        this._prepareSocial(); break;
    }
  }

  /* -------------------------------------------- */

  /**
    * Prepare derived data for a baseitem-type item and define labels.
    * @protected
    */
  _prepareBaseItem() {

  }

  /* -------------------------------------------- */

  /**
    * Prepare derived data for an item-type item and define labels.
    * @protected
    */
  _prepareItem() {

  }

  /* -------------------------------------------- */  

  /**
    * Prepare derived data for an consumable-type item and define labels.
    * @protected
    */
  _prepareConsumable() {

  }

  /* -------------------------------------------- */  
    
  /**
   * Prepare derived data for an weapon-type item and define labels.
   * @protected
   */
  _prepareWeapon() {
    
  }

  /* -------------------------------------------- */  

  /**
   * Prepare derived data for an armor-type item and define labels.
   * @protected
   */
  _prepareArmor() {
    //this.labels.armor = this.system.armor.value ? `${this.system.armor.value} ${game.i18n.localize("DND5E.AC")}` : "";
  }

  /* -------------------------------------------- */  

  /**
   * Prepare derived data for an tool-type item and define labels.
   * @protected
   */
  _prepareTool() {

  }
  
  /* -------------------------------------------- */

  /**
   * Prepare derived data for an skill-type item and define labels.
   * @protected
   */
  _prepareKnowledge() {
    this._prepareSharedSkillValues();
  }
  
  /* -------------------------------------------- */

  /**
   * Prepare derived data for an skill-type item and define labels.
   * @protected
   */
  _prepareAction() {
    this._prepareSharedSkillValues();
  }
  
  /* -------------------------------------------- */

  /**
   * Prepare derived data for an skill-type item and define labels.
   * @protected
   */
  _prepareSocial() {
    this._prepareSharedSkillValues();
  }
  /**
   * Prepare shared data for an skill-type item.
   * @protected
   */

  _prepareSharedSkillValues() {
    this.system.calculatedValue = this.calculatedValue;
    this.system.totalValue = this.totalValue;
    this.system.formula = this.formula;
  }

  /* -------------------------------------------- */
  
/**
 * Prepare a data object which defines the data schema used by dice roll commands against this Item
 * @override
 */
async roll() {
  const item = this;
  const actor = this.actor;
  if (!actor) return;

  const speaker = ChatMessage.getSpeaker({ actor: actor });
  const rollMode = game.settings.get('core', 'rollMode');
  const label = `[${item.type}] ${item.name}`;

  // Handle non-rollable items
  if (!this.system.formula) {
    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      flavor: label,
      content: item.system.description ?? ''
    });
    return;
  }

  const rollData = this.getRollData();
  const rollType = this.system.rollType || "check";

  if (rollType === "damage") {
    const damageData = {
      label: item.name,
      critical: false,
      bonus: rollData.item.roll.diceBonus,
      target: null
    };

    return actor.rollDamage(damageData, {
      speaker: speaker,
      rollMode: rollMode,
      flavor: label
    });
  } else {
    // Regular ability check using d100
    const targetValue = rollData.item.totalValue;
    const baseValue = rollData.item.calculatedValue;
    const bonusValue = rollData.item.roll.diceBonus;
    const inspired = rollData.actor.baseattributes.inspiration.status;
    
    // Get localized ability name
    const abilityName = rollData.item.name;
    const flavor = game.i18n.format("HTBAH.ItemRollPrompt", {
      itemName: item.name,
      ability: abilityName
    });

    // Determine the category type for the icon
    let category;
    switch(item.type) {
      case "knowledge":
        category = "knowledge";
        break;
      case "action":
        category = "action";
        break;
      case "social":
        category = "social";
        break;
      default:
        category = "item";
    }

    const itemRollData = {
      formula: rollData.item.formula,
      data: rollData,
      title: `${flavor}: ${actor.name}`,
      flavor,
      targetValue,
      baseValue,
      bonusValue,
      inspired,
      messageData: {
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        flags: {
          howtobeahero: {
            roll: {
              type: category,
              itemId: this.id,
              abilityName: abilityName
            }
          }
        }
      }
    };

    const roll = await d100Roll(itemRollData);
    Hooks.callAll("howToBeAHeroItemRolled", this, roll);
    return roll;
  }
}

getRollData() {
  const rollData = { 
    item: { ...this.system, name: this.name, type: this.type },
    actor: this.actor ? this.actor.getRollData() : null
  };

  if (this.system.formula) {
    rollData.item.formula = this.system.formula;
  }

  return rollData;
}

  
  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _preCreate(data, options, user) {
    if ( (await super._preCreate(data, options, user)) === false ) return false;

    if ( !this.isEmbedded ) return;
    const isNPC = this.parent.type === "npc";
    let updates;
    switch (data.type) {
      case "Item":
        updates = this._onCreateOwnedItem(data, isNPC);
        break;
      case "consumable":
        updates = this._onCreateOwnedConsumable(data, isNPC);
        break;
      case "weapon":
        updates = this._onCreateOwnedWeapon(data, isNPC);
        break;
      case "armor":
        updates = this._onCreateOwnedArmor(data, isNPC);
        break;
      case "tool":
        updates = this._onCreateOwnedTool(data, isNPC);
        break;
      case "knowledge":
        updates = this._onCreateOwnedKnowledge(data, isNPC);
        break;
      case "action":
        updates = this._onCreateOwnedAction(data, isNPC);
        break;
      case "social":
        updates = this._onCreateOwnedSocial(data, isNPC);
        break;
    }
    if ( updates ) return this.updateSource(updates);
  }
  
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onCreate(data, options, userId) {
    // Not yet needed
    super._onCreate(data, options, userId);
    if ( (userId !== game.user.id) || !this.parent ) return;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _preUpdate(changed, options, user) {
    // Not yet needed
    if ( (await super._preUpdate(changed, options, user)) === false ) return false;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onDelete(options, userId) {
    // Not yet needed
    super._onDelete(options, userId);
    if ( userId !== game.user.id ) return;
  }

  /* -------------------------------------------- */

  /**
   * Pre-creation logic for the automatic configuration of owned equipment type Items.
   *
   * @param {object} data       Data for the newly created item.
   * @param {boolean} isNPC     Is this actor an NPC?
   * @returns {object}          Updates to apply to the item data.
   * @private
   */
  _onCreateOwnedItem(data, isNPC) {
    const updates = {};
    /*
    if ( foundry.utils.getProperty(data, "system.equipped") === undefined ) {
      updates["system.equipped"] = isNPC;  // NPCs automatically equip equipment
    }
    */
    return updates;
  }

  /* -------------------------------------------- */

  /**
   * Pre-creation logic for the automatic configuration of owned consumable type Items.
   *
   * @param {object} data       Data for the newly created item.
   * @param {boolean} isNPC     Is this actor an NPC?
   * @returns {object}          Updates to apply to the item data.
   * @private
   */
  _onCreateOwnedConsumable(data, isNPC) {
    const updates = {};
    /*
    if ( foundry.utils.getProperty(data, "system.equipped") === undefined ) {
      updates["system.equipped"] = isNPC;  // NPCs automatically equip equipment
    }
    */
    return updates;
  }

  /* -------------------------------------------- */

  /**
   * Pre-creation logic for the automatic configuration of owned weapon type Items.
   * @param {object} data       Data for the newly created item.
   * @param {boolean} isNPC     Is this actor an NPC?
   * @returns {object|void}     Updates to apply to the item data.
   * @private
   */
  _onCreateOwnedWeapon(data, isNPC) {
    if ( !isNPC ) return;
    // NPCs automatically equip items.
    const updates = {};
    /*
    if ( !foundry.utils.hasProperty(data, "system.equipped") ) updates["system.equipped"] = true;
    */
    return updates;
  }

  /* -------------------------------------------- */

  /**
   * Pre-creation logic for the automatic configuration of owned armor type Items.
   * @param {object} data       Data for the newly created item.
   * @param {boolean} isNPC     Is this actor an NPC?
   * @returns {object|void}     Updates to apply to the item data.
   * @private
   */
  _onCreateOwnedArmor(data, isNPC) {
    if ( !isNPC ) return;
    // NPCs automatically equip items.
    const updates = {};
    /*
    if ( !foundry.utils.hasProperty(data, "system.equipped") ) updates["system.equipped"] = true;
    */
    return updates;
  }

  /* -------------------------------------------- */

  /**
   * Pre-creation logic for the automatic configuration of owned armor type Items.
   * @param {object} data       Data for the newly created item.
   * @param {boolean} isNPC     Is this actor an NPC?
   * @returns {object|void}     Updates to apply to the item data.
   * @private
   */
  _onCreateOwnedTool(data, isNPC) {
    if ( !isNPC ) return;
    // NPCs automatically equip items.
    const updates = {};
    /*
    if ( !foundry.utils.hasProperty(data, "system.equipped") ) updates["system.equipped"] = true;
    */
    return updates;
  }

  /* -------------------------------------------- */

  /**
   * Pre-creation logic for the automatic configuration of owned feature type Items.
   * @param {object} data       Data for the newly created item.
   * @param {boolean} isNPC     Is this actor an NPC?
   * @returns {object}          Updates to apply to the item data.
   * @private
   */
  _onCreateOwnedKnowledge(data, isNPC) {
    const updates = {};
    /*
    if ( isNPC && !foundry.utils.getProperty(data, "system.type.value") ) {
      updates["system.type.value"] = "monster"; // Set features on NPCs to be 'monster features'.
    }
    */
    return updates;
  }

  /**
   * Pre-creation logic for the automatic configuration of owned feature type Items.
   * @param {object} data       Data for the newly created item.
   * @param {boolean} isNPC     Is this actor an NPC?
   * @returns {object}          Updates to apply to the item data.
   * @private
   */
  _onCreateOwnedAction(data, isNPC) {
    const updates = {};
    /*
    if ( isNPC && !foundry.utils.getProperty(data, "system.type.value") ) {
      updates["system.type.value"] = "monster"; // Set features on NPCs to be 'monster features'.
    }
    */
    return updates;
  }

  /**
   * Pre-creation logic for the automatic configuration of owned feature type Items.
   * @param {object} data       Data for the newly created item.
   * @param {boolean} isNPC     Is this actor an NPC?
   * @returns {object}          Updates to apply to the item data.
   * @private
   */
  _onCreateOwnedSocial(data, isNPC) {
    const updates = {};
    /*
    if ( isNPC && !foundry.utils.getProperty(data, "system.type.value") ) {
      updates["system.type.value"] = "monster"; // Set features on NPCs to be 'monster features'.
    }
    */
    return updates;
  }

  /* -------------------------------------------- */
  /*  Factory Methods                             */
  /* -------------------------------------------- */

  /**
   * Spawn a dialog for creating a new Item.
   * @param {object} [data]  Data to pre-populate the Item with.
   * @param {object} [context]
   * @param {HowToBeAHeroActorSheet} [context.parent]       A parent for the Item.
   * @param {string|null} [context.pack]     A compendium pack the Item should be placed in.
   * @param {string[]|null} [context.types]  A list of types to restrict the choices to, or null for no restriction.
   * @returns {Promise<HowToBeAHeroItemSheet|null>}
   */
  static async createDialog(data={}, { parent=null, pack=null, types=null, ...options }={}) {
    types ??= game.documentTypes[this.documentName].filter(t => (t !== CONST.BASE_DOCUMENT_TYPE));
    console.log("Document Types:", game.documentTypes[this.documentName]);
    console.log("Filtered Types:", types);
    if ( !types.length ) return null;
    const collection = parent ? null : pack ? game.packs.get(pack) : game.collections.get(this.documentName);
    const folders = collection?._formatFolderSelectOptions() ?? [];
    const label = game.i18n.localize(this.metadata.label);
    const title = game.i18n.format("DOCUMENT.Create", { type: label });
    const name = data.name || game.i18n.format("DOCUMENT.New", { type: label });
    let type = data.type || CONFIG[this.documentName]?.defaultType;
    if ( !types.includes(type) ) type = types[0];
    const content = await renderTemplate("systems/how-to-be-a-hero/templates/apps/document-create.hbs", {
      folders, name, type,
      folder: data.folder,
      hasFolders: folders.length > 0,
      types: types.reduce((arr, type) => {
        const label = CONFIG[this.documentName]?.typeLabels?.[type] ?? type;console.log(CONFIG.Item.typeLabels);
        arr.push({
          type,
          label: game.i18n.has(label) ? game.i18n.localize(label) : type,
          icon: this.getDefaultArtwork({ type })?.img ?? "icons/svg/item-bag.svg"
        });
        return arr;
      }, []).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
    });
    return Dialog.prompt({
      title, content,
      label: title,
      render: html => {
        const app = html.closest(".app");
        const folder = app.querySelector("select");
        if ( folder ) app.querySelector(".dialog-buttons").insertAdjacentElement("afterbegin", folder);
        app.querySelectorAll(".window-header .header-button").forEach(btn => {
          const label = btn.innerText;
          const icon = btn.querySelector("i");
          btn.innerHTML = icon.outerHTML;
          btn.dataset.tooltip = label;
          btn.setAttribute("aria-label", label);
        });
        app.querySelector(".document-name").select();
      },
      callback: html => {
        const form = html.querySelector("form");
        const fd = new FormDataExtended(form);
        const createData = foundry.utils.mergeObject(data, fd.object, { inplace: false });
        if ( !createData.folder ) delete createData.folder;
        if ( !createData.name?.trim() ) createData.name = this.defaultName();
        return this.create(createData, { parent, pack, renderSheet: true });
      },
      rejectClose: false,
      options: { ...options, jQuery: false, width: 350, classes: ["how-to-be-a-hero", "create-document", "dialog"] }
    });
  }
  /* -------------------------------------------- */

  /** @inheritDoc */
  static getDefaultArtwork(itemData={}) {
    const { type } = itemData;
    const { img } = super.getDefaultArtwork(itemData);
    return { img: CONFIG.HTBAH.defaultArtwork.Item[type] ?? img };
  }
}
