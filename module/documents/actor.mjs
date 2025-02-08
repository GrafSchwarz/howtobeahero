import { d100Roll, d10Roll } from "../dice/dice.mjs";


export class HowToBeAHeroActor extends Actor {
  /**
 * Getter for talent total values
 */
  get talentTotalValues() {
    const result = {};
    for (const [key, talent] of Object.entries(this.system.baseattributes.talents)) {
      result[key] = (talent.value || 0) + 
                    (talent.bonus || 0) + 
                    (this.system.baseattributes.inspiration.status ? this.system.baseattributes.inspiration.value : 0);
    }
    return result;
  }

  /**
   * Prepare base data before other preparations
   */
  prepareData() {
    super.prepareData();
    const systemData = this.system;
    const flags = this.flags.howtobeahero || {};

    this._prepareCharacterData();
    this._prepareNpcData();

    this._prepareSharedValues();
  }

  _prepareCharacterData() {
    if (this.type !== 'character') return;
    // Character-specific preparations...
  }

  _prepareNpcData() {
    if (this.type !== 'npc') return;
    // NPC-specific preparations...
  }

  /**
   * Calculate and update shared values for all talents
   * @private
   */
  _prepareSharedValues() {
    if (!this.system?.baseattributes?.talents) return;
    
    const totalValues = this.talentTotalValues;
    // Update the system data with the new values
    for (const [key, talent] of Object.entries(this.system.baseattributes.talents)) {
      this.system.baseattributes.talents[key].totalValue = totalValues[key];
    }
  }

  getRollData() {
    const data = super.getRollData();
    return this.type === 'character' ? this._getCharacterRollData(data) : this._getNpcRollData(data);
  }

  _getCharacterRollData(data) {
    return this.prepareGeneralRollData(data);
  }

  _getNpcRollData(data) {
    return this.prepareGeneralRollData(data);
  }

  prepareGeneralRollData(data) {
    if (data.baseattributes.talents) {
      for (let [k, v] of Object.entries(data.baseattributes.talents)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }
    return data;
  }

  async rollDamage(damageData, options={}) {
    const label = damageData.label || "";
    const data = this.getRollData();
    const critical = damageData.critical || false;
    const bonusValue = damageData.bonus || 0;
    const inspired = this.system.baseattributes.inspiration.status;
    const target = damageData.target || null;
    const flavor = game.i18n.localize("HTBAH.DamageRollPrompt");

    const rollData = {
      formula: "1d10",
      data: {
        actor: data,
        item: null
      },
      title: `${flavor}: ${label}`,
      flavor,
      critical,
      bonusValue,
      inspiration: inspired,
      target,
      messageData: {
        speaker: options.speaker || ChatMessage.getSpeaker({actor: this}),
        "flags.howtobeahero.roll": {type: "damage", data: damageData}
      }
    };

    const roll = await d10Roll(rollData);
    Hooks.callAll("howToBeAHeroDamageRolled", this, damageData, roll);
    return roll;
  }

  /**
   * Perform a wealth check for the actor
   * @returns {Promise<Roll>} The resulting roll
   */
  async rollWealth() {
    const wealth = this.system.details.wealth;
    const inspired = false; //this.system.baseattributes.inspiration.status;
    
    const rollData = {
      formula: "1d100",
      targetValue: wealth.value,
      baseValue: wealth.value,
      bonusValue: wealth.bonus || 0,
      inspired,
      flavor: game.i18n.localize("HTBAH.WealthCheck"),
      messageData: {
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flags: {
          howtobeahero: {
            roll: { type: "wealth" }
          }
        }
      }
    };

    const roll = await d100Roll(rollData);
    return roll;
  }

  async rollTalent(talentId, options={}) {
    const label = game.i18n.localize(CONFIG.HTBAH.talents[talentId]?.label) ?? "";
    const data = this.getRollData();
    const targetValue = this.talentTotalValues[talentId];
    const baseValue = this.system.baseattributes.talents[talentId]?.value ?? 0;
    const bonusValue = this.system.baseattributes.talents[talentId]?.bonus ?? 0;
    const inspired = this.system.baseattributes.inspiration.status;
    const flavor = game.i18n.localize("HTBAH.TalentCheckPromptTitle");

    const rollData = {
      formula: "1d100",
      data: {
        actor: data,
        item: null
      },
      title: `${flavor}: ${label}`,
      flavor,
      targetValue,
      baseValue,
      bonusValue,
      inspired,
      messageData: {
        speaker: options.speaker || ChatMessage.getSpeaker({actor: this}),
        flags: {
          howtobeahero: {
            roll: { type: talentId, talentId }
          }
        }
      }
    };

    const roll = await d100Roll(rollData);
    Hooks.callAll("howToBeAHeroTalentRolled", this, talentId, roll);
    return roll;
  }

  _onItemUpdate(item, change, options, userId) {
    const talentKey = item.type;
    if (!["knowledge", "action", "social"].includes(talentKey)) return;

    const currentValue = this.system.baseattributes.talents[talentKey].value || 0;
    const oldValue = options.htbah?.oldValue || 0;
    
    let newValue = change.system?.value !== undefined
      ? (change.system.value >= 80 ? change.system.value * 0.1 + 10 : change.system.value * 0.1)
      : oldValue;

    let newTalentValue = currentValue === 0 ? newValue : currentValue - oldValue + newValue;

    this.update({
      [`system.baseattributes.talents.${talentKey}.value`]: newTalentValue
    });
  }
}

// Add these hooks at the end of the file
Hooks.on("preUpdateItem", (item, change, options, userId) => {
  if (item.parent instanceof HowToBeAHeroActor) {
    // Store the old value on the options object
    options.htbah = options.htbah || {};
    options.htbah.oldValue = item.system.value >= 80 
      ? item.system.value * 0.1 + 10  // 18 for a value of 80
      : item.system.value * 0.1;
  }
});

Hooks.on("updateItem", (item, change, options, userId) => {
  if (item.parent instanceof HowToBeAHeroActor) {
    item.parent._onItemUpdate(item, change, options, userId);
  }
});

Hooks.on("createItem", (item, options, userId) => {
  if (item.parent instanceof HowToBeAHeroActor) {
    const change = { system: { value: item.system.value } };
    item.parent._onItemUpdate(item, change, { htbah: { oldValue: 0 } }, userId);
  }
});

Hooks.on("deleteItem", (item, options, userId) => {
  if (item.parent instanceof HowToBeAHeroActor) {
    const change = { system: { value: 0 } };
    const oldValue = item.system.value >= 80 
      ? item.system.value * 0.1 + 10  // 18 for a value of 80
      : item.system.value * 0.1;
    item.parent._onItemUpdate(item, change, { htbah: { oldValue } }, userId);
  }
});