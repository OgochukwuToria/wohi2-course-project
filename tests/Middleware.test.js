const request = require("supertest");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const errorHandler = require("../src/middleware/errorHandler");
const app = require("../src/app");
const { AppError } = require("../src/lib/errors");

test("returns 401 when auth token is missing", async () => {
  const res = await request(app).get("/api/questions");
  expect(res.status).toBe(401);
});

test("returns 403 when auth token is invalid", async () => {
  const res = await request(app)
    .get("/api/questions")
    .set("Authorization", "Bearer invalid.token");

  expect(res.status).toBe(403);
});

test("returns 400 when JSON body is invalid", async () => {
  const res = await request(app)
    .post("/api/auth/register")
    .set("Content-Type", "application/json")
    .send("{ invalid json");

  expect(res.status).toBe(400);
  expect(res.body.message).toBe("Invalid JSON in request body");
});

function makeRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json };
}

test("handles ZodError in errorHandler", () => {
  let err;
  try {
    z.string().parse(123);
  } catch (error) {
    err = error;
  }

  const res = makeRes();
  errorHandler(err, {}, res, () => {});

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Invalid input" })
  );
});

test("handles multer errors in errorHandler", () => {
  const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE");
  const res = makeRes();

  errorHandler(err, {}, res, () => {});

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ message: err.message });
});

test("handles JWT errors in errorHandler", () => {
  const err = new jwt.JsonWebTokenError("jwt malformed");
  const res = makeRes();

  errorHandler(err, {}, res, () => {});

  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
});

test("handles AppError in errorHandler", () => {
  const err = new AppError("Custom message", 418);
  const res = makeRes();

  errorHandler(err, {}, res, () => {});

  expect(res.status).toHaveBeenCalledWith(418);
  expect(res.json).toHaveBeenCalledWith({ message: "Custom message" });
});

test("handles invalid JSON parse errors in errorHandler", () => {
  const err = { type: "entity.parse.failed" };
  const res = makeRes();

  errorHandler(err, {}, res, () => {});

  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith({ message: "Invalid JSON in request body" });
});

test("handles unknown errors as internal server error", () => {
  const err = new Error("boom");
  const res = makeRes();

  errorHandler(err, {}, res, () => {});

  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
});
