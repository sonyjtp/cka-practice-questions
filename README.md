# ☸️ CKA Practice Questions & Exam Simulator

> **Free, open-source Certified Kubernetes Administrator (CKA) practice exam simulator** — 337+ randomized questions, a 2-hour countdown timer with pause/resume, weighted difficulty scoring, self-assessment modes, and comprehensive troubleshooting scenarios matching the real CKA exam.

[![License: Study Use](https://img.shields.io/badge/license-study--use-blue)](#-license)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue?logo=python)](https://www.python.org/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-CKA-326CE5?logo=kubernetes&logoColor=white)](https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/)
[![Questions](https://img.shields.io/badge/questions-337%2B-green)](#-question-bank)
[![CNCF](https://img.shields.io/badge/CNCF-Certified-blueviolet)](https://www.cncf.io/)

---

## 🎯 What Is This?

This project is a **comprehensive CKA mock exam simulator** designed for engineers preparing for the [Certified Kubernetes Administrator (CKA)](https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/) exam by the CNCF / Linux Foundation.

It provides:
- **337+ hands-on CKA practice questions** organized by exam domain with progressive difficulty
- A realistic **web-based exam simulator** with 2-hour countdown timer, pause/resume, and question palette
- **Weighted scoring system** (Easy: 5 pts, Medium: 10 pts, Hard: 15 pts) matching real CKA distribution
- **Flexible assessment modes** — evaluate after exam or during exam for learning
- **Comprehensive troubleshooting scenarios** — 37+ debugging questions covering real cluster issues
- **Domain-level performance breakdown** showing exactly where to focus your study

Whether you are looking for *CKA practice questions*, a *CKA model exam*, *CKA mock tests*, or hands-on *Kubernetes troubleshooting practice* — this tool has you covered.

---

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
python run.py
```

Open **http://localhost:5001** in your browser.

---

## 🎯 Exam Simulator Features

| Feature                          | Description                                                            |
|----------------------------------|------------------------------------------------------------------------|
| ⏱️ **Countdown Timer**           | 2-hour timer with color-coded warnings (green → yellow → red)          |
| ⏸️ **Pause/Resume Timer**        | Click to pause exam timer when needed (breaks, urgent tasks)           |
| ⚠️ **10-Minute Warning**         | Modal popup when 10 minutes remain                                      |
| 🔀 **Randomized Questions**      | Questions shuffled and weighted by CKA domain proportions              |
| 📊 **Question Palette**          | Sidebar navigation with answered/flagged/current status                |
| 🚩 **Flag for Review**           | Mark questions to revisit before ending the exam                       |
| 🔼 **Show/Hide Answers**         | View answers during or after exam (configurable)                       |
| 📝 **During-Exam Assessment**    | Mark answers as correct/wrong during exam for immediate feedback       |
| 📈 **Results Dashboard**         | Live score calculation, domain breakdown, time, and details            |
| 🎚️ **Configurable Count**       | Slider to choose 5–25 questions per exam                               |
| 💯 **Weighted Scoring**          | Points based on difficulty: Easy (5) → Medium (10) → Hard (15)         |
| 🎓 **Flexible Assessment**       | Toggle self-assessment on/off; reveal answers during or at end         |
| 🔧 **Comprehensive Troubleshooting** | 37+ debugging questions covering cluster issues, certificates, RBAC  |

---

## ⚙️ Pre-Exam Configuration

Before each exam, you choose:

### 1. Assessment Mode
- **Enabled** (default): Full review & self-assessment after exam with live score calculation
- **Disabled**: Simple results (time, flagged questions) — for external grading

### 2. Answer Reveal Timing
- **At the end** (default, recommended): Answers hidden during exam — realistic CKA practice
- **During exam**: Answers can be toggled during the exam AND you can mark each question as correct/wrong immediately for instant feedback — learning mode

---

## 📊 Scoring System

**Weighted by Difficulty:**
- 🟢 **Easy**: 5 points each
- 🟡 **Medium**: 10 points each
- 🔴 **Hard**: 15 points each

**Score Calculation:**
```
Score % = (Points Earned / Total Possible Points) × 100
Passing Score: 66% (same as real CKA)
```

**Example Exam:**
- 5 easy (25 pts) + 7 medium (70 pts) + 3 hard (45 pts) = 140 total points
- If you get 4 easy, 5 medium, 2 hard correct: (20+50+30) / 140 = 71% ✅ Pass

---

## 📋 CKA Exam Reference

| Parameter       | Value                         |
|-----------------|-------------------------------|
| Duration        | 2 hours                       |
| Questions       | 15–20 performance-based tasks |
| Passing Score   | 66%                           |
| Format          | Hands-on (terminal-based)     |
| Kubernetes Docs | Allowed during the exam       |

### Domain Weights

| Domain                                             | Weight |
|----------------------------------------------------|--------|
| Cluster Architecture, Installation & Configuration | 25%    |
| Workloads & Scheduling                             | 15%    |
| Services & Networking                              | 20%    |
| Storage                                            | 10%    |
| Troubleshooting                                    | 30%    |

---

## 📂 Adding New Questions

### File Structure

Place markdown files in topic-specific folders under `data/`:

```
cka-practice-questions/
└── data/
    ├── cluster-architecture/
    │   └── admission-controllers.md
    ├── scheduling/
    │   ├── daemonsets.md
    │   ├── static-pods.md
    │   └── ...
    ├── services-networking/    ← create as needed
    ├── storage/                ← create as needed
    └── troubleshooting/        ← create as needed
```

### Folder-to-Domain Mapping

| Folder Name                          | CKA Exam Domain                                    | Weight |
|--------------------------------------|----------------------------------------------------|--------|
| `cluster-architecture`               | Cluster Architecture, Installation & Configuration | 25%    |
| `scheduling` / `workloads`           | Workloads & Scheduling                             | 15%    |
| `services-networking` / `networking` | Services & Networking                              | 20%    |
| `storage`                            | Storage                                            | 10%    |
| `troubleshooting`                    | Troubleshooting                                    | 30%    |

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

---

## 🛠️ API Endpoints

| Endpoint             | Method | Description                         |
|----------------------|--------|-------------------------------------|
| `/`                  | GET    | Exam simulator UI                   |
| `/api/exam?count=17` | GET    | Generate a random exam (JSON)       |
| `/api/questions`     | GET    | List all available questions        |
| `/api/domains`       | GET    | Domain summary with question counts |

---

## 🔍 Question Coverage (CKA Exam Domains)

**Total: 337+ Practice Questions**

### By Domain:

- **Cluster Architecture** (57 questions) — kubeadm, etcd backup & restore, RBAC, admission controllers, certificates, kustomize, helm
- **Workloads & Scheduling** (116 questions) — Deployments, DaemonSets, StatefulSets, init containers, resource limits, taints/tolerations, node affinity
- **Services & Networking** (59 questions) — Services, Ingress, NetworkPolicy, CoreDNS, CNI plugins, kube-proxy, service networking
- **Storage** (21 questions) — PersistentVolumes, PersistentVolumeClaims, StorageClasses, CSI, volume mounts
- **Logging & Monitoring** (20 questions) — Cluster logging, application logging, metrics, observability
- **Security** (27 questions) — TLS certificates, kubeconfig, security contexts, image security, RBAC deep dives
- **Troubleshooting** (37 questions)
  - Cluster debugging (6 questions) — Pending pods, CrashLoopBackOff, node status, services, volumes, multi-issue scenarios
  - Application & Network debugging (6 questions) — OOMKilled, init containers, deployments, Ingress, API server, etcd recovery
  - Certificate & TLS debugging (8 questions) — Certificate expiration, CA issues, kubelet rotation, TLS bootstrap, front-proxy
  - Control Plane & Worker debugging (9 questions) — Kubelet, API server, scheduler, controller-manager, cluster recovery
  - Storage & RBAC debugging (8 questions) — PVC binding, provisioning, pod permissions, webhooks, authorization conflicts

> These topics align with the official [CKA Exam Curriculum](https://github.com/cncf/curriculum) published by the CNCF.

---

## 🤝 Contributing

Contributions of new CKA practice questions are very welcome!

1. Fork the repository
2. Add question files under the appropriate `data/<domain>/` folder
3. Follow the question file format described above
4. Open a pull request

---

## 📜 License

This project is intended for personal study and CKA exam preparation. Free to use and share.

---

<!-- SEO keywords: CKA practice exam, CKA practice questions, Certified Kubernetes Administrator exam prep, CKA mock test, CKA model questions, Kubernetes certification questions, CKA exam simulator, kubectl practice scenarios, CNCF CKA 2024 2025, CKA study material, Kubernetes admin exam practice -->
