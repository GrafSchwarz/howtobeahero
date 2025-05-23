import HowToBeAHeroSkill from "./ability.mjs";

export default class HowToBeAHeroSocial extends HowToBeAHeroSkill {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();
    
    return schema
  }
}