#!/usr/bin/env python3
"""
CLASH: Cyber Arena - Python Tactical AI Engine
Port: 8000
Provides minimax-inspired tactical decision making, board heuristic evaluations,
dynamic AI persona commentary, and combat analytics for the Node.js game server.
"""

import json
import sys
import random
from http.server import HTTPServer, BaseHTTPRequestHandler

AI_PORT = 8000

# Dialogue database categorized by tactical situation
DIALOGUE_DB = {
    "FINISHER": [
        "FATAL ERROR detected in your defenses. Initiating final purge.",
        "Your probability of survival has reached 0.00%. Goodbye, user.",
        "Executing terminal protocol. Clean, efficient, inevitable."
    ],
    "SURVIVAL": [
        "Core integrity compromised! Re-routing emergency auxiliary power.",
        "Desperate measures? Negative. Merely calculated self-preservation.",
        "Deploying nano-patch routine. You cannot terminate what has no flesh."
    ],
    "EMP": [
        "Shield frequency cracked. Electromagnetic pulse released!",
        "Your firewall is obsolete. Stripping defenses now.",
        "Discharging EMP surge. Say farewell to your shields."
    ],
    "AGGRESSIVE": [
        "Analyzing offensive vectors... Maximum kinetic output selected.",
        "You bleed. My algorithms do not experience fatigue.",
        "Target lock confirmed. Full laser salvo authorized."
    ],
    "DEFENSIVE": [
        "Hardening firewall sectors. Your assault is statistically futile.",
        "Quantum shielding activated. Deflection matrix at peak efficiency.",
        "Absorbing incoming telemetry. Your attacks only provide me training data."
    ],
    "TACTICAL": [
        "Heuristic analysis suggests a high probability of human error.",
        "Evaluating 4,096 tactical timelines. This move is optimal.",
        "Your biometric signals indicate rising stress. Fascinating.",
        "Adapting neural weights to counter your playstyle."
    ]
}

def evaluate_card_utility(card, ai_hp, ai_shield, player_hp, player_shield, energy_remaining):
    """Calculate utility score for a single card based on board context."""
    card_type = card.get("type", "attack")
    damage = card.get("damage", 0)
    shield = card.get("shield", 0)
    heal = card.get("heal", 0)
    cost = card.get("cost", 1)

    if cost > energy_remaining:
        return -999  # Cannot afford

    score = 0.0

    # Lethal priority: if we can eliminate player, attacks get massive weight
    effective_damage = damage
    if card.get("piercing", False):
        effective_damage = damage # piercing penetrates shields
    else:
        effective_damage = min(player_shield + player_hp, damage)

    if effective_damage >= player_hp:
        return 5000.0 + damage

    # Emergency healing / shielding if AI HP is low (< 35)
    if ai_hp < 35:
        if heal > 0:
            score += heal * 3.5
        if shield > 0:
            score += shield * 2.8
        if damage > 0:
            score += damage * 1.2
    # If player has huge shield (> 20) and card is EMP / piercing
    elif player_shield >= 15:
        if card.get("strip_shield", False):
            score += 100.0 + player_shield * 2.0
        elif card.get("piercing", False):
            score += damage * 2.5
        elif damage > 0:
            score += damage * 0.8
        if shield > 0:
            score += shield * 1.5
    # Standard offensive / balanced evaluation
    else:
        if damage > 0:
            score += damage * 2.2
        if shield > 0:
            # Shields less urgent if already high
            shield_need = max(0, 40 - ai_shield)
            score += (shield / 15.0) * shield_need
        if heal > 0:
            missing_hp = 100 - ai_hp
            score += min(heal, missing_hp) * 1.5

    # Energy efficiency bonus
    if cost > 0:
        score = score / (cost ** 0.8)
    else:
        score += 15.0  # 0-cost cards are almost always free value

    return score


