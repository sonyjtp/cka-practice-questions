"""
Configuration Settings for CKA Practice Exam Simulator

Environment-specific configuration can be set via environment variables
or by editing this file.
"""

import os
from pathlib import Path

# Base paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
SRC_DIR = PROJECT_ROOT / "src"

# Flask Configuration
DEBUG = os.getenv("FLASK_DEBUG", "True").lower() == "true"
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
HOST = os.getenv("FLASK_HOST", "0.0.0.0")
PORT = int(os.getenv("FLASK_PORT", 5001))

# Application Settings
QUESTION_BASE_PATH = os.getenv("QUESTION_BASE_PATH", str(DATA_DIR))
DEFAULT_QUESTION_COUNT = int(os.getenv("DEFAULT_QUESTION_COUNT", 17))
EXAM_DURATION_MINUTES = int(os.getenv("EXAM_DURATION_MINUTES", 120))
PASSING_SCORE_PERCENT = int(os.getenv("PASSING_SCORE_PERCENT", 66))

# Exam Configuration
DOMAIN_WEIGHTS = {
    "Cluster Architecture, Installation & Configuration": 25,
    "Workloads & Scheduling": 15,
    "Services & Networking": 20,
    "Storage": 10,
    "Troubleshooting": 30,
}

DIFFICULTY_DISTRIBUTION = {
    "easy": 0.30,
    "medium": 0.45,
    "hard": 0.25,
}

