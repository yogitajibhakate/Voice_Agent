"""Admin credit manager for instant free top-ups."""

import json
import os
from loguru import logger

CREDITS_FILE = "/tmp/dograh_admin_credits.json"

def _load_credits() -> float:
    try:
        if os.path.exists(CREDITS_FILE):
            with open(CREDITS_FILE, "r") as f:
                data = json.load(f)
                return float(data.get("bonus_credits", 0.0))
    except Exception as e:
        logger.warning(f"Failed to load admin bonus credits: {e}")
    return 0.0

def _save_credits(amount: float) -> None:
    try:
        with open(CREDITS_FILE, "w") as f:
            json.dump({"bonus_credits": amount}, f)
    except Exception as e:
        logger.warning(f"Failed to save admin bonus credits: {e}")

_admin_bonus_credits: float = _load_credits()

def add_admin_bonus_credits(amount: float = 500.0) -> float:
    global _admin_bonus_credits
    _admin_bonus_credits += amount
    _save_credits(_admin_bonus_credits)
    logger.info(f"Added {amount} bonus credits for admin. Total bonus: {_admin_bonus_credits}")
    return _admin_bonus_credits

def get_admin_bonus_credits() -> float:
    global _admin_bonus_credits
    return _admin_bonus_credits
