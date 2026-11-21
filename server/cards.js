// Card Definitions for CLASH: Cyber Arena
const CARD_CATALOG = [
  {
    id: "pulse_laser",
    name: "Pulse Laser",
    type: "attack",
    cost: 1,
    damage: 14,
    shield: 0,
    heal: 0,
    icon: "⚡",
    rarity: "common",
    description: "Fire a concentrated coherent plasma beam."
  },
  {
    id: "nanite_aegis",
    name: "Nanite Aegis",
    type: "defense",
    cost: 1,
    damage: 0,
    shield: 14,
    heal: 0,
    icon: "🛡️",
    rarity: "common",
    description: "Deploy a fast-knit carbon nano-shield."
  },
  {
    id: "plasma_cannon",
    name: "Plasma Cannon",
    type: "attack",
    cost: 2,
    damage: 24,
    shield: 0,
    heal: 0,
    icon: "💥",
    rarity: "uncommon",
    description: "Overheated plasma ball causing massive hull shock."
  },
  {
    id: "firewall_fortress",
    name: "Firewall Matrix",
    type: "defense",
    cost: 2,
    damage: 0,
    shield: 26,
    heal: 0,
    icon: "🧱",
    rarity: "uncommon",
    description: "Construct an reinforced cryptographic defense perimeter."
  },
  {
    id: "emp_shockwave",
    name: "EMP Shockwave",
    type: "special",
    cost: 2,
    damage: 10,
    shield: 0,
    heal: 0,
    strip_shield: true,
    icon: "📡",
    rarity: "rare",
    description: "Shatters ALL enemy shields instantly and deals 10 damage."
  },
  {
    id: "quantum_pierce",
    name: "Quantum Pierce",
    type: "attack",
    cost: 3,
    damage: 34,
    shield: 0,
    heal: 0,
    piercing: true,
    icon: "🔮",
    rarity: "legendary",
    description: "Phase-shifted tachyon beam that bypasses shields directly."
  },
  {
    id: "overclock",
    name: "Overclock",
    type: "special",
    cost: 0,
    damage: 0,
    shield: 0,
    heal: 0,
    energy_bonus: 2,
    self_damage: 6,
    icon: "⏳",
    rarity: "rare",
    description: "Gain +2 Energy immediately, but system heat deals 6 self-damage."
  },
  {
    id: "repair_protocol",
    name: "Repair Protocol",
    type: "support",
    cost: 1,
    damage: 0,
    shield: 0,
    heal: 16,
    icon: "💚",
    rarity: "common",
    description: "Activate nanobot cellular repair to restore 16 HP."
  },
  {
    id: "cyber_siphon",
    name: "Cyber Siphon",
    type: "hybrid",
    cost: 2,
    damage: 14,
    shield: 10,
    heal: 6,
    icon: "🩸",
    rarity: "rare",
    description: "Hybrid strike: 14 damage, 10 shield, and siphons 6 HP."
  }
];

function generateDeck() {
  // Return a balanced 20-card deck
  const deck = [];
  const distribution = [
    { id: "pulse_laser", count: 4 },
    { id: "nanite_aegis", count: 4 },
    { id: "plasma_cannon", count: 3 },
    { id: "firewall_fortress", count: 2 },
    { id: "emp_shockwave", count: 2 },
    { id: "repair_protocol", count: 2 },
    { id: "overclock", count: 1 },
    { id: "cyber_siphon", count: 1 },
    { id: "quantum_pierce", count: 1 }
  ];

  let uid = 1;
  for (const item of distribution) {
    const proto = CARD_CATALOG.find(c => c.id === item.id);
    for (let i = 0; i < item.count; i++) {
      deck.push({ ...proto, instanceId: `${proto.id}_${uid++}` });
    }
  }

  // Shuffle deck using Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

module.exports = { CARD_CATALOG, generateDeck };
