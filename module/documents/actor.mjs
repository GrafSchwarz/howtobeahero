import { d100Roll, d10Roll } from "../dice/dice.mjs";
import { HowToBeAHeroRollDialog } from "../apps/roll-dialog.mjs";


export class HowToBeAHeroActor extends Actor {
  /**
   * Prepare base data before other preparations
   */
  prepareData() {
    super.prepareData();
    const systemData = this.system;
    const flags = this.flags.howtobeahero || {};

    this._prepareCharacterData();
    this._prepareNpcData(); 
    this._prepareSkillSets();
    this._prepareArmorClass();
  }

  /**
   * Prepare skill set calculations for easy access
   * @private
   */
  _prepareSkillSets() {
    // Initialize skillSetTotalValues and skillSetMods if they don't exist
    this.skillSetTotalValues = {};
    this.skillSetMods = {};
    this.skillSetData = {};

    // Get all abilities from the actor
    const abilities = this.items.filter(item => item.type === 'ability');

    // Process each skill set defined in config
    for (const [key, def] of Object.entries(CONFIG.HTBAH.skillSets)) {
      // Filter abilities that belong to this skill set
      const skillSetAbilities = abilities.filter(ab =>
        String(ab.system?.skillSet ?? "").trim().toLowerCase() === key.toLowerCase()
      );

      // Calculate total value from all abilities in this skill set
      const totalValue = skillSetAbilities.reduce((sum, ab) => sum + (ab.system.value ?? 0), 0);
      
      // Calculate modifier (total value / 10, rounded)
      const mod = Math.round(totalValue / 10);
      
      // Get eureka data
      const eurekaValue = this.system.attributes.skillSets?.[key]?.eureka ?? 0;
      const eurekaMax = Math.round(totalValue / 100);

      // Store the calculated values
      this.skillSetTotalValues[key] = totalValue;
      this.skillSetMods[key] = mod;
      
      // Store complete skill set data for easy access
      this.skillSetData[key] = {
        key,
        label: game.i18n.localize(def.label),
        abilities: skillSetAbilities,
        totalValue,
        mod,
        eureka: {
          value: eurekaValue,
          max: eurekaMax
        }
      };

      // Update ability totals (base value + modifier)
      skillSetAbilities.forEach(ab => {
        ab.system.total = (ab.system.value ?? 0) + mod;
      });
    }
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
   * Prepare armor class calculation from equipped armor items only
   * @private
   */
  _prepareArmorClass() {
    
    // Get all equipped armor items
    const equippedArmor = this.items.filter(item => 
      item.type === 'armor' && item.system.equipped === true
    );
    
    // Calculate total armor value from equipped items only
    const totalArmorClass = equippedArmor.reduce((total, armor) => {
      const armorValue = armor.system.armor || 0;
      return total + armorValue;
    }, 0);
    
    // Store the calculated values for easy access
    this.armorData = {
      equipped: totalArmorClass,
      total: totalArmorClass,
      equippedItems: equippedArmor.map(armor => ({
        id: armor.id,
        name: armor.name,
        armorValue: armor.system.armor || 0
      }))
    };
  }

  getRollData() {
    const data = super.getRollData();

    data.skillSets = this.skillSetData;
    data.skillSetTotalValues = this.skillSetTotalValues;
    data.skillSetMods = this.skillSetMods;
    
    return this.type === 'character' ? this._getCharacterRollData(data) : this._getNpcRollData(data);
  }

  _getCharacterRollData(data) {
    return this.prepareGeneralRollData(data);
  }

  _getNpcRollData(data) {
    return this.prepareGeneralRollData(data);
  }

  prepareGeneralRollData(data) {
    return data;
  }

  async rollDamage(damageData, options={}) {
    const label = damageData.label || "";
    const data = this.getRollData();
    const critical = damageData.critical || false;
    const bonusValue = damageData.bonus || 0;
    const target = damageData.target || null;
    const flavor = game.i18n.localize("HTBAH.DamageRollPrompt");
    
    // Use the formula from damageData if provided, otherwise default to 1d10
    const formula = damageData.formula || "1d10";

    const rollData = {
      formula: formula,
      data: {
        actor: data,
        item: null
      },
      title: `${flavor}: ${label}`,
      flavor,
      critical,
      bonusValue,
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

  async rollSkillSet(skillSetId, options={}) {
    if (!this.skillSetTotalValues) {
      this._prepareSkillSets();
    }

    const label = game.i18n.localize(CONFIG.HTBAH.skillSets[skillSetId]?.label) ?? "";
    // Category rolls use the 10% modifier value, not the total value
    const targetValue = this.skillSetMods[skillSetId] ?? 0;
    const baseValue = this.skillSetMods[skillSetId] ?? 0; 
    
    // Create a fake ability item for the dialog to work with
    const fakeAbilityItem = {
      name: label,
      type: "ability",
      system: {
        value: targetValue,
        skillSet: skillSetId
      }
    };
    
    // Show the roll dialog
    const roll = await HowToBeAHeroRollDialog.show({
      item: fakeAbilityItem,
      baseFormula: "1d100",
      rollType: "skillSet"
    });
    
    if (!roll) return null; // User cancelled
    
    Hooks.callAll("HowToBeAHeroAbilitySetRolled", this, skillSetId, roll);
    return roll;
  }

  /**
   * Roll initiative for this Actor
   * @param {Object} options - Options for rolling initiative
   * @returns {Promise<Combat>} The combat instance
   */
  async rollInitiative(options = {}) {
    // Ensure skill sets are prepared
    if (!this.skillSetTotalValues) {
      this._prepareSkillSets();
    }

    // Get the action skill set modifier for initiative
    const actionMod = this.skillSetMods?.action ?? 0;
    
    // Create the initiative formula: 1d10 + action modifier
    const formula = `1d10 + ${actionMod}`;
    
    // Roll the initiative
    const roll = new Roll(formula);
    await roll.evaluate();
    
    // Create or update combat
    const combat = game.combat;
    if (!combat) {
      ui.notifications.warn("No active combat to roll initiative for.");
      return null;
    }
    
    // Add combatant if requested and not already present
    if (options.createCombatants && !combat.getCombatantsByActor(this.id).length) {
      await combat.createEmbeddedDocuments("Combatant", [{
        actorId: this.id,
        tokenId: this.token?.id
      }]);
    }
    
    // Find the combatant
    const combatant = combat.getCombatantsByActor(this.id)[0];
    if (combatant) {
      // Update the combatant's initiative
      await combat.setInitiative(combatant.id, roll.total);
      
      // Send chat message showing the initiative roll
      const messageContent = `
        <div class="htbah-initiative-roll">
          <div class="roll-header">
            <h3><i class="fas fa-dice-d20" style="color: #8B0000;"></i> ${this.name} - Initiative</h3>
          </div>
          <div class="roll-result">
            <h2 style="color: #8B0000; font-weight: bold;">Initiative: ${roll.total}</h2>
          </div>
          <div class="roll-breakdown">
            <p>Roll: ${await roll.render()}</p>
            <p>Action Modifier: +${actionMod}</p>
            <p><strong>Total: ${roll.total}</strong></p>
          </div>
        </div>
      `;
      
      const messageData = {
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({actor: this}),
        content: messageContent,
        sound: CONFIG.sounds.dice
      };
      
      await ChatMessage.create(messageData);
    }
    
    return combat;
  }
}