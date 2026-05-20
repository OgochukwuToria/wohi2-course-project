// ===================== TOKEN =====================
function saveToken(token) {
  localStorage.setItem(CONFIG.STORAGE_KEY, token);
}

function getToken() {
  return localStorage.getItem(CONFIG.STORAGE_KEY);
}

function logout() {
  localStorage.removeItem(CONFIG.STORAGE_KEY);
  showLogin();
}

// ===================== LOGIN =====================
function showLogin() {
  const auth = document.getElementById("auth");

  auth.innerHTML = `
    <h2>Login</h2>
    <input id="email" placeholder="Email"><br>
    <input id="password" type="password" placeholder="Password"><br>
    <button onclick="login()">Login</button>
    <button onclick="showRegister()">Register</button>
  `;
}

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch(CONFIG.ROUTES.LOGIN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (res.ok && data.token) {
    saveToken(data.token);
    loadQuestions();
  } else {
    alert(data.error || "Login failed");
  }
}

// ===================== REGISTER =====================
function showRegister() {
  const auth = document.getElementById("auth");

  auth.innerHTML = `
    <h2>Register</h2>
    <input id="email" placeholder="Email"><br>
    <input id="password" type="password" placeholder="Password"><br>
    <input id="name" placeholder="Name"><br>
    <button onclick="register()">Register</button>
    <button onclick="showLogin()">Back to Login</button>
  `;
}

async function register() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const name = document.getElementById("name").value;

  const res = await fetch(CONFIG.ROUTES.REGISTER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });

  const data = await res.json();

  if (res.ok) {
    alert("Registered successfully. Please login.");
    showLogin();
  } else {
    alert(data.error || "Registration failed");
  }
}

// ===================== LOAD QUESTIONS =====================
async function loadQuestions() {
  const res = await fetch(CONFIG.ROUTES.POSTS, {
    headers: {
      Authorization: "Bearer " + getToken(),
    },
  });

  const result = await res.json();
  const questions = result.data || [];

  const app = document.getElementById("app");

  let html = `
    <h2>Questions</h2>
    <button onclick="logout()">Logout</button>
    <hr>
  `;

  questions.forEach(q => {
    html += `
      <div style="border:1px solid #ccc; padding:10px; margin:10px;">
        <h3>${q.title}</h3>
        <p>${q.content}</p>
        <small>Date: ${q.date}</small><br>
        <small>By: ${q.userName}</small><br>
        <small>Likes: ${q.likeCount}</small><br>
        <small>Keywords: ${q.keywords.join(", ")}</small>
      </div>
    `;
  });

  app.innerHTML = html;
}


showLogin();