const { resetDb, registerAndLogin, createQuestion } = require("./helpers");
const request = require("supertest");
const app = require("../src/app");

beforeEach(resetDb);

describe("attempt tests", () => {

  it("returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/questions/1/play")
      .send({ answer: "test" });

    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown question", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .post("/api/questions/99999/play")
      .set("Authorization", `Bearer ${token}`)
      .send({ answer: "test" });

    expect(res.status).toBe(404);
  });

  it("returns 400 for missing answer", async () => {
    const token = await registerAndLogin();

    const question = await createQuestion(token, {
      question: "Capital of Finland?",
      answer: "Helsinki",
    });

    const res = await request(app)
      .post(`/api/questions/${question.id}/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns correct = true for correct answer", async () => {
    const token = await registerAndLogin();

    const question = await createQuestion(token, {
      question: "Capital of Finland?",
      answer: "Helsinki",
    });

    const res = await request(app)
      .post(`/api/questions/${question.id}/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({ answer: "Helsinki" });

    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(true);
  });

  it("returns correct = false for wrong answer", async () => {
    const token = await registerAndLogin();

    const question = await createQuestion(token, {
      question: "What does HTML stand for?",
      answer: "HyperText Markup Language",
    });

    const res = await request(app)
      .post(`/api/questions/${question.id}/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({ answer: "5" });

      console.log(res.error.text)
    expect(res.status).toBe(200);
    expect(res.body.correct).toBe(false);
  });

});