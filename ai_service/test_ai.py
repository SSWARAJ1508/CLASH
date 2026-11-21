#!/usr/bin/env python3
"""
Unit test for Python Tactical AI Engine
"""

from ai_engine import plan_ai_turn, compute_combat_analytics, evaluate_card_utility

def test_lethal_decision():
    # Test that AI chooses lethal move when available
    hand = [
        {"id": "c1", "name": "Laser Shot", "cost": 1, "damage": 15, "shield": 0},
        {"id": "c2", "name": "Firewall", "cost": 1, "damage": 0, "shield": 15},
        {"id": "c3", "name": "Quantum Ray", "cost": 3, "damage": 35, "shield": 0, "piercing": True}
    ]
    # Player has only 12 HP, 0 shield
    decision = plan_ai_turn(hand, 3, ai_hp=50, ai_shield=10, player_hp=12, player_shield=0)
    played_names = [c["name"] for c in decision["played_cards"]]
    assert "Laser Shot" in played_names or "Quantum Ray" in played_names
    assert decision["strategy"] == "FINISHER"
    print("✓ Lethal execution test passed")

def test_emp_priority():
    # When player has huge shield, EMP should be prioritized
    hand = [
        {"id": "c1", "name": "Laser", "cost": 1, "damage": 10, "shield": 0},
        {"id": "c2", "name": "EMP Shockwave", "cost": 2, "damage": 10, "strip_shield": True},
        {"id": "c3", "name": "Small Shield", "cost": 1, "damage": 0, "shield": 8}
    ]
    decision = plan_ai_turn(hand, 3, ai_hp=80, ai_shield=10, player_hp=80, player_shield=30)
    played_names = [c["name"] for c in decision["played_cards"]]
    assert "EMP Shockwave" in played_names
    print("✓ EMP tactical priority test passed")

def test_analytics():
    history = [
        {"player_damage": 25, "ai_damage": 15},
        {"player_damage": 30, "ai_damage": 20},
        {"player_damage": 45, "ai_damage": 10}
    ]
    res = compute_combat_analytics(history)
    assert res["grade"] == "S+"
    assert res["total_turns"] == 3
    print("✓ Combat analytics test passed")

if __name__ == "__main__":
    test_lethal_decision()
    test_emp_priority()
    test_analytics()
    print("All Python AI tests passed successfully!")
