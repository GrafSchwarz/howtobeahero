import HowToBeAHeroPhysical from "./physical.mjs";

export default class HowToBeAHeroConsumable extends HowToBeAHeroPhysical {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();
    
    schema.type = new fields.StringField({label: "HTBAH.Type"});
    schema.duration = new fields.StringField({label: "HTBAH.Duration"});

    return schema;
  }

  async richTooltip() {
    const baseTooltip = await super.richTooltip();
    const itemContent = await renderTemplate("systems/how-to-be-a-hero/templates/item/parts/consumable-tooltip.hbs", {
      type: this.type,
      formula: this.formula,
      quantity: this.quantity
    });
    return {
      content: baseTooltip.content + itemContent,
      classes: [...baseTooltip.classes]
    };
  }

  async getFavoriteData() {
    return foundry.utils.mergeObject(await super.getFavoriteData(), {
      subtitle: this.type
    });
  }
}