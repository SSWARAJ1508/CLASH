# ⚡ CLASH: Cyber Arena

A futuristic tactical cyberpunk duel game built using **Node.js**, **React**, **Python**, **HTML5**, **CSS3**, and **JavaScript**.

---

## 🚀 Quick Start (One Command)

To launch the game:

```bash
chmod +x start.sh
./start.sh
```

Or using npm:
```bash
npm start
```

Then open your browser at:
**[http://localhost:3000](http://localhost:3000)**

---

## 🛠️ Technology Stack Breakdown

| Technology | Role in CLASH |
| :--- | :--- |
| **Node.js** | Core game session state manager, turn validator, card resolution engine, REST API router, and HTTP gateway bridging React with Python. Built with pure Node.js (`http`, `fs`, `path`, `url`) with **zero npm dependencies required**. |
| **Python** | Tactical AI Microservice running on port 8000. Employs heuristic utility scoring and combinatorial card evaluation to determine optimal enemy moves, generates dynamic contextual AI commentary, and computes post-battle combat analytics. |
| **React** | Component-driven reactive UI (`useState`, `useEffect`, `useRef`). Manages reactive state, card hand interactions, live HP/Shield meters, energy counters, telemetry stream, audio triggers, and modals. |
| **HTML5** | Semantic structure, viewport configuration, and HTML5 `<canvas>` rendering real-time floating ambient cyber particles. |
| **CSS3** | Modern cyberpunk design with CSS custom variables, glowing neon borders, scanlines, glassmorphism cards, holographic 3D hover effects, and floating combat damage animations (`@keyframes`). |
| **JavaScript (ES6+)** | Web Audio API sound synthesizer producing procedural 8-bit / synth sci-fi sound effects (lasers, plasma, shields, EMP, heals, and victory fanfare) with zero external audio assets. |

---

## 🎮 How to Play

1. **Objective**: Reduce the rogue mainframe AI (**NEXUS-9**) to **0 HP** before your own **100 HP** is depleted.
2. **Energy System**: You receive **3 Energy** at the start of each turn. Each card costs between 0 and 3 energy.
3. **Card Types**:
   - ⚡ **Pulse Laser** (1 Energy) — 14 Direct Damage.
   - 🛡️ **Nanite Aegis** (1 Energy) — +14 Quantum Shield.
   - 💥 **Plasma Cannon** (2 Energy) — 24 Heavy Damage.
   - 🧱 **Firewall Matrix** (2 Energy) — +26 Heavy Shield.
   - 📡 **EMP Shockwave** (2 Energy) — Strips **100%** of enemy shields instantly + 10 damage.
   - 🔮 **Quantum Pierce** (3 Energy) — 34 Damage that bypasses shields directly to Hull.
   - ⏳ **Overclock** (0 Energy) — Gain +2 Energy instantly at the cost of 6 self-damage.
   - 💚 **Repair Protocol** (1 Energy) — Restores 16 HP.
   - 🩸 **Cyber Siphon** (2 Energy) — Deals 14 damage, gains 10 shield, and heals 6 HP.
4. **Shield Decay**: Shields absorb damage before HP. At the start of each round, shields naturally degrade by 25%.
5. **End Turn**: Click **"END TURN"** to pass priority to the Python Tactical AI, which will compute its optimal card counter-play and strike back!

---

## 📁 Project Structure

```
CLASH/
├── package.json              # Root npm scripts
├── start.sh                  # One-click startup script for both servers
├── README.md                 # Complete documentation
│
├── ai_service/               # PYTHON AI MICROSERVICE (Port 8000)
│   ├── ai_engine.py          # Heuristic decision matrix, combinatorial planner & dialogue engine
│   └── test_ai.py            # Unit tests for AI logic
│
├── server/                   # NODE.JS GAME SERVER (Port 3000)
│   ├── server.js             # HTTP REST API server, static file host, Python bridge
│   ├── game_state.js         # Turn manager, card effects, damage/shield mechanics
│   └── cards.js              # Card catalog and deck generation
│
└── public/                   # FRONTEND CLIENT
    ├── index.html            # HTML5 shell & ambient canvas background
    ├── style.css             # Cyberpunk theme, animations, layout & responsive CSS
    ├── app.js                # React 18 UI components, state management & API hooks
    └── audio.js              # Pure JavaScript Web Audio API synthesizer
```

---

## 🧪 Testing

To run the Python AI engine unit tests:

```bash
npm test
```
