const CONFIG = {
  API_URL: "",
  ROUTES: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    POSTS: "/api/questions",
  },
  FIELDS: {
    LOGIN: ["email", "password"],
    REGISTER: ["email", "password", "name"],
    POST: ["title", "date", "content", "keywords"],
  },
  POSTS_PER_PAGE: 5,
  STORAGE_KEY: "jwt_token",
};