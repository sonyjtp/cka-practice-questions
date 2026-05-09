"""
CKA Practice Exam — Exam Generator

Generates randomized exams weighted by CKA domain proportions
and difficulty distribution.
"""

import random
from .question_parser import (
    scan_all_questions,
    DOMAIN_WEIGHTS,
    DIFFICULTY_EASY,
    DIFFICULTY_MEDIUM,
    DIFFICULTY_HARD,
)


# Default exam parameters
DEFAULT_QUESTION_COUNT = 17
DEFAULT_DURATION_MINUTES = 120
PASSING_SCORE_PERCENT = 66

# Target difficulty distribution
DIFFICULTY_DISTRIBUTION = {
    DIFFICULTY_EASY: 0.30,
    DIFFICULTY_MEDIUM: 0.45,
    DIFFICULTY_HARD: 0.25,
}


def generate_exam(question_count=DEFAULT_QUESTION_COUNT, base_dir=None, topics=None):
    """
    Generate a randomized CKA-style exam.

    Args:
        question_count: Number of questions to generate
        base_dir: Base directory for question files
        topics: Optional list/set of domains to filter by. If provided, only questions
                from these domains will be used.

    Returns a dict with exam metadata and a list of selected questions.
    """
    all_questions = scan_all_questions(base_dir)

    if not all_questions:
        return {
            "error": "No questions found. Add markdown files to the question directories.",
            "questions": [],
            "total_questions": 0,
        }

    # Filter by topics if specified
    if topics:
        # Convert topics to set for easier checking
        if isinstance(topics, str):
            topics_set = {t.strip() for t in topics.split("|")}
        else:
            topics_set = set(topics)
        all_questions = [q for q in all_questions if q["domain"] in topics_set]

        if not all_questions:
            return {
                "error": f"No questions found for selected topics: {', '.join(topics_set)}",
                "questions": [],
                "total_questions": 0,
            }

    # Cap question count at available questions
    question_count = min(question_count, len(all_questions))

    # Group questions by domain
    by_domain = {}
    for q in all_questions:
        domain = q["domain"]
        if domain not in by_domain:
            by_domain[domain] = []
        by_domain[domain].append(q)

    # Calculate how many questions to pick from each domain (weighted)
    available_domains = list(by_domain.keys())
    total_weight = sum(DOMAIN_WEIGHTS.get(d, 10) for d in available_domains)

    domain_targets = {}
    for domain in available_domains:
        weight = DOMAIN_WEIGHTS.get(domain, 10)
        target = round(question_count * weight / total_weight)
        # Don't exceed available questions in this domain
        target = min(target, len(by_domain[domain]))
        domain_targets[domain] = max(1, target)  # at least 1 from each domain

    # Adjust total to match target question count
    selected_total = sum(domain_targets.values())

    # If we have too many, reduce from the largest domains
    while selected_total > question_count:
        largest_domain = max(domain_targets, key=lambda d: domain_targets[d])
        if domain_targets[largest_domain] > 1:
            domain_targets[largest_domain] -= 1
            selected_total -= 1
        else:
            break

    # If we have too few, add from domains with remaining questions
    while selected_total < question_count:
        added = False
        for domain in sorted(available_domains, key=lambda d: DOMAIN_WEIGHTS.get(d, 10), reverse=True):
            if domain_targets[domain] < len(by_domain[domain]):
                domain_targets[domain] += 1
                selected_total += 1
                added = True
                if selected_total >= question_count:
                    break
        if not added:
            break

    # Select questions from each domain with difficulty distribution
    selected_questions = []

    for domain, target_count in domain_targets.items():
        pool = by_domain[domain][:]
        random.shuffle(pool)

        # Group pool by difficulty
        pool_by_diff = {
            DIFFICULTY_EASY: [q for q in pool if q["difficulty"] == DIFFICULTY_EASY],
            DIFFICULTY_MEDIUM: [q for q in pool if q["difficulty"] == DIFFICULTY_MEDIUM],
            DIFFICULTY_HARD: [q for q in pool if q["difficulty"] == DIFFICULTY_HARD],
        }

        domain_selected = []

        # Try to match difficulty distribution
        for difficulty, ratio in DIFFICULTY_DISTRIBUTION.items():
            diff_target = max(1, round(target_count * ratio))
            available = pool_by_diff[difficulty]
            pick_count = min(diff_target, len(available))
            domain_selected.extend(random.sample(available, pick_count))

        # If we don't have enough, fill from remaining pool
        selected_ids = {q["id"] for q in domain_selected}
        remaining = [q for q in pool if q["id"] not in selected_ids]

        while len(domain_selected) < target_count and remaining:
            domain_selected.append(remaining.pop())

        # If we have too many (due to rounding), trim
        if len(domain_selected) > target_count:
            domain_selected = random.sample(domain_selected, target_count)

        selected_questions.extend(domain_selected)

    # Final shuffle
    random.shuffle(selected_questions)

    # Number the questions for the exam
    for i, q in enumerate(selected_questions, 1):
        q["exam_number"] = i

    # Build domain breakdown
    domain_breakdown = {}
    for q in selected_questions:
        d = q["domain"]
        if d not in domain_breakdown:
            domain_breakdown[d] = {"count": 0, "weight": DOMAIN_WEIGHTS.get(d, 0)}
        domain_breakdown[d]["count"] += 1

    return {
        "total_questions": len(selected_questions),
        "duration_minutes": DEFAULT_DURATION_MINUTES,
        "passing_score_percent": PASSING_SCORE_PERCENT,
        "questions": selected_questions,
        "domain_breakdown": domain_breakdown,
        "total_available": len(all_questions),
    }


if __name__ == "__main__":
    exam = generate_exam()
    print(f"Generated exam with {exam['total_questions']} questions")
    print(f"Duration: {exam['duration_minutes']} minutes")
    print(f"Passing score: {exam['passing_score_percent']}%")
    print(f"\nDomain breakdown:")
    for domain, info in exam["domain_breakdown"].items():
        print(f"  {domain}: {info['count']} questions (weight: {info['weight']}%)")
    print(f"\nQuestions:")
    for q in exam["questions"]:
        diff_icon = {"easy": "🟢", "medium": "🟡", "hard": "🔴"}.get(q["difficulty"], "⚪")
        print(f"  {q['exam_number']}. {diff_icon} [{q['topic']}] {q['title']}")
