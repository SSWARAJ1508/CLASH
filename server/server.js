const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { createInitialState, drawCards, applyCard } = require('./game_state');

const PORT = process.env.PORT || 3000;
const PYTHON_AI_HOST = '127.0.0.1';
const PYTHON_AI_PORT = 8000;

// In-memory active game state
let currentGame = createInitialState();

// Helper to communicate with Python Tactical AI engine via HTTP
function callPythonAi(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: PYTHON_AI_HOST,
      port: PYTHON_AI_PORT,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Failed to parse Python AI response: ' + body));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Python AI request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

// Fallback logic in case Python AI is unreachable
function fallbackAiDecision(state) {
  const hand = [...state.ai.hand];
  let energy = state.ai.energy;
  const playedCards = [];

  // Sort by highest damage or shield
  hand.sort((a, b) => (b.damage + b.shield) - (a.damage + a.shield));

  for (const card of hand) {
    if (card.cost <= energy) {
      playedCards.push(card);
      energy -= card.cost;
    }
  }

  return {
    played_cards: playedCards,
    strategy: "FALLBACK_DEFENSIVE",
    commentary: "Warning: Neural link rerouted to local auxiliary subroutines.",
    projected_damage: playedCards.reduce((acc, c) => acc + (c.damage || 0), 0),
    projected_shield: playedCards.reduce((acc, c) => acc + (c.shield || 0), 0)
  };
}

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jsx': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Create HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // --- API ROUTES ---

  // Health check: tests both Node and Python AI connectivity
  if (pathname === '/api/health' && req.method === 'GET') {
    let pythonStatus = 'offline';
    try {
      const pyRes = await new Promise((resolve) => {
        const pingReq = http.get(`http://${PYTHON_AI_HOST}:${PYTHON_AI_PORT}/health`, (pingRes) => {
          let b = '';
          pingRes.on('data', c => b += c);
          pingRes.on('end', () => {
            try { resolve(JSON.parse(b)); } catch (e) { resolve(null); }
          });
        });
        pingReq.on('error', () => resolve(null));
        pingReq.setTimeout(1500, () => { pingReq.destroy(); resolve(null); });
      });
      if (pyRes && pyRes.status === 'online') pythonStatus = 'online';
    } catch (e) {
      pythonStatus = 'offline';
    }

    return sendJson(res, 200, {
      status: 'ok',
      node_server: 'online',
      python_ai_engine: pythonStatus,
      timestamp: new Date().toISOString()
    });
  }

  // New Game
  if (pathname === '/api/game/new' && req.method === 'POST') {
    currentGame = createInitialState();
    return sendJson(res, 200, { message: 'New game started', state: currentGame });
  }

  // Get current game state
  if (pathname === '/api/game/state' && req.method === 'GET') {
    return sendJson(res, 200, { state: currentGame });
  }

  // Game Action: PLAY_CARD or END_TURN
  if (pathname === '/api/game/action' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const actionType = data.type;

      if (currentGame.status !== 'ACTIVE') {
        return sendJson(res, 400, { error: 'Game is over. Start a new match.', state: currentGame });
      }

      if (actionType === 'PLAY_CARD') {
        const { instanceId } = data;
        const card = currentGame.player.hand.find(c => c.instanceId === instanceId);

        if (!card) {
          return sendJson(res, 400, { error: 'Card not found in player hand', state: currentGame });
        }
        if (currentGame.player.energy < card.cost) {
          return sendJson(res, 400, { error: 'Insufficient energy', state: currentGame });
        }

        // Apply player's card
        const result = applyCard(currentGame.player, currentGame.ai, card, currentGame, false);

        return sendJson(res, 200, {
          success: true,
          action: 'PLAY_CARD',
          cardPlayed: card,
          events: result.events,
          state: currentGame
        });
      }

      if (actionType === 'END_TURN') {
        // Player finishes turn. Now resolve Python AI turn.
        currentGame.currentPhase = 'AI_TURN';

        // 1. Ask Python Tactical AI for optimal decision
        let aiDecision;
        let usedPython = true;
        try {
          const payload = {
            ai_hand: currentGame.ai.hand,
            ai_energy: currentGame.ai.energy,
            ai_hp: currentGame.ai.hp,
            ai_shield: currentGame.ai.shield,
            player_hp: currentGame.player.hp,
            player_shield: currentGame.player.shield,
            turn: currentGame.turn
          };
          aiDecision = await callPythonAi('/ai/decide', payload);
        } catch (err) {
          console.warn('[Node Server] Python AI request failed, falling back to local heuristic:', err.message);
          aiDecision = fallbackAiDecision(currentGame);
          usedPython = false;
        }

        currentGame.lastAiCommentary = aiDecision.commentary || "Target coordinates locked.";
        currentGame.lastAiStrategy = aiDecision.strategy || "TACTICAL";

        // Log AI Commentary
        currentGame.combatLog.unshift({
          id: Date.now() + Math.random(),
          sender: 'AI_DIALOGUE',
          text: `[NEXUS-9]: "${currentGame.lastAiCommentary}"`,
          type: 'ai_quote',
          timestamp: new Date().toLocaleTimeString()
        });

        // 2. Execute cards chosen by Python AI
        const playedCards = aiDecision.played_cards || [];
        for (const card of playedCards) {
          if (currentGame.status !== 'ACTIVE') break;
          // Match with instance in AI's current hand
          const match = currentGame.ai.hand.find(c => c.id === card.id || c.instanceId === card.instanceId);
          if (match && currentGame.ai.energy >= match.cost) {
            applyCard(currentGame.ai, currentGame.player, match, currentGame, true);
          }
        }

        // 3. Post-turn maintenance:
        // Shield decay: shields naturally lose 25% each round
        if (currentGame.status === 'ACTIVE') {
          currentGame.player.shield = Math.floor(currentGame.player.shield * 0.75);
          currentGame.ai.shield = Math.floor(currentGame.ai.shield * 0.75);

          // Reset Energy
          currentGame.player.energy = currentGame.player.maxEnergy;
          currentGame.ai.energy = currentGame.ai.maxEnergy;

          // Draw up to 5 cards
          const playerDrawCount = Math.max(0, 5 - currentGame.player.hand.length);
          const aiDrawCount = Math.max(0, 5 - currentGame.ai.hand.length);
          drawCards(currentGame.player, Math.max(1, playerDrawCount));
          drawCards(currentGame.ai, Math.max(1, aiDrawCount));

          // Increment Turn
          currentGame.turn += 1;
          currentGame.currentPhase = 'PLAYER_TURN';

          currentGame.combatLog.unshift({
            id: Date.now() + Math.random(),
            sender: 'SYSTEM',
            text: `─── Turn ${currentGame.turn} Initiated ─── Energy restored (3/3).`,
            type: 'turn_banner',
            timestamp: new Date().toLocaleTimeString()
          });
        }

        return sendJson(res, 200, {
          success: true,
          action: 'END_TURN',
          aiDecision,
          usedPython,
          state: currentGame
        });
      }

      return sendJson(res, 400, { error: 'Unknown action type', state: currentGame });
    } catch (err) {
      console.error('[Node Server] Error handling action:', err);
      return sendJson(res, 500, { error: err.message, state: currentGame });
    }
  }

  // Analytics endpoint forwarded to Python
  if (pathname === '/api/game/analytics' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      try {
        const analytics = await callPythonAi('/ai/analytics', data);
        return sendJson(res, 200, analytics);
      } catch (e) {
        // Fallback analytics
        return sendJson(res, 200, {
          grade: 'A',
          verdict: 'Battle concluded. Data synchronized.',
          total_turns: data.history ? data.history.length : 5,
          player_damage_dealt: 100,
          ai_damage_dealt: 65,
          avg_player_dps: 20,
          avg_ai_dps: 13,
          ai_core_version: 'NEXUS-9 v4.2 [Fallback Engine]'
        });
      }
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // --- STATIC FILE SERVING (React Frontend) ---
  const publicDir = path.join(__dirname, '..', 'public');
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') safePath = '/index.html';

  const filePath = path.join(publicDir, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Return 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + pathname);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🌐 [Node.js Game Server] Running on http://localhost:${PORT}`);
  console.log(`🤖 Bridged to Python Tactical AI on port ${PYTHON_AI_PORT}`);
});
