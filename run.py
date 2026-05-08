#!/usr/bin/env python3
"""
CKA Practice Exam Simulator — Entry Point

Quick start:
    python run.py
"""

import sys
import os

# Add src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from cka_exam.__main__ import main

if __name__ == "__main__":
    main()

