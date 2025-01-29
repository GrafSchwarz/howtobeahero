import HowToBeAHeroActorBase from "./actor-base.mjs";

export default class HowToBeAHeroCharacter extends HowToBeAHeroActorBase {
/**
 * System data definition for characters.
 *
* @property {number} attributes.eureka                   Number of eureka points per session. Resets each session
 */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();
    
    // Add eureka to each talent in baseattributes
    schema.baseattributes.fields.talents.fields.knowledge.fields.eureka = 
      new fields.NumberField({...requiredInteger, initial: 0, label: "HOW_TO_BE_A_HERO.Talents.Knowledge.eureka"});
    schema.baseattributes.fields.talents.fields.action.fields.eureka = 
      new fields.NumberField({...requiredInteger, initial: 0, label: "HOW_TO_BE_A_HERO.Talents.Action.eureka"});
    schema.baseattributes.fields.talents.fields.social.fields.eureka = 
      new fields.NumberField({...requiredInteger, initial: 0, label: "HOW_TO_BE_A_HERO.Talents.Social.eureka"});
      
    schema.favorites = new fields.ArrayField(new fields.SchemaField({
      type: new fields.StringField({ required: true, blank: false }),
      id: new fields.StringField({ required: true, blank: false }),
      sort: new fields.IntegerSortField()
    }), { label: "HTBAH.Favorites" });

    return schema;
  }

  // Override richTooltip if you need character-specific tooltip content
  async richTooltip() {
    const baseTooltip = await super.richTooltip();
    const characterContent = await renderTemplate("systems/how-to-be-a-hero/templates/actor/parts/character-tooltip.hbs", {
      name: this.parent.name
    });

    return {
      content: baseTooltip.content + characterContent,
      classes: [...baseTooltip.classes, 'htbah-character-tooltip']
    };
  }

  prepareDerivedData() {
    console.log("prepareDerivedData called");
    super.prepareDerivedData();
    this._updateArmorValue();
  }

  _updateArmorValue() {
    const equippedArmor = this.parent.items.filter(item => 
      item.type === "armor" && item.system.equipped);
    const totalArmorValue = equippedArmor.reduce((sum, armor) => 
      sum + (armor.system.armor || 0), 0);
    this.parent.system.baseattributes.armor.value = totalArmorValue;
  }

  addFavorite(favorite) {
    console.log("addFavorite called with:", favorite);
    
    const fullUUID = this._getFullUUID(favorite.id);
    console.log("Generated fullUUID:", fullUUID);
    
    if (this.hasFavorite(fullUUID)) {
      console.log("Item is already a favorite:", fullUUID);
      return;
    }

    const favorites = this.favorites.concat([{
      type: favorite.type,
      id: fullUUID,
      sort: (this.favorites[this.favorites.length - 1]?.sort ?? 0) + CONST.SORT_INTEGER_DENSITY
    }]);

    console.log("New favorites array:", favorites);
    console.log("Item collection within addFavourite function:", this.parent.collections)
    return this.parent.update({ "system.favorites": favorites });
  }

  removeFavorite(favoriteId) {
    console.log("removeFavorite called with:", favoriteId);
    
    const fullUUID = this._getFullUUID(favoriteId);
    console.log("Generated fullUUID for removal:", fullUUID);
    
    const favorites = this.favorites.filter(f => f.id !== fullUUID);
    console.log("Favorites after removal:", favorites);
    
    return this.parent.update({ "system.favorites": favorites });
  }

  hasFavorite(favoriteId) {
    console.log("hasFavorite called with:", favoriteId);
    
    const fullUUID = this._getFullUUID(favoriteId);
    console.log("Generated fullUUID for check:", fullUUID);
    
    const exists = this.favorites.some(f => f.id === fullUUID);
    console.log("Favorite exists:", exists);
    
    return exists;
  }

  _getFullUUID(id) {
    console.log("_getFullUUID called with:", id);
    
    // If it's already a full UUID, return as is
    if (id.includes(".")) {
      console.log("ID is already a full UUID, returning as is");
      return id;
    }
    
    // Get the base actor if this is a token actor
    const baseActor = this.parent.isToken ? this.parent.actor : this.parent;
    
    // Construct the UUID using just the Actor and Item
    const fullUUID = `Actor.${baseActor.id}.Item.${id}`;
    console.log("Generated full UUID:", fullUUID);
    return fullUUID;
  }
}