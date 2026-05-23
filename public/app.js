// --- State ---
let isRegisterMode = false;
let quizQuestions = [];
let currentIndex = 0;
let correctCount = 0;
let currentCaptcha = null;

// --- Helpers ---
function getCurrentUserId() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.userId;
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem(CONFIG.STORAGE_KEY);
}

function setToken(token) {
  localStorage.setItem(CONFIG.STORAGE_KEY, token);
}

function removeToken() {
  localStorage.removeItem(CONFIG.STORAGE_KEY);
}

async function apiFetch(route, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = { ...options.headers };
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${CONFIG.API_URL}${route}`, { ...options, headers });

  // Try to parse JSON if returned, otherwise fall back to text
  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
  } else {
    try {
      const text = await res.text();
      data = text ? { text } : null;
    } catch (e) {
      data = null;
    }
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message || data.msg || data.text)) || res.statusText || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

async function loadCaptcha() {
  try {
    const data = await apiFetch(CONFIG.ROUTES.CAPTCHA, { method: "GET" });
    currentCaptcha = data;
    // Extract prompt and code if question follows '...: CODE' pattern
    let prompt = data.question;
    let code = null;
    const m = data.question && data.question.match(/^(.*):\s*([A-Za-z0-9]+)\s*$/);
    if (m) {
      prompt = m[1].trim();
      code = m[2].trim();
    }
    const promptEl = document.getElementById("captcha-prompt");
    const codeEl = document.getElementById("captcha-code");
    if (promptEl) promptEl.textContent = prompt;
    if (codeEl) codeEl.textContent = code || "";
  } catch (err) {
    const promptEl = document.getElementById("captcha-prompt");
    const codeEl = document.getElementById("captcha-code");
    if (promptEl) promptEl.textContent = "Captcha unavailable. Refresh the page.";
    if (codeEl) codeEl.textContent = "";
  }
}

// --- Auth ---
function showAuth() {
  document.getElementById("auth-section").style.display = "block";
  document.getElementById("app-section").style.display = "none";
  document.getElementById("logout-btn").style.display = "none";
  renderAuthForm();
}

function renderAuthForm() {
  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const title = isRegisterMode ? "Sign Up" : "Log In";
  const switchText = isRegisterMode
    ? 'Already have an account? <a href="#" id="switch-mode">Log in</a>'
    : 'Don\'t have an account? <a href="#" id="switch-mode">Sign up</a>';

  const captchaHtml = isRegisterMode
    ? `
      <div id="captcha-wrapper" class="form-group">
        <label for="captcha-answer">Verify you are human</label>
        <div id="captcha-prompt" class="captcha-prompt" style="margin:0.25rem 0;color:var(--muted,#ddd);">Loading captcha...</div>
        <div id="captcha-code" class="captcha-code" style="display:inline-block;padding:0.5rem 0.75rem;margin:0.25rem 0;border-radius:8px;background:#333333;color:#fff;font-weight:800;letter-spacing:2px;border:1px solid rgba(0,0,0,0.12);box-shadow:0 6px 18px rgba(0,0,0,0.2)">???</div>
        <input type="text" id="captcha-answer" name="captchaAnswer" autocomplete="off" required />
      </div>`
    : "";

  const formHTML = `
    <h2>${title}</h2>
    <form id="auth-form">
      ${fields
        .map((f) => {
          const type = f === "password" ? "password" : f === "email" ? "email" : "text";
          const label = f.charAt(0).toUpperCase() + f.slice(1);
          return `
          <div class="form-group">
            <label for="${f}">${label}</label>
            <input type="${type}" id="${f}" name="${f}" required />
          </div>`;
        })
        .join("")}
      ${captchaHtml}
      <button type="submit">${title}</button>
    </form>
    <p class="switch-text">${switchText}</p>
    <p id="auth-error" class="error"></p>
  `;

  document.getElementById("auth-section").innerHTML = formHTML;
  document.getElementById("auth-form").addEventListener("submit", handleAuth);
  document.getElementById("switch-mode").addEventListener("click", (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    currentCaptcha = null;
    renderAuthForm();
  });

  if (isRegisterMode) {
    loadCaptcha();
  }
}

async function handleAuth(e) {
  e.preventDefault();
  const errorEl = document.getElementById("auth-error");
  errorEl.textContent = "";

  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const route = isRegisterMode ? CONFIG.ROUTES.REGISTER_CAPTCHA : CONFIG.ROUTES.LOGIN;

  const body = {};
  fields.forEach((f) => {
    body[f] = document.getElementById(f).value;
  });

  if (isRegisterMode) {
    if (!currentCaptcha) {
      errorEl.textContent = "Captcha is still loading. Please wait.";
      return;
    }
    body.captchaId = currentCaptcha.id;
    body.captchaAnswer = document.getElementById("captcha-answer").value;
  }

  try {
    const data = await apiFetch(route, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setToken(data.token);
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
    if (isRegisterMode) {
      loadCaptcha();
    }
  }
}

// --- App ---
async function showApp() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("app-section").style.display = "block";
  document.getElementById("logout-btn").style.display = "inline-block";
  await loadQuestions();
}

async function loadQuestions(keyword = "", page = 1, difficulty = "") {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading questions...</p>';

  try {
    const params = new URLSearchParams({ page, limit: CONFIG.QUESTIONS_PER_PAGE });
    if (keyword) params.set("keyword", keyword);
    if (difficulty) params.set("difficulty", difficulty);
    const result = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}?${params}`);
    const { data: questions, total, totalPages } = result;
    const currentUserId = getCurrentUserId();

    const solvedCount = questions.filter((q) => q[CONFIG.API_FIELDS.SOLVED]).length;

    let html = `
      <div class="score-bar">
        <div class="score-item">
          <div class="score-value">${total}</div>
          <div class="score-label">Questions</div>
        </div>
        <div class="score-item">
          <div class="score-value">${solvedCount}/${questions.length}</div>
          <div class="score-label">Solved (this page)</div>
        </div>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" id="new-question-btn">+ New Question</button>
        <button class="btn btn-primary" id="start-quiz-btn">Start Quiz</button>
        <button class="btn btn-primary" id="generate-quiz-btn">Generate New Quiz</button>
        <button class="btn btn-leaderboard" id="leaderboard-btn">Leaderboard</button>
        <div class="search-bar">
          <input type="text" id="keyword-input" placeholder="Search by keyword..." value="${keyword}" />
          <button class="btn btn-search" id="search-btn">Search</button>
          <select id="difficulty-filter">
            <option value="" ${!difficulty ? "selected" : ""}>All levels</option>
            <option value="easy" ${difficulty === "easy" ? "selected" : ""}>Easy</option>
            <option value="medium" ${difficulty === "medium" ? "selected" : ""}>Medium</option>
            <option value="hard" ${difficulty === "hard" ? "selected" : ""}>Hard</option>
          </select>
          ${keyword || difficulty ? `<button class="btn btn-clear" id="clear-btn">Clear</button>` : ""}
        </div>
      </div>`;

    if (questions.length === 0) {
      html += '<p class="empty-state">No questions found. Create one to get started!</p>';
    } else {
      html += questions
        .map(
          (q) => `
        <article class="question-card ${q[CONFIG.API_FIELDS.SOLVED] ? "solved-card" : ""}">
          <h3>
            <a href="#" class="question-link" data-id="${q.id}">${q.question}</a>
            ${q[CONFIG.API_FIELDS.SOLVED] ? `<span class="badge-solved">Solved</span>` : ""}
            ${q.difficulty ? `<span class="badge-difficulty badge-${q.difficulty}">${q.difficulty}</span>` : ""}
          </h3>
          ${
            q.keywords && q.keywords.length
              ? `<div class="question-keywords">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
              : ""
          }
          <div class="question-actions">
            <span>
              <button class="btn btn-play" data-id="${q.id}">Play</button>
              <a href="#" class="read-more" data-id="${q.id}">See answer</a>
            </span>
            ${
              q.userId === currentUserId
                ? `<span class="owner-actions">
                    <button class="btn btn-edit" data-id="${q.id}">Edit</button>
                    <button class="btn btn-delete" data-id="${q.id}">Delete</button>
                  </span>`
                : ""
            }
          </div>
        </article>`
        )
        .join("");
    }

    if (totalPages > 1) {
      html += `
        <div class="pagination">
          <button class="btn btn-page" id="prev-btn" ${page <= 1 ? "disabled" : ""}>Previous</button>
          <span class="page-info">Page ${page} of ${totalPages}</span>
          <button class="btn btn-page" id="next-btn" ${page >= totalPages ? "disabled" : ""}>Next</button>
        </div>`;
    }

    container.innerHTML = html;

    document.getElementById("new-question-btn").addEventListener("click", () => showQuestionForm());
    document.getElementById("start-quiz-btn").addEventListener("click", () => {
  startQuiz(questions);
});
    document.getElementById("generate-quiz-btn").addEventListener("click", loadRandomQuiz);
    document.getElementById("leaderboard-btn").addEventListener("click", showLeaderboard);

    document.getElementById("search-btn").addEventListener("click", () => {
      const kw = document.getElementById("keyword-input").value.trim();
      const diff = document.getElementById("difficulty-filter").value;
      loadQuestions(kw, 1, diff);
    });

    document.getElementById("keyword-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const diff = document.getElementById("difficulty-filter").value;
        loadQuestions(e.target.value.trim(), 1, diff);
      }
    });

    document.getElementById("difficulty-filter").addEventListener("change", () => {
      const kw = document.getElementById("keyword-input").value.trim();
      const diff = document.getElementById("difficulty-filter").value;
      loadQuestions(kw, 1, diff);
    });

    const clearBtn = document.getElementById("clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", () => loadQuestions());

    const prevBtn = document.getElementById("prev-btn");
    if (prevBtn) prevBtn.addEventListener("click", () => loadQuestions(keyword, page - 1, difficulty));

    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) nextBtn.addEventListener("click", () => loadQuestions(keyword, page + 1, difficulty));

    container.querySelectorAll(".question-link, .read-more").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        loadQuestionDetail(el.dataset.id);
      });
    });

    container.querySelectorAll(".btn-edit").forEach((el) => {
      el.addEventListener("click", () => showQuestionForm(el.dataset.id));
    });

    container.querySelectorAll(".btn-delete").forEach((el) => {
      el.addEventListener("click", () => deleteQuestion(el.dataset.id));
    });

   /* container.querySelectorAll(".btn-like").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const id = btn.dataset.id;
    const isLiked = btn.dataset.liked === "true";

    try {
      if (isLiked) {
        await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${id}/like`, {
          method: "DELETE",
        });
      } else {
        await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${id}/like`, {
          method: "POST",
        });
      }

      loadQuestions(); 
    } catch (err) {
      alert(err.message);
    }
  });
}); */

    container.querySelectorAll(".btn-play").forEach((el) => {
      el.addEventListener("click", () => playQuestion(el.dataset.id));
    });
  } catch (err) {
    if (err.message === "No token provided" || err.message === "Invalid or expired token") {
      removeToken();
      showAuth();
      return;
    }
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function loadRandomQuiz() {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading random quiz...</p>';

  try {
    const result = await apiFetch(CONFIG.ROUTES.QUIZ);
    const questions = result.data;

    if (questions.length === 0) {
      container.innerHTML = '<p class="empty-state">No questions available for quiz.</p>';
      return;
    }

    container.innerHTML = `
      <div class="question-form-wrapper" style="text-align:center">
        <h2>Questions</h2>
        <ol style="text-align:left;margin-bottom:1.5rem;padding-left:1.5rem">
          ${questions.map((q) => `<li style="margin-bottom:1rem">${q.question}</li>`).join("")}
        </ol>
        <button class="btn btn-primary" id="begin-quiz-btn">Begin Quiz</button>
        <button class="btn" id="cancel-quiz-btn" style="margin-left:1rem">Cancel</button>
      </div>`;

    document.getElementById("begin-quiz-btn").addEventListener("click", () => startQuiz(questions));
    document.getElementById("cancel-quiz-btn").addEventListener("click", () => loadQuestions());
  } catch (err) {
    if (err.message === "No token provided" || err.message === "Invalid or expired token") {
      removeToken();
      showAuth();
      return;
    }
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function loadQuestionDetail(qId) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
    const currentUserId = getCurrentUserId();
    const isOwner = q.userId === currentUserId;

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
      <article class="question-card question-detail">
        <h3>${q.question} ${q[CONFIG.API_FIELDS.SOLVED] ? `<span class="badge-solved">Solved</span>` : ""}</h3>
        <p class="question-meta">by ${q.userName || "Unknown"}</p>
        ${q.imageUrl ? `<img class="question-image" src="${q.imageUrl}" alt="">` : ""}
        <p class="question-answer">${q.answer}</p>
        ${
          q.keywords && q.keywords.length
            ? `<div class="question-keywords">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
            : ""
        }
        ${
          isOwner
            ? `<div class="question-actions detail-actions">
                <button class="btn btn-edit" id="detail-edit-btn">Edit</button>
                <button class="btn btn-delete" id="detail-delete-btn">Delete</button>
              </div>`
            : ""
        }
      </article>`;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadQuestions();
    });

    if (isOwner) {
      document.getElementById("detail-edit-btn").addEventListener("click", () => showQuestionForm(qId));
      document.getElementById("detail-delete-btn").addEventListener("click", () => deleteQuestion(qId));
    }
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

// --- Create / Edit ---
async function showQuestionForm(qId) {
  const container = document.getElementById("questions-container");
  const isEdit = !!qId;
  let q = { question: "", answer: "", keywords: [] };

  if (isEdit) {
    try {
      q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
    } catch (err) {
      container.innerHTML = `<p class="error">${err.message}</p>`;
      return;
    }
  }

  container.innerHTML = `
    <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
    <div class="question-form-wrapper">
      <h2>${isEdit ? "Edit Question" : "New Question"}</h2>
      <form id="question-form" enctype="multipart/form-data">
        <div class="form-group">
          <label for="q-question">Question</label>
          <input type="text" id="q-question" value="${q.question}" required />
        </div>
        <div class="form-group">
          <label for="q-answer">Answer</label>
          <textarea id="q-answer" rows="4" required>${q.answer}</textarea>
        </div>
        <div class="form-group">
          <label for="q-keywords">Keywords (comma-separated)</label>
          <input type="text" id="q-keywords" value="${q.keywords ? q.keywords.join(", ") : ""}" />
        </div>
        <div class="form-group">
          <label for="q-difficulty">Difficulty</label>
          <select id="q-difficulty">
            <option value="" ${!q.difficulty ? "selected" : ""}>None</option>
            <option value="easy" ${q.difficulty === "easy" ? "selected" : ""}>Easy</option>
            <option value="medium" ${q.difficulty === "medium" ? "selected" : ""}>Medium</option>
            <option value="hard" ${q.difficulty === "hard" ? "selected" : ""}>Hard</option>
          </select>
        </div>
        <div class="form-group">
          <label for="q-image">Image ${isEdit ? "(leave blank to keep current)" : "(optional)"}</label>
          <input type="file" id="q-image" accept="image/*" />
          ${isEdit && q.imageUrl ? `<img src="${q.imageUrl}" alt="" style="max-width:200px;margin-top:0.5rem;border-radius:4px" />` : ""}
        </div>
        <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Create Question"}</button>
      </form>
      <p id="question-form-error" class="error"></p>
    </div>`;

  document.getElementById("back-btn").addEventListener("click", (e) => {
    e.preventDefault();
    loadQuestions();
  });

  document.getElementById("question-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("question-form-error");
    errorEl.textContent = "";

    const body = new FormData();
    body.append("question", document.getElementById("q-question").value);
    body.append("answer", document.getElementById("q-answer").value);
    body.append("keywords", document.getElementById("q-keywords").value);
    const diff = document.getElementById("q-difficulty").value;
    if (diff) body.append("difficulty", diff);
    const imageFile = document.getElementById("q-image").files[0];
    if (imageFile) body.append("image", imageFile);

    try {
      if (isEdit) {
        await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, { method: "PUT", body });
      } else {
        await apiFetch(CONFIG.ROUTES.QUESTIONS, { method: "POST", body });
      }
      loadQuestions();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

// --- Play ---
async function playQuestion(qId) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
      <div class="question-form-wrapper" style="text-align:center">
        <div class="play-question-text">${q.question}</div>
        ${q.imageUrl ? `<img class="question-image" src="${q.imageUrl}" alt="" style="margin:0 auto 1rem">` : ""}
        ${
          q.keywords && q.keywords.length
            ? `<div class="question-keywords" style="justify-content:center;margin-bottom:1.5rem">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
            : ""
        }
        <form id="play-form" style="text-align:left">
          <div class="form-group">
            <label for="play-answer">Your answer</label>
            <textarea id="play-answer" rows="3" required></textarea>
          </div>
          <div style="text-align:center">
            <button type="submit" class="btn btn-play" style="padding:0.7rem 2.5rem;font-size:1rem">Submit</button>
          </div>
        </form>
        <div id="play-result"></div>
        <p id="play-error" class="error"></p>
      </div>`;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadQuestions();
    });

    document.getElementById("play-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("play-error");
      const resultEl = document.getElementById("play-result");
      errorEl.textContent = "";
      resultEl.innerHTML = "";

      const answer = document.getElementById("play-answer").value;

      try {
        const result = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}/play`, {
          method: "POST",
          body: JSON.stringify({ answer }),
        });

        // if (result.correct) {
        //   resultEl.innerHTML = `<div class="play-result correct">Correct!</div>`;
        // } else {
        //   resultEl.innerHTML = `
        //     <div class="play-result incorrect">
        //       Incorrect! The answer was: <strong>${result.correctAnswer}</strong>
        //     </div>`;
        // }

        if (result.correct) {
  correctCount++;

  resultEl.innerHTML = `
    <div class="play-result correct"> Correct!</div>
    <button id="next-btn" class="btn btn-primary">Next</button>
  `;
} else {
  resultEl.innerHTML = `
    <div class="play-result incorrect">
       Incorrect! The answer was: <strong>${result.correctAnswer}</strong>
    </div>
    <button id="next-btn" class="btn btn-primary">Next</button>
  `;
}