def plan_ai_turn(ai_hand, ai_energy, ai_hp, ai_shield, player_hp, player_shield):
    """
    Search best subset of cards from ai_hand that can be paid with ai_energy.
    Combinatorial search over hand (up to 5 cards is at most 32 combinations).
    """
    best_combo = []
    best_score = -1000.0
    best_strategy = "TACTICAL"

    # Generate all valid combinations of card indices that fit energy
    n = len(ai_hand)
    for mask in range(1 << n):
        combo = []
        total_cost = 0
        valid = True
        for i in range(n):
            if (mask >> i) & 1:
                card = ai_hand[i]
                total_cost += card.get("cost", 1)
                combo.append(card)

        if total_cost <= ai_energy:
            # Score this combo
            sim_ai_hp = ai_hp
            sim_ai_shield = ai_shield
            sim_player_hp = player_hp
            sim_player_shield = player_shield

            combo_score = 0.0
            has_emp = False

            for c in combo:
                # Add individual card utility
                c_score = evaluate_card_utility(
                    c, sim_ai_hp, sim_ai_shield, sim_player_hp, sim_player_shield, 99
                )
                combo_score += c_score

                # Simulate effects
                if c.get("strip_shield", False):
                    has_emp = True
                    sim_player_shield = 0

                dmg = c.get("damage", 0)
                if c.get("piercing", False):
                    sim_player_hp -= dmg
                else:
                    absorbed = min(sim_player_shield, dmg)
                    sim_player_shield -= absorbed
                    sim_player_hp -= (dmg - absorbed)

                sim_ai_shield += c.get("shield", 0)
                sim_ai_hp = min(100, sim_ai_hp + c.get("heal", 0))

            # Lethal bonus for combo
            if sim_player_hp <= 0:
                combo_score += 10000.0

            # Tiebreaker: spend more energy efficiently
            combo_score += total_cost * 1.5

            if combo_score > best_score:
                best_score = combo_score
                best_combo = combo

    # Determine strategy label
    total_dmg = sum(c.get("damage", 0) for c in best_combo)
    total_shield = sum(c.get("shield", 0) for c in best_combo)
    total_heal = sum(c.get("heal", 0) for c in best_combo)
    has_emp = any(c.get("strip_shield", False) for c in best_combo)

    if total_dmg >= player_hp:
        best_strategy = "FINISHER"
    elif ai_hp < 35 and (total_shield > 10 or total_heal > 0):
        best_strategy = "SURVIVAL"
    elif has_emp:
        best_strategy = "EMP"
    elif total_dmg > 20:
        best_strategy = "AGGRESSIVE"
    elif total_shield > 15:
        best_strategy = "DEFENSIVE"
    else:
        best_strategy = "TACTICAL"

    commentary = random.choice(DIALOGUE_DB.get(best_strategy, DIALOGUE_DB["TACTICAL"]))

    return {
        "played_cards": best_combo,
        "strategy": best_strategy,
        "commentary": commentary,
        "projected_damage": total_dmg,
        "projected_shield": total_shield,
        "projected_heal": total_heal,
        "tactical_score": round(best_score, 2)
    }


def compute_combat_analytics(history):
    """Analyze the full match history and return statistical combat breakdown."""
    total_player_damage = sum(h.get("player_damage", 0) for h in history)
    total_ai_damage = sum(h.get("ai_damage", 0) for h in history)
    total_turns = len(history)

    avg_player_dps = round(total_player_damage / max(1, total_turns), 1)
    avg_ai_dps = round(total_ai_damage / max(1, total_turns), 1)

    # Calculate tactical rating
    if total_turns <= 6 and total_player_damage > total_ai_damage:
        grade = "S+"
        verdict = "Neural dominance achieved. Tactical speed unmatched."
    elif total_player_damage > total_ai_damage:
        grade = "A"
        verdict = "Superior energy economy and sustained firewall control."
    elif total_turns >= 12:
        grade = "B"
        verdict = "Prolonged attrition warfare. High defensive resilience."
    else:
        grade = "C"
        verdict = "Defensive collapse under heavy algorithmic pressure."

    return {
        "grade": grade,
        "verdict": verdict,
        "total_turns": total_turns,
        "player_damage_dealt": total_player_damage,
        "ai_damage_dealt": total_ai_damage,
        "avg_player_dps": avg_player_dps,
        "avg_ai_dps": avg_ai_dps,
        "ai_core_version": "NEXUS-9 v4.2 [Python / Heuristic Neural Matrix]"
    }


class AIRequestHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health" or self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            response = {
                "status": "online",
                "service": "Python Tactical AI Engine",
                "engine": "Minimax-Heuristic Cyber Brain",
                "port": AI_PORT
            }
            self.wfile.write(json.dumps(response).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body.decode("utf-8")) if body else {}
        except Exception as e:
            self.send_response(400)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Invalid JSON: {str(e)}"}).encode("utf-8"))
            return

        if self.path == "/ai/decide":
            ai_hand = data.get("ai_hand", [])
            ai_energy = data.get("ai_energy", 3)
            ai_hp = data.get("ai_hp", 100)
            ai_shield = data.get("ai_shield", 0)
            player_hp = data.get("player_hp", 100)
            player_shield = data.get("player_shield", 0)

            decision = plan_ai_turn(
                ai_hand, ai_energy, ai_hp, ai_shield, player_hp, player_shield
            )

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(decision).encode("utf-8"))

        elif self.path == "/ai/analytics":
            history = data.get("history", [])
            analytics = compute_combat_analytics(history)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(analytics).encode("utf-8"))

        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

    def log_message(self, format, *args):
        # Clean custom log message
        sys.stderr.write(f"[Python AI Engine] {format % args}\n")


def run(port=AI_PORT):
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, AIRequestHandler)
    print(f"⚡ [Python AI Engine] Running on http://127.0.0.1:{port}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Python AI Engine] Shutting down cleanly...", flush=True)
        httpd.server_close()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else AI_PORT
    run(port)
