"""
Test suite for CKA Practice Exam Simulator

Run all tests with:
    pytest
    pytest -v  (verbose)
    pytest --cov  (with coverage)
"""

import pytest
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cka_exam.question_parser import scan_all_questions, parse_markdown_file, FOLDER_TO_DOMAIN


class TestQuestionParser:
    """Test question parsing functionality."""

    def test_folder_to_domain_mapping(self):
        """Test that folder names map correctly to CKA domains."""
        assert FOLDER_TO_DOMAIN["cluster-architecture"] == "Cluster Architecture, Installation & Configuration"
        assert FOLDER_TO_DOMAIN["scheduling"] == "Workloads & Scheduling"
        assert FOLDER_TO_DOMAIN["services-networking"] == "Services & Networking"

    def test_scan_all_questions(self):
        """Test scanning questions from data directory."""
        base_dir = Path(__file__).parent.parent / "data"
        if base_dir.exists():
            questions = scan_all_questions(str(base_dir))
            assert isinstance(questions, list)
            # Depending on available data, there might be some questions
            # For now, we just check it's a valid list
            assert all("id" in q and "domain" in q for q in questions)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

