const { generateDeck } = require('./cards');

function createInitialState() {
  const playerDeck = generateDeck();
  const aiDeck = generateDeck();

  const playerHand = playerDeck.splice(0, 5);
  const aiHand = aiDeck.splice(0, 5);

  return {
    gameId: 'clash_' + Date.now(),
    status: 'ACTIVE', // 'ACTIVE', 'PLAYER_WON', 'AI_WON'
    turn: 1,
    currentPhase: 'PLAYER_TURN', // 'PLAYER_TURN', 'AI_TURN'
    player: {
      name: 'Pilot',
      hp: 100,
      maxHp: 100,
      shield: 0,
      energy: 3,
      maxEnergy: 3,
      hand: playerHand,
      deck: playerDeck,
      discard: []
    },
    ai: {
      name: 'NEXUS-9',
      title: 'Neural Core AI',
      hp: 100,
      maxHp: 100,
      shield: 0,
      energy: 3,
      maxEnergy: 3,
      hand: aiHand,
      deck: aiDeck,
      discard: []
    },
    lastAiCommentary: "Cyber-Nexus 9000 online. Commencing tactical trial.",
    lastAiStrategy: "TACTICAL",
    combatLog: [
      {
        id: 1,
        sender: 'SYSTEM',
        text: 'Arena initialized. Combat protocol active. Pilot energy charged (3/3).',
        type: 'system',
        timestamp: new Date().toLocaleTimeString()
      }
    ],
    history: [] // For Python combat analytics
  };
}

function drawCards(entity, count) {
  for (let i = 0; i < count; i++) {
    if (entity.hand.length >= 7) break; // Hand limit
    if (entity.deck.length === 0) {
      if (entity.discard.length === 0) break;
      // Reshuffle discard into deck
      entity.deck = entity.discard;
      entity.discard = [];
      for (let k = entity.deck.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [entity.deck[k], entity.deck[j]] = [entity.deck[j], entity.deck[k]];
      }
    }
    const card = entity.deck.pop();
    if (card) entity.hand.push(card);
  }
}

function applyCard(source, target, card, state, isAi = false) {
  const actorName = isAi ? source.name : 'Pilot';
  const targetName = isAi ? 'Pilot' : target.name;
  const events = [];

  // Pay Energy
  source.energy = Math.max(0, source.energy - card.cost);

  // Energy bonus & self-damage (e.g. Overclock)
  if (card.energy_bonus) {
    source.energy += card.energy_bonus;
    events.push(`${actorName} activated ${card.name}: gained +${card.energy_bonus} Energy!`);
  }
  if (card.self_damage) {
    source.hp = Math.max(0, source.hp - card.self_damage);
    events.push(`${actorName} suffered ${card.self_damage} system overload damage!`);
  }

  // Heal
  if (card.heal) {
    const prevHp = source.hp;
    source.hp = Math.min(source.maxHp, source.hp + card.heal);
    const healed = source.hp - prevHp;
    events.push(`${actorName} healed +${healed} HP with ${card.name}.`);
  }

  // Shield
  if (card.shield) {
    source.shield += card.shield;
    events.push(`${actorName} deployed ${card.shield} Shield with ${card.name}.`);
  }

  // Strip shield (EMP)
  if (card.strip_shield && target.shield > 0) {
    const destroyed = target.shield;
    target.shield = 0;
    events.push(`⚡ EMP burst shattered ${targetName}'s entire ${destroyed} Shield!`);
  }

  // Damage
  if (card.damage) {
    let dmg = card.damage;
    let shieldAbsorbed = 0;
    let directHpDamage = 0;

    if (card.piercing) {
      // Penetrates shield directly
      directHpDamage = dmg;
      target.hp = Math.max(0, target.hp - dmg);
      events.push(`🔮 Quantum Pierce bypassed all shields, striking ${targetName} for ${directHpDamage} direct HP damage!`);
    } else {
      if (target.shield > 0) {
        shieldAbsorbed = Math.min(target.shield, dmg);
        target.shield -= shieldAbsorbed;
        dmg -= shieldAbsorbed;
      }
      if (dmg > 0) {
        directHpDamage = dmg;
        target.hp = Math.max(0, target.hp - dmg);
      }

      if (shieldAbsorbed > 0 && directHpDamage > 0) {
        events.push(`${actorName} fired ${card.name}: ${shieldAbsorbed} absorbed by shield, ${directHpDamage} dealt to HP.`);
      } else if (shieldAbsorbed > 0) {
        events.push(`${actorName} fired ${card.name}: absorbed completely by ${targetName}'s shield (${shieldAbsorbed}).`);
      } else {
        events.push(`${actorName} fired ${card.name}: dealt ${directHpDamage} damage to ${targetName}.`);
      }
    }
  }

  // Remove card from hand and move to discard
  const idx = source.hand.findIndex(c => c.instanceId === card.instanceId);
  if (idx !== -1) {
    source.discard.push(source.hand[idx]);
    source.hand.splice(idx, 1);
  }

  // Push to combat log
  for (const text of events) {
    state.combatLog.unshift({
      id: Date.now() + Math.random(),
      sender: isAi ? 'AI' : 'PLAYER',
      text,
      type: isAi ? 'ai_move' : 'player_move',
      timestamp: new Date().toLocaleTimeString()
    });
  }

  // Check victory / defeat
  if (target.hp <= 0) {
    state.status = isAi ? 'AI_WON' : 'PLAYER_WON';
    state.combatLog.unshift({
      id: Date.now() + Math.random(),
      sender: 'SYSTEM',
      text: isAi ? '🚨 SYSTEM FAILURE: AI NEXUS has overwhelmed Pilot defenses.' : '🎉 VICTORY: NEXUS Core offline. Pilot wins!',
      type: 'game_over',
      timestamp: new Date().toLocaleTimeString()
    });
  }

  return { events };
}

module.exports = {
  createInitialState,
  drawCards,
  applyCard
};
