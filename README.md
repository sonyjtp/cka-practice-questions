# ☸️ CKA Practice Questions & Exam Simulator

A collection of hands-on **Certified Kubernetes Administrator (CKA)** practice questions with a built-in **exam simulator** that replicates the real CKA exam experience.

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- pip

### Setup & Run

```bash
# 1. Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the exam simulator
python app.py
```

Open **http://localhost:5000** in your browser.

## 🎯 Exam Simulator Features

| Feature | Description |
|---------|-------------|
| ⏱️ **Countdown Timer** | 2-hour timer with color-coded warnings (green → yellow → red) |
| ⚠️ **10-Minute Warning** | Modal popup when 10 minutes remain |
| 🔀 **Randomized Questions** | Questions shuffled and weighted by CKA domain proportions |
| 📊 **Question Palette** | Sidebar navigation with answered/flagged/current status |
| 🚩 **Flag for Review** | Mark questions to revisit before ending the exam |
| 🔼 **Show/Hide Answers** | Reveal answers and self-assess (✅ correct / ❌ incorrect) |
| 📈 **Results Dashboard** | Score ring, domain breakdown, time taken, per-question details |
| 🎚️ **Configurable Count** | Slider to choose 5–25 questions per exam |

## 📂 Adding New Questions

### File Structure

Place markdown files in topic-specific folders:

```
cka-practice-questions/
├── cluster-architecture/
│   └── admission-controllers.md
├── scheduling/
│   ├── daemonsets.md
│   ├── static-pods.md
│   └── ...
├── services-networking/    ← create as needed
├── storage/                ← create as needed
├── troubleshooting/        ← create as needed
```

### Folder-to-Domain Mapping

| Folder Name | CKA Exam Domain | Weight |
|-------------|----------------|--------|
| `cluster-architecture` | Cluster Architecture, Installation & Configuration | 25% |
| `scheduling` / `workloads` | Workloads & Scheduling | 15% |
| `services-networking` / `networking` | Services & Networking | 20% |
| `storage` | Storage | 10% |
| `troubleshooting` | Troubleshooting | 30% |

### Question File Format

Each `.md` file should follow this structure:

```markdown
# 📌 Topic Title

> **CKA Exam Domain:** Cluster Architecture, Installation & Configuration  
> **Topic:** Topic Name  
> **Total Questions:** N

---

## 🟢 Easy Questions

---

### Question 1 — Short Descriptive Title
> ⏱️ **Recommended Time: 5 minutes**

Question text goes here. Describe the task clearly.

<details>
<summary>✅ Answer</summary>

Answer content with code blocks, explanations, etc.

> **Key Concept:** Brief explanation of the underlying concept.

</details>

---

## 🟡 Medium Questions

### Question 2 — Another Title
...

## 🔴 Hard Questions

### Question 3 — Hard Title
...
```

**Key rules:**
- Use `## 🟢 Easy Questions`, `## 🟡 Medium Questions`, `## 🔴 Hard Questions` section headers
- Start each question with `### Question N — Title`
- Wrap answers in `<details>` / `<summary>` blocks
- The exam simulator parses these patterns automatically

## 📋 CKA Exam Reference

| Parameter | Value |
|-----------|-------|
| Duration | 2 hours |
| Questions | 15–20 performance-based tasks |
| Passing Score | 66% |
| Format | Hands-on (terminal-based) |
| Kubernetes Docs | Allowed during the exam |

### Domain Weights

| Domain | Weight |
|--------|--------|
| Cluster Architecture, Installation & Configuration | 25% |
| Workloads & Scheduling | 15% |
| Services & Networking | 20% |
| Storage | 10% |
| Troubleshooting | 30% |

## 🛠️ API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Exam simulator UI |
| `/api/exam?count=17` | GET | Generate a random exam (JSON) |
| `/api/questions` | GET | List all available questions |
| `/api/domains` | GET | Domain summary with question counts |

## 📜 License

This project is for personal study and exam preparation.