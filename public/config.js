const CONFIG = {
  API_URL: "",
  ROUTES: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    REGISTER_CAPTCHA: "/api/auth/register-captcha",
    CAPTCHA: "/api/auth/captcha",
    QUESTIONS: "/api/questions",
    QUIZ: "/api/questions/quiz",
    LEADERBOARD: "/api/leaderboard",
  },
  FIELDS: {
    LOGIN: ["email", "password"],
    REGISTER: ["email", "password", "name"],
    QUESTION: ["question", "answer", "keywords"],
  },
  QUESTIONS_PER_PAGE: 5,
  STORAGE_KEY: "jwt_token",
  API_FIELDS: {
    SOLVED: "solved",
  },
};
