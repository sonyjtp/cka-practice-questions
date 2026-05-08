/**
 * CKA Practice Exam Simulator — Main Application Logic
 *
 * Handles exam state, countdown timer, question navigation,
 * flagging, answer reveals, and results calculation.
 */

(function () {
  "use strict";

  // ===== STATE =====
  let exam = null;
  let currentIndex = 0;
  let timerInterval = null;
  let remainingSeconds = 0;
  let tenMinWarningShown = false;
  let examStartTime = null;
  let examEndTime = null;

  // Per-question state: { answered: bool, correct: bool|null, flagged: bool, answerRevealed: bool }
  let questionStates = [];

  // ===== DOM REFS =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const startScreen = $("#start-screen");
  const examScreen = $("#exam-screen");
  const resultsScreen = $("#results-screen");
  const countSlider = $("#question-count-slider");
  const countDisplay = $("#count-display");
  const availableDisplay = $("#available-count");

  // ===== INIT =====
  async function init() {
    // Fetch available question count
    try {
      const res = await fetch("/api/domains");
      const domains = await res.json();
      let total = 0;
      for (const d of Object.values(domains)) total += d.total;
      if (availableDisplay) availableDisplay.textContent = total;
      if (countSlider) {
        countSlider.max = Math.min(total, 50);
        countSlider.value = Math.min(17, total);
        countDisplay.textContent = countSlider.value;
      }
    } catch (e) {
      console.error("Failed to load domains:", e);
    }

    // Bind events
    if (countSlider) {
      countSlider.addEventListener("input", () => {
        countDisplay.textContent = countSlider.value;
      });
    }

    $("#start-btn").addEventListener("click", startExam);
  }

  // ===== SCREENS =====
  function showScreen(screen) {
    [startScreen, examScreen, resultsScreen].forEach((s) =>
      s.classList.remove("active")
    );
    screen.classList.add("active");
  }

  // ===== START EXAM =====
  async function startExam() {
    const count = countSlider ? parseInt(countSlider.value) : 17;
    showScreen(examScreen);

    // Show loading
    $(".question-area").innerHTML =
      '<div class="loading"><div class="spinner"></div><p>Generating exam…</p></div>';

    try {
      const res = await fetch(`/api/exam?count=${count}`);
      exam = await res.json();

      if (exam.error || !exam.questions || exam.questions.length === 0) {
        $(".question-area").innerHTML = `
          <div class="loading">
            <p style="color: var(--red);">⚠️ ${exam.error || "No questions available."}</p>
            <button class="btn btn-secondary" onclick="location.reload()">Go Back</button>
          </div>`;
        return;
      }

      // Init state
      currentIndex = 0;
      questionStates = exam.questions.map(() => ({
        answered: false,
        correct: null,
        flagged: false,
        answerRevealed: false,
      }));

      // Timer
      remainingSeconds = exam.duration_minutes * 60;
      tenMinWarningShown = false;
      examStartTime = Date.now();

      // Build sidebar
      buildSidebar();
      renderQuestion();
      startTimer();

      // Update progress
      updateProgress();
    } catch (e) {
      $(".question-area").innerHTML = `
        <div class="loading">
          <p style="color: var(--red);">⚠️ Failed to load exam: ${e.message}</p>
          <button class="btn btn-secondary" onclick="location.reload()">Retry</button>
        </div>`;
    }
  }

  // ===== TIMER =====
  function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        clearInterval(timerInterval);
        endExam(true);
        return;
      }

      // 10-minute warning
      if (remainingSeconds === 600 && !tenMinWarningShown) {
        tenMinWarningShown = true;
        showModal(
          "⚠️",
          "10 Minutes Remaining",
          "You have 10 minutes left to complete the exam. Consider reviewing flagged questions.",
          [{ text: "Continue", class: "btn btn-primary", action: hideModal }]
        );
      }

      updateTimerDisplay();
    }, 1000);
  }

  function updateTimerDisplay() {
    const hours = Math.floor(remainingSeconds / 3600);
    const mins = Math.floor((remainingSeconds % 3600) / 60);
    const secs = remainingSeconds % 60;

    const timerEl = $("#timer");
    const timeStr =
      hours > 0
        ? `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
        : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    timerEl.querySelector(".timer-text").textContent = timeStr;

    // Color states
    timerEl.classList.remove("green", "yellow", "red", "pulse");
    if (remainingSeconds > 1800) {
      timerEl.classList.add("green");
    } else if (remainingSeconds > 600) {
      timerEl.classList.add("yellow");
    } else {
      timerEl.classList.add("red");
      if (remainingSeconds <= 300) timerEl.classList.add("pulse");
    }
  }

  // ===== SIDEBAR =====
  function buildSidebar() {
    const grid = $(".question-grid");
    grid.innerHTML = "";
    exam.questions.forEach((q, i) => {
      const dot = document.createElement("button");
      dot.className = "q-dot";
      dot.textContent = i + 1;
      dot.title = q.title;
      dot.addEventListener("click", () => navigateTo(i));
      grid.appendChild(dot);
    });
    updateSidebar();
  }

  function updateSidebar() {
    const dots = $$(".q-dot");
    dots.forEach((dot, i) => {
      dot.classList.remove("active", "answered", "flagged");
      if (i === currentIndex) dot.classList.add("active");
      if (questionStates[i].answered) dot.classList.add("answered");
      if (questionStates[i].flagged) dot.classList.add("flagged");
    });
  }

  // ===== QUESTION RENDERING =====
  function renderQuestion() {
    const q = exam.questions[currentIndex];
    const state = questionStates[currentIndex];

    const diffIcons = { easy: "🟢", medium: "🟡", hard: "🔴" };
    const diffLabel = q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1);

    // Convert markdown-ish text to HTML (basic)
    const questionHtml = markdownToHtml(q.question);
    const answerHtml = markdownToHtml(q.answer);

    const area = $(".question-area");
    area.innerHTML = `
      <div class="question-header">
        <span class="question-number">Question ${currentIndex + 1} of ${exam.total_questions}</span>
        <span class="difficulty-badge ${q.difficulty}">${diffIcons[q.difficulty] || ""} ${diffLabel}</span>
        <span class="domain-badge">${q.domain}</span>
        <span class="topic-badge">${q.topic}</span>
      </div>
      <h2 class="question-title">${escapeHtml(q.title)}</h2>
      <div class="question-body">${questionHtml}</div>

      <div class="answer-section">
        <button class="answer-toggle" id="answer-toggle-btn">
          ${state.answerRevealed ? "🔽 Hide Answer" : "🔼 Show Answer"}
        </button>
        <div class="answer-content ${state.answerRevealed ? "visible" : ""}" id="answer-content">
          ${answerHtml}
        </div>
        <div class="self-assess" id="self-assess" style="display: ${state.answerRevealed ? "flex" : "none"}">
          <span>How did you do?</span>
          <button class="assess-btn ${state.correct === true ? "correct selected" : ""}" data-result="correct">✅ Got it right</button>
          <button class="assess-btn ${state.correct === false ? "incorrect selected" : ""}" data-result="incorrect">❌ Got it wrong</button>
        </div>
      </div>

      <div class="question-nav">
        <button class="btn btn-secondary" id="prev-btn" ${currentIndex === 0 ? "disabled" : ""}>← Previous</button>
        <div class="nav-center">
          <button class="flag-btn ${state.flagged ? "flagged" : ""}" id="flag-btn">
            ${state.flagged ? "🚩 Flagged" : "🏳️ Flag for Review"}
          </button>
        </div>
        ${
          currentIndex === exam.questions.length - 1
            ? '<button class="btn btn-danger" id="end-btn">End Exam</button>'
            : '<button class="btn btn-primary" id="next-btn">Next →</button>'
        }
      </div>
    `;

    // Bind events
    $("#answer-toggle-btn").addEventListener("click", toggleAnswer);
    $$("#self-assess .assess-btn").forEach((btn) =>
      btn.addEventListener("click", () => selfAssess(btn.dataset.result))
    );
    if ($("#prev-btn")) $("#prev-btn").addEventListener("click", () => navigateTo(currentIndex - 1));
    if ($("#next-btn")) $("#next-btn").addEventListener("click", () => navigateTo(currentIndex + 1));
    if ($("#end-btn")) $("#end-btn").addEventListener("click", confirmEndExam);
    if ($("#flag-btn")) $("#flag-btn").addEventListener("click", toggleFlag);

    updateSidebar();
    updateProgress();
    area.scrollTop = 0;
  }

  function toggleAnswer() {
    const state = questionStates[currentIndex];
    state.answerRevealed = !state.answerRevealed;

    const content = $("#answer-content");
    const btn = $("#answer-toggle-btn");
    const assess = $("#self-assess");

    if (state.answerRevealed) {
      content.classList.add("visible");
      btn.innerHTML = "🔽 Hide Answer";
      assess.style.display = "flex";
    } else {
      content.classList.remove("visible");
      btn.innerHTML = "🔼 Show Answer";
      assess.style.display = "none";
    }
  }

  function selfAssess(result) {
    const state = questionStates[currentIndex];
    const isCorrect = result === "correct";
    state.correct = isCorrect;
    state.answered = true;

    // Update button states
    $$("#self-assess .assess-btn").forEach((btn) => {
      btn.classList.remove("selected");
      if (btn.dataset.result === result) btn.classList.add("selected");
    });

    updateSidebar();
    updateProgress();
  }

  function toggleFlag() {
    const state = questionStates[currentIndex];
    state.flagged = !state.flagged;
    const btn = $("#flag-btn");
    btn.classList.toggle("flagged");
    btn.innerHTML = state.flagged ? "🚩 Flagged" : "🏳️ Flag for Review";
    updateSidebar();
  }

  function navigateTo(index) {
    if (index < 0 || index >= exam.questions.length) return;
    currentIndex = index;
    renderQuestion();
  }

  function updateProgress() {
    const answered = questionStates.filter((s) => s.answered).length;
    const el = $(".progress-text");
    if (el) el.textContent = `${answered}/${exam.total_questions} answered`;
  }

  // ===== END EXAM =====
  function confirmEndExam() {
    const unanswered = questionStates.filter((s) => !s.answered).length;
    const flagged = questionStates.filter((s) => s.flagged).length;

    let msg = "Are you sure you want to end the exam?";
    if (unanswered > 0) msg += `\n\n⚠️ You have ${unanswered} unanswered question(s).`;
    if (flagged > 0) msg += `\n🚩 You have ${flagged} flagged question(s).`;

    showModal("🏁", "End Exam?", msg, [
      { text: "Cancel", class: "btn btn-secondary", action: hideModal },
      { text: "End Exam", class: "btn btn-danger", action: () => { hideModal(); endExam(false); } },
    ]);
  }

  function endExam(timedOut) {
    clearInterval(timerInterval);
    examEndTime = Date.now();

    if (timedOut) {
      showModal("⏰", "Time's Up!", "Your exam time has expired. Let's see your results.", [
        { text: "View Results", class: "btn btn-primary", action: () => { hideModal(); showResults(); } },
      ]);
    } else {
      showResults();
    }
  }

  // ===== RESULTS =====
  function showResults() {
    showScreen(resultsScreen);

    const total = exam.total_questions;
    const answered = questionStates.filter((s) => s.answered).length;
    const correct = questionStates.filter((s) => s.correct === true).length;
    const incorrect = questionStates.filter((s) => s.correct === false).length;
    const unanswered = total - answered;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= exam.passing_score_percent;

    // Time
    const elapsed = Math.floor(((examEndTime || Date.now()) - examStartTime) / 1000);
    const elapsedMins = Math.floor(elapsed / 60);
    const elapsedSecs = elapsed % 60;

    // Score ring
    const circumference = 2 * Math.PI * 75;
    const offset = circumference - (score / 100) * circumference;
    const scoreColor = passed ? "var(--green)" : "var(--red)";

    // Domain breakdown
    const domainResults = {};
    exam.questions.forEach((q, i) => {
      const d = q.domain;
      if (!domainResults[d]) domainResults[d] = { correct: 0, total: 0 };
      domainResults[d].total++;
      if (questionStates[i].correct === true) domainResults[d].correct++;
    });

    let domainRowsHtml = "";
    for (const [domain, info] of Object.entries(domainResults)) {
      const pct = info.total > 0 ? Math.round((info.correct / info.total) * 100) : 0;
      const barColor = pct >= 66 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
      domainRowsHtml += `
        <div class="domain-row">
          <span class="domain-name">${domain}</span>
          <div class="domain-bar-wrap">
            <div class="domain-bar" style="width: ${pct}%; background: ${barColor};"></div>
          </div>
          <span class="domain-score" style="color: ${barColor}">${info.correct}/${info.total}</span>
        </div>`;
    }

    // Question list
    let questionsHtml = "";
    exam.questions.forEach((q, i) => {
      const s = questionStates[i];
      let icon = "⬜";
      if (s.correct === true) icon = "✅";
      else if (s.correct === false) icon = "❌";
      else if (!s.answered) icon = "⬜";
      questionsHtml += `
        <div class="rq-item">
          <span class="rq-status">${icon}</span>
          <span class="rq-num">${i + 1}.</span>
          <span class="rq-title">${escapeHtml(q.title)}</span>
          <span class="difficulty-badge ${q.difficulty}" style="font-size:0.65rem">${q.difficulty}</span>
        </div>`;
    });

    resultsScreen.innerHTML = `
      <div class="results-header">
        <div class="results-icon">${passed ? "🎉" : "📝"}</div>
        <h1 class="results-title">${passed ? "Congratulations!" : "Keep Practicing!"}</h1>
        <p class="results-subtitle">${passed ? "You passed the practice exam!" : `You need ${exam.passing_score_percent}% to pass. Keep going!`}</p>
      </div>

      <div class="results-score-ring">
        <svg viewBox="0 0 160 160">
          <circle class="bg" cx="80" cy="80" r="75" fill="none" stroke-width="8" />
          <circle class="fg" cx="80" cy="80" r="75" fill="none" stroke-width="8"
            stroke="${scoreColor}" stroke-linecap="round"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
        </svg>
        <div class="score-text">
          <span class="score-percent" style="color:${scoreColor}">${score}%</span>
          <span class="score-label">Score</span>
        </div>
      </div>

      <div class="results-stats">
        <div class="stat-card">
          <div class="stat-value" style="color:var(--green)">${correct}</div>
          <div class="stat-label">Correct</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--red)">${incorrect}</div>
          <div class="stat-label">Incorrect</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--text-muted)">${unanswered}</div>
          <div class="stat-label">Unanswered</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${elapsedMins}m ${elapsedSecs}s</div>
          <div class="stat-label">Time Taken</div>
        </div>
      </div>

      <div class="results-domain-breakdown">
        <h3 style="font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1rem;">Domain Breakdown</h3>
        ${domainRowsHtml}
      </div>

      <div class="results-questions">
        <h3>Question Details</h3>
        ${questionsHtml}
      </div>

      <div class="results-actions">
        <button class="btn btn-primary" onclick="location.reload()">🔄 New Exam</button>
      </div>
    `;
  }

  // ===== MODAL =====
  function showModal(icon, title, text, actions) {
    const overlay = $("#modal-overlay");
    const modal = overlay.querySelector(".modal");

    modal.innerHTML = `
      <div class="modal-icon">${icon}</div>
      <h3 class="modal-title">${title}</h3>
      <p class="modal-text" style="white-space:pre-line">${text}</p>
      <div class="modal-actions" id="modal-actions"></div>
    `;

    const actionsEl = modal.querySelector("#modal-actions");
    actions.forEach((a) => {
      const btn = document.createElement("button");
      btn.className = a.class;
      btn.textContent = a.text;
      btn.addEventListener("click", a.action);
      actionsEl.appendChild(btn);
    });

    overlay.classList.add("visible");
  }

  function hideModal() {
    $("#modal-overlay").classList.remove("visible");
  }

  // ===== MARKDOWN TO HTML (basic) =====
  function markdownToHtml(text) {
    if (!text) return "";

    let html = escapeHtml(text);

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Italic
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Headers within content
    html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
    html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");

    // Blockquotes
    html = html.replace(/^&gt;\s+(.+)$/gm, "<blockquote>$1</blockquote>");

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

    // Ordered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

    // Tables (basic)
    html = html.replace(
      /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g,
      (_, header, body) => {
        const ths = header
          .split("|")
          .filter((c) => c.trim())
          .map((c) => `<th>${c.trim()}</th>`)
          .join("");
        const rows = body
          .trim()
          .split("\n")
          .map((row) => {
            const tds = row
              .split("|")
              .filter((c) => c.trim())
              .map((c) => `<td>${c.trim()}</td>`)
              .join("");
            return `<tr>${tds}</tr>`;
          })
          .join("");
        return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
      }
    );

    // Paragraphs (double newlines)
    html = html
      .split("\n\n")
      .map((block) => {
        block = block.trim();
        if (!block) return "";
        if (
          block.startsWith("<pre>") ||
          block.startsWith("<ul>") ||
          block.startsWith("<ol>") ||
          block.startsWith("<h") ||
          block.startsWith("<table") ||
          block.startsWith("<blockquote")
        )
          return block;
        return `<p>${block.replace(/\n/g, "<br>")}</p>`;
      })
      .join("\n");

    return html;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== BOOT =====
  document.addEventListener("DOMContentLoaded", init);
})();