const nextBtn = document.getElementById("next-btn");

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    currentIndex++;

    if (currentIndex < quizQuestions.length) {
      playQuestion(quizQuestions[currentIndex].id);
    } else {
      showFinalScore();
    }
  });
}
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

// --- Leaderboard ---
async function showLeaderboard() {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading leaderboard...</p>';

  try {
    const data = await apiFetch(CONFIG.ROUTES.LEADERBOARD);

    const medalColors = ["#ffd200", "#c0c0c0", "#cd7f32"];
    const medalLabels = ["1st", "2nd", "3rd"];

    const rows = data.map((entry) => {
      const isMedal = entry.rank <= 3;
      const color = isMedal ? medalColors[entry.rank - 1] : "rgba(255,255,255,0.4)";
      const label = isMedal ? medalLabels[entry.rank - 1] : `${entry.rank}th`;
      return `
        <div class="lb-row ${entry.rank === 1 ? "lb-first" : ""}">
          <div class="lb-rank" style="color:${color}">${label}</div>
          <div class="lb-name">${entry.name}</div>
          <div class="lb-score" style="color:${color}">${entry.correctAttempts} <span class="lb-score-label">correct</span></div>
        </div>`;
    }).join("");

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
      <div class="leaderboard-wrapper">
        <div class="lb-header">
          <div class="lb-title">Leaderboard</div>
          <div class="lb-subtitle">Top players by correct answers</div>
        </div>
        ${data.length === 0
          ? `<p class="empty-state">No attempts yet. Be the first!</p>`
          : `<div class="lb-list">${rows}</div>`}
      </div>`;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadQuestions();
    });
  } catch (err) {
    if (err.message === "No token provided" || err.message === "Invalid or expired token") {
      removeToken();
      showAuth();
      return;
    }
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

// --- Delete ---
async function deleteQuestion(qId) {
  if (!confirm("Are you sure you want to delete this question?")) return;

  try {
    await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, { method: "DELETE" });
    loadQuestions();
  } catch (err) {
    alert(err.message);
  }
}

function showFinalScore() {
  const container = document.getElementById("questions-container");
  const percentage = Math.round((correctCount / quizQuestions.length) * 100);

  container.innerHTML = `
    <div class="question-form-wrapper" style="text-align:center">
      <h2>Quiz Completed!</h2>
      <div style="font-size:1.5rem;margin:1.5rem 0">
        <strong>${correctCount} out of ${quizQuestions.length}</strong> correct
      </div>
      <div style="font-size:1.2rem;color:var(--muted);margin-bottom:1.5rem">
        Score: ${percentage}%
      </div>
      <button class="btn btn-primary" id="back-to-questions-btn">Back to Questions</button>
    </div>`;

  document.getElementById("back-to-questions-btn").addEventListener("click", () => {
    loadQuestions();
  });
}

function handleLogout() {
  removeToken();
  showAuth();
}
function startQuiz(questions) {
  quizQuestions = questions;
  currentIndex = 0;
  correctCount = 0;

  playQuestion(quizQuestions[currentIndex].id);
}
// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
  if (getToken()) {
    showApp();
  } else {
    showAuth();
  }
});
