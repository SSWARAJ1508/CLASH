// ==========================================================================
// CLASH: Cyber Arena - React 18 Application
// Built with React, communicating with Node.js Server & Python Tactical AI
// ==========================================================================

const { useState, useEffect, useRef, createElement: h } = React;

function App() {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [serverHealth, setServerHealth] = useState({ node: 'checking', python: 'checking' });

  const logEndRef = useRef(null);

  // Add floating combat text
  const triggerFloatingText = (text, type = 'dmg', target = 'boss') => {
    const id = Date.now() + Math.random();
    const xOffset = (Math.random() - 0.5) * 60;
    setFloatingTexts(prev => [...prev, { id, text, type, target, xOffset }]);
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(f => f.id !== id));
    }, 1200);
  };

  // Health check on startup
  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setServerHealth({
          node: data.node_server || 'online',
          python: data.python_ai_engine || 'offline'
        });
      }
    } catch (e) {
      setServerHealth({ node: 'offline', python: 'offline' });
    }
  };

  // Fetch current game state
  const fetchState = async () => {
    try {
      const res = await fetch('/api/game/state');
      if (res.ok) {
        const data = await res.json();
        setGameState(data.state);
      }
    } catch (err) {
      console.error('Error fetching state:', err);
    } finally {
      setLoading(false);
    }
  };

  // Start new game
  const startNewGame = async () => {
    setLoading(true);
    setAnalytics(null);
    try {
      const res = await fetch('/api/game/new', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setGameState(data.state);
        window.soundEngine?.playLaser();
      }
    } catch (err) {
      console.error('Error starting new game:', err);
    } finally {
      setLoading(false);
    }
  };

  // Play a card
  const handlePlayCard = async (card) => {
    if (acting || !gameState || gameState.status !== 'ACTIVE') return;
    if (gameState.player.energy < card.cost) return;

    setActing(true);

    // Audio effect based on card type
    if (card.strip_shield) {
      window.soundEngine?.playEmp();
      triggerFloatingText('⚡ EMP SHOCK!', 'shield-number', 'boss');
    } else if (card.heal > 0) {
      window.soundEngine?.playHeal();
      triggerFloatingText(`+${card.heal} HP`, 'heal-number', 'player');
    } else if (card.energy_bonus > 0) {
      window.soundEngine?.playOverclock();
      triggerFloatingText(`+2 NRG`, 'shield-number', 'player');
    } else if (card.damage > 20) {
      window.soundEngine?.playPlasma();
      triggerFloatingText(`-${card.damage} HP`, 'dmg-number', 'boss');
    } else if (card.damage > 0) {
      window.soundEngine?.playLaser();
      triggerFloatingText(`-${card.damage} HP`, 'dmg-number', 'boss');
    } else if (card.shield > 0) {
      window.soundEngine?.playShield();
      triggerFloatingText(`+${card.shield} SHIELD`, 'shield-number', 'player');
    } else {
      window.soundEngine?.playClick();
    }

    try {
      const res = await fetch('/api/game/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PLAY_CARD', instanceId: card.instanceId })
      });
      if (res.ok) {
        const data = await res.json();
        setGameState(data.state);

        if (data.state.status === 'PLAYER_WON') {
          window.soundEngine?.playVictory();
          fetchAnalytics(data.state);
        }
      }
    } catch (err) {
      console.error('Error playing card:', err);
    } finally {
      setActing(false);
    }
  };

  // End turn & trigger Python AI turn
  const handleEndTurn = async () => {
    if (acting || !gameState || gameState.status !== 'ACTIVE') return;
    setActing(true);
    window.soundEngine?.playClick();

    try {
      const res = await fetch('/api/game/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'END_TURN' })
      });
      if (res.ok) {
        const data = await res.json();
        setGameState(data.state);

        // Visual effects for AI actions
        if (data.aiDecision && data.aiDecision.projected_damage > 0) {
          triggerFloatingText(`-${data.aiDecision.projected_damage} HP`, 'dmg-number', 'player');
          window.soundEngine?.playPlasma();
        } else {
          window.soundEngine?.playShield();
        }

        if (data.state.status === 'AI_WON') {
          window.soundEngine?.playDefeat();
          fetchAnalytics(data.state);
        } else if (data.state.status === 'PLAYER_WON') {
          window.soundEngine?.playVictory();
          fetchAnalytics(data.state);
        }
      }
    } catch (err) {
      console.error('Error ending turn:', err);
    } finally {
      setActing(false);
    }
  };

  // Fetch combat analytics from Python AI
  const fetchAnalytics = async (state) => {
    try {
      const res = await fetch('/api/game/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: state.combatLog.filter(l => l.type === 'player_move' || l.type === 'ai_move'),
          turn_count: state.turn
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (e) {
      console.warn('Analytics fetch error:', e);
    }
  };

  useEffect(() => {
    checkHealth();
    fetchState();
  }, []);

  if (loading || !gameState) {
    return h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'var(--font-cyber)',
        color: 'var(--neon-cyan)',
        fontSize: '1.2rem',
        letterSpacing: '2px'
      }
    }, 'INITIALIZING CYBER ARENA...');
  }

  const { player, ai, turn, status, combatLog, lastAiCommentary } = gameState;
  const isPlayerTurn = gameState.currentPhase === 'PLAYER_TURN' && status === 'ACTIVE';

  return h('div', { className: 'app-root' },
    // 1. Header Bar
    h('header', { className: 'header-bar' },
      h('div', { className: 'brand' },
        h('span', { className: 'brand-title' }, 'CLASH'),
        h('span', { className: 'brand-badge' }, 'CYBER ARENA')
      ),
      // Active Architecture Indicators
      h('div', { className: 'tech-stack-pills' },
        h('div', { className: `pill ${serverHealth.node === 'online' ? 'active' : ''}` },
          h('span', { className: 'dot' }),
          'Node.js Server'
        ),
        h('div', { className: `pill ${serverHealth.python === 'online' ? 'active' : ''}` },
          h('span', { className: 'dot' }),
          'Python AI Core'
        ),
        h('div', { className: 'pill active' },
          h('span', { className: 'dot' }),
          'React UI'
        )
      ),
      h('div', { className: 'header-controls' },
        h('button', {
          className: 'btn-icon',
          onClick: () => {
            const next = window.soundEngine ? window.soundEngine.toggle() : !soundOn;
            setSoundOn(next);
          }
        }, soundOn ? '🔊 Audio ON' : '🔇 Audio OFF'),
        h('button', {
          className: 'btn-icon',
          onClick: () => setShowGuide(true)
        }, '📖 Guide'),
        h('button', {
          className: 'btn-icon',
          onClick: startNewGame
        }, '⚡ New Duel')
      )
    ),

    // 2. Main Arena & Side Panel
    h('div', { className: 'game-container' },
      h('main', { className: 'battle-arena' },

        // Boss Panel (Python AI Opponent)
        h('div', { className: 'boss-card' },
          h('div', { className: 'boss-avatar-wrapper' },
            h('div', { className: 'boss-eye' },
              h('div', {
                className: 'pupil',
                style: {
                  background: acting ? 'var(--neon-gold)' : '#fff',
                  transform: acting ? 'scale(1.3)' : 'scale(1)'
                }
              })
            )
          ),
          h('div', { className: 'boss-info' },
            h('div', { className: 'entity-header' },
              h('span', { className: 'entity-name boss-name' }, ai.name),
              h('span', { className: 'entity-sub' }, `${ai.title} [Python Heuristic Bot]`)
            ),
            h('div', { className: 'stat-bars' },
              // Boss HP
              h('div', { className: 'bar-wrapper' },
                h('div', { className: 'bar-labels' },
                  h('span', { style: { color: 'var(--neon-magenta)' } }, 'HULL INTEGRITY'),
                  h('span', null, `${ai.hp} / ${ai.maxHp} HP`)
                ),
                h('div', { className: 'bar-track' },
                  h('div', {
                    className: 'bar-fill hp-fill',
                    style: { width: `${Math.max(0, (ai.hp / ai.maxHp) * 100)}%` }
                  })
                )
              ),
              // Boss Shield
              h('div', { className: 'bar-wrapper' },
                h('div', { className: 'bar-labels' },
                  h('span', { style: { color: 'var(--neon-cyan)' } }, 'QUANTUM SHIELD'),
                  h('span', null, `${ai.shield} SP`)
                ),
                h('div', { className: 'bar-track' },
                  h('div', {
                    className: 'bar-fill shield-fill',
                    style: { width: `${Math.min(100, (ai.shield / 50) * 100)}%` }
                  })
                )
              )
            ),
            // Python Dynamic Commentary Bubble
            h('div', { className: 'ai-dialogue-bubble' }, lastAiCommentary)
          )
        ),

        // Center Battle Field & Stage
        h('div', { className: 'battle-field' },
          h('div', { className: 'turn-status-banner' },
            h('span', { className: 'turn-pill' }, `TURN 0${turn}`),
            h('span', {
              className: `phase-indicator ${isPlayerTurn ? 'phase-player' : 'phase-ai'}`
            }, isPlayerTurn ? '⚡ PILOT TACTICAL TURN' : '🤖 PYTHON AI CALCULATING MOVE...')
          ),

          // Floating Combat Numbers Layer
          h('div', { className: 'combat-stage' },
            floatingTexts.map(f =>
              h('div', {
                key: f.id,
                className: `floating-number ${f.type}`,
                style: {
                  left: f.target === 'boss' ? `calc(50% + ${f.xOffset}px)` : `calc(30% + ${f.xOffset}px)`,
                  top: f.target === 'boss' ? '15%' : '60%'
                }
              }, f.text)
            )
          ),

          // Player Hand of Cyber Cards
          h('div', { className: 'hand-section' },
            h('div', { className: 'hand-header' },
              h('span', { className: 'hand-title' }, `TACTICAL ARSENAL (${player.hand.length} CARDS IN MEMORY)`),
              h('button', {
                className: 'btn-end-turn',
                disabled: !isPlayerTurn || acting,
                onClick: handleEndTurn
              }, acting ? 'EXECUTING...' : 'END TURN ➔')
            ),
            h('div', { className: 'hand-cards' },
              player.hand.map(card => {
                const canAfford = player.energy >= card.cost && isPlayerTurn && !acting;
                return h('div', {
                  key: card.instanceId,
                  className: `cyber-card ${canAfford ? '' : 'disabled'}`,
                  onClick: () => canAfford && handlePlayCard(card)
                },
                  h('div', { className: 'card-top' },
                    h('div', { className: 'card-cost' }, card.cost),
                    h('div', { className: 'card-icon' }, card.icon)
                  ),
                  h('div', { className: 'card-title' }, card.name),
                  h('div', { className: 'card-desc' }, card.description),
                  h('div', null,
                    card.damage > 0 && h('span', { className: 'card-badge badge-dmg' }, `💥 ${card.damage} DMG`),
                    card.shield > 0 && h('span', { className: 'card-badge badge-shield' }, `🛡️ +${card.shield} DEF`),
                    card.heal > 0 && h('span', { className: 'card-badge badge-heal' }, `💚 +${card.heal} HP`),
                    card.strip_shield && h('span', { className: 'card-badge badge-special' }, '⚡ SHIELD BREAKER'),
                    card.energy_bonus > 0 && h('span', { className: 'card-badge badge-special' }, `⏳ +${card.energy_bonus} NRG`)
                  )
                );
              })
            )
          )
        ),

        // Player Console (Pilot Stats & Energy)
        h('div', { className: 'player-console' },
          h('div', { className: 'player-stats-row' },
            // Energy Core Display
            h('div', { className: 'energy-display' },
              h('span', { className: 'energy-title' }, 'ENERGY CORE'),
              h('span', { className: 'energy-count' },
                '⚡ ',
                `${player.energy}/${player.maxEnergy}`
              )
            ),
            // Player HP & Shield
            h('div', { style: { flex: 1 } },
              h('div', { className: 'entity-header' },
                h('span', { className: 'entity-name pilot-name' }, player.name),
                h('span', { className: 'entity-sub' }, 'Combat Protocol Active')
              ),
              h('div', { className: 'stat-bars' },
                h('div', { className: 'bar-wrapper' },
                  h('div', { className: 'bar-labels' },
                    h('span', { style: { color: 'var(--neon-green)' } }, 'HULL STATUS'),
                    h('span', null, `${player.hp} / ${player.maxHp} HP`)
                  ),
                  h('div', { className: 'bar-track' },
                    h('div', {
                      className: 'bar-fill player-hp-fill',
                      style: { width: `${Math.max(0, (player.hp / player.maxHp) * 100)}%` }
                    })
                  )
                ),
                h('div', { className: 'bar-wrapper' },
                  h('div', { className: 'bar-labels' },
                    h('span', { style: { color: 'var(--neon-cyan)' } }, 'SHIELD CAPACITOR'),
                    h('span', null, `${player.shield} SP`)
                  ),
                  h('div', { className: 'bar-track' },
                    h('div', {
                      className: 'bar-fill shield-fill',
                      style: { width: `${Math.min(100, (player.shield / 50) * 100)}%` }
                    })
                  )
                )
              )
            )
          )
        )
      ),

      // Side Telemetry Panel: Combat Log Stream
      h('aside', { className: 'side-panel' },
        h('div', { className: 'telemetry-card' },
          h('div', { className: 'panel-header' },
            h('span', { className: 'panel-title' }, '📡 COMBAT TELEMETRY'),
            h('span', { style: { fontSize: '0.65rem', color: 'var(--text-muted)' } }, 'LIVE STREAM')
          ),
          h('div', { className: 'log-stream' },
            combatLog.map(entry =>
              h('div', { key: entry.id, className: `log-entry ${entry.type}` },
                h('span', null, entry.text),
                h('span', { className: 'log-time' }, entry.timestamp)
              )
            )
          )
        )
      )
    ),

    // Guide Modal
    showGuide && h('div', { className: 'modal-overlay', onClick: () => setShowGuide(false) },
      h('div', { className: 'modal-content', onClick: e => e.stopPropagation() },
        h('h3', { className: 'modal-title' }, 'SYSTEM COMBAT MANUAL'),
        h('div', { className: 'modal-body' },
          h('h4', null, '🎮 HOW TO PLAY'),
          h('p', null, 'CLASH is a futuristic tactical duel between Pilot (you) and NEXUS-9 (a Python-powered tactical AI). Reduce the enemy AI Hull to 0 before your own reaches 0.'),
          h('h4', null, '⚡ ENERGY & CARDS'),
          h('ul', null,
            h('li', null, 'Each turn, you receive 3 Energy.'),
            h('li', null, 'Each card has an energy cost indicated in the top left orb.'),
            h('li', null, 'Play cards by clicking them, then click "END TURN" to pass priority to the Python AI.')
          ),
          h('h4', null, '🛡️ SHIELD MECHANIC'),
          h('p', null, 'Shields absorb damage before Hull HP. Each round, shields lose 25% of their charge. Use EMP Shockwave to instantly vaporize enemy shields!'),
          h('h4', null, '⚙️ ARCHITECTURE BREAKDOWN'),
          h('ul', null,
            h('li', null, 'Node.js: Manages game session, enforces turn rules, serves REST API & static assets.'),
            h('li', null, 'Python: Evaluates board heuristics, computes combinatorial moves, generates AI dialogue & post-match analytics.'),
            h('li', null, 'React: Provides the responsive, componentized user interface and reactive game state.'),
            h('li', null, 'HTML5 & CSS3: Cyberpunk neon visuals, animations, floating combat numbers, canvas background.'),
            h('li', null, 'JavaScript & Web Audio: Pure procedural sound synthesis with zero external dependencies.')
          )
        ),
        h('button', { className: 'btn-primary', onClick: () => setShowGuide(false) }, 'CLOSE MANUAL')
      )
    ),

    // Victory / Defeat Modal with Python Analytics
    (status === 'PLAYER_WON' || status === 'AI_WON') && h('div', { className: 'modal-overlay' },
      h('div', { className: 'modal-content' },
        h('h3', {
          className: 'modal-title',
          style: { color: status === 'PLAYER_WON' ? 'var(--neon-green)' : 'var(--neon-magenta)' }
        }, status === 'PLAYER_WON' ? '🏆 PILOT VICTORY ACHIEVED' : '💀 COMBAT CORE TERMINATED'),
        h('div', { className: 'modal-body' },
          h('p', { style: { textAlign: 'center', fontSize: '0.95rem', color: '#fff' } },
            status === 'PLAYER_WON'
              ? 'NEXUS-9 Core disabled. AI algorithms forced into quarantine.'
              : 'Pilot life support compromised. NEXUS-9 has seized control.'
          ),
          analytics && h('div', null,
            h('h4', { style: { textAlign: 'center' } }, '📊 PYTHON AI COMBAT ASSESSMENT'),
            h('div', { className: 'analytics-grid' },
              h('div', { className: 'stat-box' },
                h('span', { className: 'stat-val' }, analytics.grade),
                h('span', { className: 'stat-label' }, 'TACTICAL GRADE')
              ),
              h('div', { className: 'stat-box' },
                h('span', { className: 'stat-val' }, analytics.total_turns),
                h('span', { className: 'stat-label' }, 'TURNS SURVIVED')
              ),
              h('div', { className: 'stat-box' },
                h('span', { className: 'stat-val', style: { color: 'var(--neon-green)' } }, `${analytics.player_damage_dealt}`),
                h('span', { className: 'stat-label' }, 'DAMAGE DEALT')
              ),
              h('div', { className: 'stat-box' },
                h('span', { className: 'stat-val', style: { color: 'var(--neon-magenta)' } }, `${analytics.ai_damage_dealt}`),
                h('span', { className: 'stat-label' }, 'DAMAGE TAKEN')
              )
            ),
            h('p', {
              style: {
                fontStyle: 'italic',
                color: 'var(--neon-gold)',
                textAlign: 'center',
                marginTop: '10px'
              }
            }, `"${analytics.verdict}"`),
            h('p', {
              style: {
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginTop: '4px'
              }
            }, analytics.ai_core_version)
          )
        ),
        h('button', { className: 'btn-primary', onClick: startNewGame }, 'INITIATE NEW DUEL')
      )
    )
  );
}

// Render React 18 Root
const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(h(App));
}
