"""
CKA Practice Exam Simulator — Main Entry Point

Run with:
    python -m cka_exam
    or
    python run.py
"""

from .app import app, BASE_DIR
from .question_parser import scan_all_questions, get_domain_summary


def main():
    """Start the Flask application."""
    print("\n🎯 CKA Practice Exam Simulator")
    print("=" * 40)

    # Quick summary on startup
    questions = scan_all_questions(BASE_DIR)
    summary = get_domain_summary(questions)
    print(f"📚 Loaded {len(questions)} questions from {len(summary)} domains\n")
    for domain, info in sorted(summary.items()):
        print(f"   📁 {domain}: {info['total']} questions")
    print(f"\n🌐 Open http://localhost:5001 in your browser")
    print("=" * 40 + "\n")

    app.run(debug=True, host="0.0.0.0", port=5001)


if __name__ == "__main__":
    main()

