"""
CKA Practice Questions — Markdown Parser

Recursively scans markdown files and extracts structured questions
with domain, topic, difficulty, question text, and answer content.
"""

import os
import re
import hashlib
from pathlib import Path


# Map folder names to CKA exam domains
FOLDER_TO_DOMAIN = {
    "cluster-architecture": "Cluster Architecture, Installation & Configuration",
    "scheduling": "Workloads & Scheduling",
    "workloads": "Workloads & Scheduling",
    "services-networking": "Services & Networking",
    "networking": "Services & Networking",
    "storage": "Storage",
    "troubleshooting": "Troubleshooting",
    "security": "Cluster Architecture, Installation & Configuration",
    "logging-monitoring": "Logging & Monitoring",
}

# CKA domain weights (percentage of exam)
DOMAIN_WEIGHTS = {
    "Cluster Architecture, Installation & Configuration": 25,
    "Workloads & Scheduling": 15,
    "Services & Networking": 20,
    "Storage": 10,
    "Troubleshooting": 30,
    "Logging & Monitoring": 10,  # Bonus/supplementary domain
}

# Difficulty levels
DIFFICULTY_EASY = "easy"
DIFFICULTY_MEDIUM = "medium"
DIFFICULTY_HARD = "hard"


def _generate_question_id(domain, topic, question_number):
    """Generate a stable, unique ID for a question."""
    raw = f"{domain}:{topic}:{question_number}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def _detect_difficulty(text):
    """Detect difficulty from section header text."""
    text_lower = text.lower()
    if "easy" in text_lower or "🟢" in text:
        return DIFFICULTY_EASY
    elif "medium" in text_lower or "🟡" in text:
        return DIFFICULTY_MEDIUM
    elif "hard" in text_lower or "🔴" in text:
        return DIFFICULTY_HARD
    return DIFFICULTY_MEDIUM  # default


def _extract_domain_from_header(content):
    """Extract the CKA Exam Domain from the file header metadata."""
    match = re.search(
        r"\*\*CKA Exam Domain:\*\*\s*(.+?)(?:\s*\\?\s*$|\n)", content, re.MULTILINE
    )
    if match:
        return match.group(1).strip().rstrip("\\").strip()
    return None


def _extract_topic_from_header(content):
    """Extract the Topic from the file header metadata."""
    match = re.search(
        r"\*\*Topic:\*\*\s*(.+?)(?:\s*\\?\s*$|\n)", content, re.MULTILINE
    )
    if match:
        return match.group(1).strip().rstrip("\\").strip()
    return None


def _extract_title_from_header(content):
    """Extract the main title (# heading) from the file."""
    match = re.match(r"^#\s+(.+)", content.strip())
    if match:
        return match.group(1).strip()
    return None


