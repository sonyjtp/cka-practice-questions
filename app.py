"""
CKA Practice Exam Simulator — Flask Application

Serves the exam UI and provides API endpoints for
generating randomized exams from markdown question files.
"""

import os
from flask import Flask, jsonify, render_template, request
from question_parser import scan_all_questions, get_domain_summary
from exam_generator import generate_exam, DEFAULT_QUESTION_COUNT

app = Flask(__name__)

# Base directory for question files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


@app.route("/")
def index():
    """Serve the single-page exam application."""
    return render_template("index.html")


@app.route("/api/exam", methods=["GET"])
def api_generate_exam():
    """Generate a random exam and return as JSON."""
    question_count = request.args.get("count", DEFAULT_QUESTION_COUNT, type=int)
    question_count = max(1, min(question_count, 50))  # clamp to [1, 50]

    exam = generate_exam(question_count=question_count, base_dir=BASE_DIR)
    return jsonify(exam)


@app.route("/api/questions", methods=["GET"])
def api_list_questions():
    """List all available questions."""
    questions = scan_all_questions(BASE_DIR)
    return jsonify({
        "total": len(questions),
        "questions": questions,
    })


@app.route("/api/domains", methods=["GET"])
def api_domains():
    """List available domains with question counts."""
    questions = scan_all_questions(BASE_DIR)
    summary = get_domain_summary(questions)
    return jsonify(summary)


if __name__ == "__main__":
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
