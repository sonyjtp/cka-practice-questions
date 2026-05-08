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
  let examEnded = false;   // true once the exam has been submitted

  // Per-question state: { answered: bool, correct: bool|null, flagged: bool }
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
    examEnded = false;
    showScreen(examScreen);

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

      currentIndex = 0;
      questionStates = exam.questions.map(() => ({
        answered: false,
        correct: null,
        flagged: false,
      }));

      remainingSeconds = exam.duration_minutes * 60;
      tenMinWarningShown = false;
      examStartTime = Date.now();

      buildSidebar();
      renderQuestion();
      startTimer();

      const topbarEndBtn = $("#topbar-end-btn");
      if (topbarEndBtn) topbarEndBtn.addEventListener("click", confirmEndExam);

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

    const questionHtml = markdownToHtml(q.question);
    const answerHtml = markdownToHtml(q.answer);

    // In review mode (post-exam), show answer section; during exam, hide it
    const answerSection = examEnded ? `
      <div class="answer-section">
        <button class="answer-toggle" id="answer-toggle-btn">
          ${state.answerRevealed ? "🔽 Hide Answer" : "🔼 Show Answer"}
        </button>
        <div class="answer-content ${state.answerRevealed ? "visible" : ""}" id="answer-content">
          ${answerHtml}
        </div>
      </div>` : `
      <div class="attempt-notice">
        💡 <strong>Attempt this task</strong> in your Kubernetes environment. Answers and self-assessment will be available after you end the exam.
      </div>`;

    // In review mode show "Back to Results" instead of "End Exam"
    const rightNav = examEnded
      ? `<div style="display:flex;gap:0.5rem;align-items:center">
           ${currentIndex < exam.questions.length - 1
             ? '<button class="btn btn-primary" id="next-btn">Next →</button>'
             : ''}
           <button class="btn btn-secondary" id="back-results-btn">📊 Back to Results</button>
         </div>`
      : `<div style="display:flex;gap:0.5rem;align-items:center">
           ${currentIndex < exam.questions.length - 1
             ? '<button class="btn btn-primary" id="next-btn">Next →</button>'
             : ''}
           <button class="btn btn-danger" id="end-btn">🏁 End Exam</button>
         </div>`;

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
      ${answerSection}
      <div class="question-nav">
        <button class="btn btn-secondary" id="prev-btn" ${currentIndex === 0 ? "disabled" : ""}>← Previous</button>
        <div class="nav-center">
          ${!examEnded ? `<button class="flag-btn ${state.flagged ? "flagged" : ""}" id="flag-btn">
            ${state.flagged ? "🚩 Flagged" : "🏳️ Flag for Review"}
          </button>` : ''}
        </div>
        ${rightNav}
      </div>
    `;

    if ($("#answer-toggle-btn")) $("#answer-toggle-btn").addEventListener("click", toggleAnswer);
    if ($("#prev-btn")) $("#prev-btn").addEventListener("click", () => navigateTo(currentIndex - 1));
    if ($("#next-btn")) $("#next-btn").addEventListener("click", () => navigateTo(currentIndex + 1));
    if ($("#end-btn")) $("#end-btn").addEventListener("click", confirmEndExam);
    if ($("#flag-btn")) $("#flag-btn").addEventListener("click", toggleFlag);
    if ($("#back-results-btn")) $("#back-results-btn").addEventListener("click", () => showResults());

    updateSidebar();
    updateProgress();
    area.scrollTop = 0;
  }

  function toggleAnswer() {
    const state = questionStates[currentIndex];
    state.answerRevealed = !state.answerRevealed;

    const content = $("#answer-content");
    const btn = $("#answer-toggle-btn");

    if (state.answerRevealed) {
      content.classList.add("visible");
      btn.innerHTML = "🔽 Hide Answer";
    } else {
      content.classList.remove("visible");
      btn.innerHTML = "🔼 Show Answer";
    }
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
    const el = $(".progress-text");
    if (!el) return;
    if (examEnded) {
      const assessed = questionStates.filter((s) => s.answered).length;
      el.textContent = `${assessed}/${exam.total_questions} assessed`;
    } else {
      const flagged = questionStates.filter((s) => s.flagged).length;
      el.textContent = flagged > 0 ? `${flagged} flagged` : "0 flagged";
    }
  }

  // ===== END EXAM =====
  function confirmEndExam() {
    const flagged = questionStates.filter((s) => s.flagged).length;

    let msg = "Are you sure you want to end the exam?\n\nYou'll be able to review all questions and self-assess your answers on the results page.";
    if (flagged > 0) msg += `\n\n🚩 You have ${flagged} flagged question(s).`;

    showModal("🏁", "End Exam?", msg, [
      { text: "Cancel", class: "btn btn-secondary", action: hideModal },
      { text: "End Exam", class: "btn btn-danger", action: () => { hideModal(); endExam(false); } },
    ]);
  }

  function endExam(timedOut) {
    clearInterval(timerInterval);
    examEndTime = Date.now();
    examEnded = true;

    if (timedOut) {
      showModal("⏰", "Time's Up!", "Your exam time has expired. Review your answers and self-assess on the results page.", [
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
    const elapsed = Math.floor(((examEndTime || Date.now()) - examStartTime) / 1000);
    const elapsedMins = Math.floor(elapsed / 60);
    const elapsedSecs = elapsed % 60;
    const circumference = 2 * Math.PI * 75;

    // Build expandable question cards for self-assessment
    let questionsHtml = "";
    exam.questions.forEach((q, i) => {
      const s = questionStates[i];
      const answerHtml = markdownToHtml(q.answer);
      const statusIcon = s.correct === true ? "✅" : s.correct === false ? "❌" : "⬜";
      const cardClass = s.correct === true ? "rq-correct" : s.correct === false ? "rq-incorrect" : "";

      questionsHtml += `
        <div class="rq-card ${cardClass}" id="rq-card-${i}">
          <div class="rq-card-header" data-card="${i}">
            <span class="rq-status" id="rq-status-${i}">${statusIcon}</span>
            <span class="rq-num">${i + 1}.</span>
            <span class="rq-title">${escapeHtml(q.title)}</span>
            <span class="difficulty-badge ${q.difficulty}" style="font-size:0.65rem">${q.difficulty}</span>
            <div class="rq-assess-inline">
              <button class="assess-btn ${s.correct === true ? "correct selected" : ""}" data-idx="${i}" data-result="correct" title="Got it right">✅</button>
              <button class="assess-btn ${s.correct === false ? "incorrect selected" : ""}" data-idx="${i}" data-result="incorrect" title="Got it wrong">❌</button>
            </div>
            <span class="rq-expand-icon" id="rq-expand-${i}">▼</span>
          </div>
          <div class="rq-card-body" id="rq-body-${i}" style="display:none">
            <div class="rq-question-text">${markdownToHtml(q.question)}</div>
            <div class="rq-answer-label">Answer</div>
            <div class="rq-answer-content">${answerHtml}</div>
          </div>
        </div>`;
    });

    resultsScreen.innerHTML = `
      <div class="results-header">
        <div class="results-icon" id="results-icon">📝</div>
        <h1 class="results-title" id="results-title">Review &amp; Self-Assess</h1>
        <p class="results-subtitle" id="results-subtitle">Mark each question below — the score updates as you go.</p>
      </div>

      <div class="results-score-ring">
        <svg viewBox="0 0 160 160">
          <circle class="bg" cx="80" cy="80" r="75" fill="none" stroke-width="8" />
          <circle class="fg" id="score-ring-fg" cx="80" cy="80" r="75" fill="none" stroke-width="8"
            stroke="var(--text-muted)" stroke-linecap="round"
            stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" />
        </svg>
        <div class="score-text">
          <span class="score-percent" id="score-percent">—</span>
          <span class="score-label">Score</span>
        </div>
      </div>

      <div class="results-stats">
        <div class="stat-card">
          <div class="stat-value" id="stat-correct" style="color:var(--green)">0</div>
          <div class="stat-label">Correct</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-incorrect" style="color:var(--red)">0</div>
          <div class="stat-label">Incorrect</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="stat-pending" style="color:var(--text-muted)">${total}</div>
          <div class="stat-label">Not Yet Marked</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${elapsedMins}m ${elapsedSecs}s</div>
          <div class="stat-label">Time Taken</div>
        </div>
      </div>

      <div class="results-domain-breakdown" id="results-domain-breakdown">
        <h3 style="font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1rem;">Domain Breakdown</h3>
      </div>

      <div class="results-questions">
        <h3>Questions — Click a row to read the full question &amp; answer</h3>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:1rem;">Use ✅ / ❌ to mark how you did. Your score updates live.</p>
        ${questionsHtml}
      </div>

      <div class="results-actions">
        <button class="btn btn-primary" onclick="location.reload()">🔄 New Exam</button>
      </div>
    `;

    // Bind expand/collapse card headers
    resultsScreen.querySelectorAll(".rq-card-header").forEach((header) => {
      header.addEventListener("click", (e) => {
        // Don't expand when clicking assess buttons
        if (e.target.closest(".rq-assess-inline")) return;
        const idx = parseInt(header.dataset.card);
        const body = document.getElementById(`rq-body-${idx}`);
        const icon = document.getElementById(`rq-expand-${idx}`);
        const isOpen = body.style.display !== "none";
        body.style.display = isOpen ? "none" : "block";
        icon.textContent = isOpen ? "▼" : "▲";
      });
    });

    // Bind self-assess buttons
    resultsScreen.querySelectorAll(".assess-btn[data-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        const result = btn.dataset.result;
        const isCorrect = result === "correct";

        questionStates[idx].correct = isCorrect;
        questionStates[idx].answered = true;

        // Update both ✅/❌ button states for this card
        const card = document.getElementById(`rq-card-${idx}`);
        card.querySelectorAll(".assess-btn[data-idx]").forEach((b) => {
          b.classList.remove("selected", "correct", "incorrect");
          if (b.dataset.result === result) {
            b.classList.add("selected", isCorrect ? "correct" : "incorrect");
          }
        });

        // Update status icon
        document.getElementById(`rq-status-${idx}`).textContent = isCorrect ? "✅" : "❌";

        // Update card class
        card.classList.remove("rq-correct", "rq-incorrect");
        card.classList.add(isCorrect ? "rq-correct" : "rq-incorrect");

        updateResultsScore();
      });
    });

    // Initial score update (in case some were already assessed)
    updateResultsScore();
  }

  function updateResultsScore() {
    const total = exam.total_questions;
    const correct = questionStates.filter((s) => s.correct === true).length;
    const incorrect = questionStates.filter((s) => s.correct === false).length;
    const pending = total - correct - incorrect;
    const assessed = correct + incorrect;
    const score = assessed > 0 ? Math.round((correct / total) * 100) : null;
    const passed = score !== null && score >= exam.passing_score_percent;
    const circumference = 2 * Math.PI * 75;

    // Stats
    const statCorrect = document.getElementById("stat-correct");
    const statIncorrect = document.getElementById("stat-incorrect");
    const statPending = document.getElementById("stat-pending");
    const scorePercent = document.getElementById("score-percent");
    const ringFg = document.getElementById("score-ring-fg");
    const resultsIcon = document.getElementById("results-icon");
    const resultsTitle = document.getElementById("results-title");
    const resultsSubtitle = document.getElementById("results-subtitle");

    if (statCorrect) statCorrect.textContent = correct;
    if (statIncorrect) statIncorrect.textContent = incorrect;
    if (statPending) statPending.textContent = pending;

    if (score !== null) {
      const offset = circumference - (score / 100) * circumference;
      const color = passed ? "var(--green)" : "var(--red)";
      if (ringFg) {
        ringFg.setAttribute("stroke", color);
        ringFg.setAttribute("stroke-dashoffset", offset);
      }
      if (scorePercent) {
        scorePercent.textContent = `${score}%`;
        scorePercent.style.color = color;
      }
      if (pending === 0) {
        // All assessed — show final result
        if (resultsIcon) resultsIcon.textContent = passed ? "🎉" : "📝";
        if (resultsTitle) resultsTitle.textContent = passed ? "Congratulations!" : "Keep Practicing!";
        if (resultsSubtitle) resultsSubtitle.textContent = passed
          ? "You passed the practice exam!"
          : `You need ${exam.passing_score_percent}% to pass. Keep going!`;
      }
    } else {
      if (scorePercent) scorePercent.textContent = "—";
    }

    // Domain breakdown
    const domainResults = {};
    exam.questions.forEach((q, i) => {
      const d = q.domain;
      if (!domainResults[d]) domainResults[d] = { correct: 0, total: 0, assessed: 0 };
      domainResults[d].total++;
      if (questionStates[i].correct === true) { domainResults[d].correct++; domainResults[d].assessed++; }
      if (questionStates[i].correct === false) domainResults[d].assessed++;
    });

    const breakdown = document.getElementById("results-domain-breakdown");
    if (breakdown) {
      let html = `<h3 style="font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1rem;">Domain Breakdown</h3>`;
      for (const [domain, info] of Object.entries(domainResults)) {
        const pct = info.assessed > 0 ? Math.round((info.correct / info.total) * 100) : 0;
        const barColor = info.assessed === 0 ? "var(--text-muted)" : pct >= 66 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
        const label = info.assessed === 0 ? `—/${info.total}` : `${info.correct}/${info.total}`;
        html += `
          <div class="domain-row">
            <span class="domain-name">${domain}</span>
            <div class="domain-bar-wrap">
              <div class="domain-bar" style="width: ${pct}%; background: ${barColor};"></div>
            </div>
            <span class="domain-score" style="color: ${barColor}">${label}</span>
          </div>`;
      }
      breakdown.innerHTML = html;
    }
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

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
    html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^&gt;\s+(.+)$/gm, "<blockquote>$1</blockquote>");
    html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
    html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

    html = html.replace(
      /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g,
      (_, header, body) => {
        const ths = header.split("|").filter((c) => c.trim()).map((c) => `<th>${c.trim()}</th>`).join("");
        const rows = body.trim().split("\n").map((row) => {
          const tds = row.split("|").filter((c) => c.trim()).map((c) => `<td>${c.trim()}</td>`).join("");
          return `<tr>${tds}</tr>`;
        }).join("");
        return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
      }
    );

    html = html.split("\n\n").map((block) => {
      block = block.trim();
      if (!block) return "";
      if (block.startsWith("<pre>") || block.startsWith("<ul>") || block.startsWith("<ol>") ||
          block.startsWith("<h") || block.startsWith("<table") || block.startsWith("<blockquote"))
        return block;
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    }).join("\n");

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