def _parse_questions_from_content(content, domain, topic):
    """Parse all questions from a markdown file's content."""
    questions = []
    current_difficulty = DIFFICULTY_MEDIUM

    # Split into lines for processing
    lines = content.split("\n")

    # Track difficulty sections
    difficulty_pattern = re.compile(r"^##\s+.*(Easy|Medium|Hard|🟢|🟡|🔴).*", re.IGNORECASE)
    question_pattern = re.compile(r"^###\s+Question\s+(\d+)\s*[—–-]\s*(.+)", re.IGNORECASE)

    i = 0
    while i < len(lines):
        line = lines[i]

        # Check for difficulty section
        diff_match = difficulty_pattern.match(line)
        if diff_match:
            current_difficulty = _detect_difficulty(line)
            i += 1
            continue

        # Check for question start
        q_match = question_pattern.match(line)
        if q_match:
            q_number = int(q_match.group(1))
            q_title = q_match.group(2).strip()

            # Collect question body and answer
            i += 1
            question_lines = []
            answer_lines = []
            in_details = False
            details_depth = 0

            while i < len(lines):
                # Check if we hit the next question or section
                if question_pattern.match(lines[i]) or (
                    lines[i].startswith("## ") and not lines[i].startswith("### ")
                ):
                    # Don't consume this line — break so outer loop processes it
                    break

                if "<details>" in lines[i]:
                    in_details = True
                    details_depth += 1
                    i += 1
                    continue
                elif "</details>" in lines[i]:
                    details_depth -= 1
                    if details_depth <= 0:
                        in_details = False
                    i += 1
                    continue
                elif "<summary>" in lines[i] and "</summary>" in lines[i]:
                    i += 1
                    continue

                if in_details:
                    answer_lines.append(lines[i])
                else:
                    question_lines.append(lines[i])

                i += 1

            # Clean up question and answer text
            question_text = "\n".join(question_lines).strip()
            answer_text = "\n".join(answer_lines).strip()

            # Remove the recommended time line from question text and extract it
            time_match = re.search(r"⏱️\s*\*\*Recommended Time:\s*(\d+)\s*minutes?\*\*", question_text)
            recommended_time = int(time_match.group(1)) if time_match else None
            question_text = re.sub(r">\s*⏱️\s*\*\*Recommended Time:.*?\*\*\s*\n?", "", question_text).strip()

            # Remove leading/trailing --- from question text
            question_text = re.sub(r"^---\s*\n?", "", question_text).strip()
            question_text = re.sub(r"\n?---\s*$", "", question_text).strip()

            question_id = _generate_question_id(domain, topic, q_number)

            questions.append({
                "id": question_id,
                "domain": domain,
                "topic": topic,
                "number": q_number,
                "title": q_title,
                "difficulty": current_difficulty,
                "question": question_text,
                "answer": answer_text,
                "recommended_time": recommended_time,
            })
            continue

        i += 1

    return questions


def parse_markdown_file(filepath):
    """Parse a single markdown file and extract all questions."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Determine domain from folder name
    folder_name = Path(filepath).parent.name
    domain = FOLDER_TO_DOMAIN.get(
        folder_name,
        _extract_domain_from_header(content) or folder_name.replace("-", " ").title(),
    )

    # Extract topic
    topic = _extract_topic_from_header(content) or _extract_title_from_header(content) or Path(filepath).stem.replace("-", " ").title()

    return _parse_questions_from_content(content, domain, topic)


def scan_all_questions(base_dir=None):
    """Recursively scan all markdown files and return all parsed questions."""
    if base_dir is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))

    all_questions = []
    base_path = Path(base_dir)

    for md_file in sorted(base_path.rglob("*.md")):
        # Skip README, any dotfiles, templates, static, and hidden dirs
        relative = md_file.relative_to(base_path)
        parts = relative.parts

        if any(p.startswith(".") for p in parts):
            continue
        if md_file.name.lower() == "readme.md":
            continue
        if any(p in ("templates", "static", "__pycache__", "venv", ".venv") for p in parts):
            continue

        try:
            questions = parse_markdown_file(str(md_file))
            all_questions.extend(questions)
        except Exception as e:
            print(f"Warning: Failed to parse {md_file}: {e}")

    return all_questions


def get_domain_summary(questions=None):
    """Return a summary of questions grouped by domain."""
    if questions is None:
        questions = scan_all_questions()

    summary = {}
    for q in questions:
        domain = q["domain"]
        if domain not in summary:
            summary[domain] = {
                "domain": domain,
                "weight": DOMAIN_WEIGHTS.get(domain, 0),
                "topics": set(),
                "total": 0,
                "easy": 0,
                "medium": 0,
                "hard": 0,
            }
        summary[domain]["topics"].add(q["topic"])
        summary[domain]["total"] += 1
        summary[domain][q["difficulty"]] += 1

    # Convert sets to lists for JSON serialization
    for domain_info in summary.values():
        domain_info["topics"] = sorted(domain_info["topics"])

    return summary


if __name__ == "__main__":
    # Quick test: parse all questions and print summary
    questions = scan_all_questions()
    print(f"\nTotal questions found: {len(questions)}\n")

    summary = get_domain_summary(questions)
    for domain, info in sorted(summary.items()):
        print(f"📁 {domain} (weight: {info['weight']}%)")
        print(f"   Topics: {', '.join(info['topics'])}")
        print(f"   Questions: {info['total']} (🟢{info['easy']} 🟡{info['medium']} 🔴{info['hard']})")
        print()
