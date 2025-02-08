/* -------------------------------------------- */
/* D100 Roll                                     */
/* -------------------------------------------- */

export async function d100Roll({
  formula,
  data = {},
  critical = 1,
  fumble = 100,
  targetValue,
  baseValue,
  bonusValue,
  inspired,
  chatMessage = true,
  messageData = {},
  flavor,
  ...options
} = {}) {
  const roll = new CONFIG.Dice.D100Roll(formula, data, {
    flavor: options.title,
    critical,
    fumble,
    targetValue,
    inspired
  });

  await roll.evaluate();

  const inspirationBonus = inspired ? data.actor.baseattributes.inspiration.value : 0;
  const totalTargetValue = targetValue;

  const criticalThreshold = Math.floor(totalTargetValue * 0.1);
  const fumbleThreshold = Math.ceil(100 - (100 - totalTargetValue) * 0.1);

  const total = roll.total;

  roll.isSuccess = total <= totalTargetValue;
  roll.isCriticalSuccess = total <= criticalThreshold;
  roll.isCriticalFailure = total >= fumbleThreshold;

  if (chatMessage) {
    // Get roll type from flags
    const rollType = messageData.flags?.howtobeahero?.roll?.type || "default";
    const abilityName = messageData.flags?.howtobeahero?.roll?.abilityName;
    
    // Define header icons and titles based on roll type
    const headerConfig = {
      knowledge: {
        icon: '<i class="fas fa-book-open" style="color: #191970;"></i>',
        title: abilityName || game.i18n.localize("HTBAH.KnowledgeCheck")
      },
      action: {
        icon: '<i class="fas fa-fist-raised" style="color: #8B0000;"></i>',
        title: abilityName || game.i18n.localize("HTBAH.ActionCheck")
      },
      social: {
        icon: '<i class="fas fa-comments" style="color: #4B0082;"></i>',
        title: abilityName || game.i18n.localize("HTBAH.SocialCheck")
      },
      wealth: {
        icon: '<i class="fas fa-coins" style="color:rgb(255, 149, 0);"></i>',
        title: game.i18n.localize("HTBAH.WealthCheck")
      },
      talent: {
        icon: '<i class="fas fa-star" style="color: #4169E1;"></i>',
        title: abilityName || game.i18n.localize("HTBAH.Talent")
      },
      default: {
        icon: '<i class="fas fa-dice-d20"></i>',
        title: flavor || game.i18n.localize("HTBAH.Check")
      }
    };

    // Get header configuration for this roll type
    const header = headerConfig[rollType] || headerConfig.default;

    const rollDetails = `
      <div class="roll-details">
        <h3 class="roll-header">${header.title} ${header.icon}</h3>
        <p>Roll: ${total}</p>
        <p>Target: ${totalTargetValue}</p> 
        <p>(Base: ${baseValue}, Bonus: ${bonusValue}, Inspiration: +${inspirationBonus})</p>
        <p>Critical Success: ≤ ${criticalThreshold}</p>
        <p>Critical Failure: ≥ ${fumbleThreshold}</p>
      </div>
    `;

    let resultMessage = roll.isCriticalSuccess ? '<span style="color: #00ff00;"><strong>Critical Success!</strong></span>'
      : roll.isCriticalFailure ? '<span style="color: #ff0000;"><strong>Critical Failure!</strong></span>'
      : roll.isSuccess ? '<span style="color: #0000ff;"><strong>Success</strong></span>'
      : '<span style="color: #ff8800;"><strong>Failure</strong></span>';

    messageData.content = (messageData.content || "") + `${rollDetails}<br>${resultMessage}`;
    await roll.toMessage(messageData);
  }

  return roll;
}

/* -------------------------------------------- */
/* D10 Roll                                     */
/* -------------------------------------------- */


export async function d10Roll({
  formula = "1d10",
  data = {},
  critical = false,
  bonusValue = 0,
  inspiration = false,
  target = null,
  chatMessage = true,
  messageData = {},
  flavor,
  ...options
} = {}) {
  // Create the roll instance
  const roll = new CONFIG.Dice.D10Roll(formula, data, {
    flavor: options.title || flavor,
    critical,
    bonusValue,
    inspiration,
    target
  });

  // Evaluate the roll
  await roll.evaluate();

  // Send chat message if requested
  if (chatMessage) {
    await roll.toMessage(messageData);
  }

  return roll;
}