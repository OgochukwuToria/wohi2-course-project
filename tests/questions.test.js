const { resetDb, registerAndLogin, createQuestion, prisma } = require("./helpers");
const request = require("supertest");
const app = require("../src/app");

beforeEach(resetDb);

describe("question tests", () => {

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/questions");
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown question", async () => {
    const token = await registerAndLogin();

    const res = await request(app).get("/api/questions/99999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
  });

  it("returns 200 for an existing question", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token, {
      question: "What is testing?",
      answer: "Writing assertions",
      keywords: ["test"],
    });

    const res = await request(app)
      .get(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.question).toBe("What is testing?");
    expect(res.body.answer).toBe("Writing assertions");
    expect(res.body.keywords).toContain("test");
  });

  it("filters questions by keyword", async () => {
    const token = await registerAndLogin();
    await createQuestion(token, {
      question: "Keyword test?",
      answer: "Yes",
      keywords: ["filter-me"],
    });
    await createQuestion(token, {
      question: "Other question?",
      answer: "No",
      keywords: ["other"],
    });

    const res = await request(app)
      .get("/api/questions?keyword=filter-me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].question).toBe("Keyword test?");
  });

  it("returns 400 for invalid question body", async () => {
    const token = await registerAndLogin();

    const res = await request(app).post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "" });

    expect(res.status).toBe(400);
  });

  it("returns 404 when updating an unknown question", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .put("/api/questions/99999")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "Updated", answer: "Answer" });

    expect(res.status).toBe(404);
  });

  it("returns 400 when updating a question with missing answer", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token, {
      question: "Original?",
      answer: "Original",
    });

    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "Updated question" });

    expect(res.status).toBe(400);
  });

  it("updates a question with valid owner data", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token, {
      question: "Original?",
      answer: "Original",
    });

    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "Updated question",
        answer: "Updated answer",
        keywords: ["updated"],
      });

    expect(res.status).toBe(200);
    expect(res.body.question).toBe("Updated question");
    expect(res.body.keywords).toContain("updated");
  });

  it("updates a question with an image upload", async () => {
    const token = await registerAndLogin();
    const question = await createQuestion(token, {
      question: "Original?",
      answer: "Original",
    });

    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`)
      .field("question", "Updated question")
      .field("answer", "Updated answer")
      .attach(
        "image",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "test.png"
      );

    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toEqual(expect.stringContaining("/uploads/"));
  });

  it("creates a question without keywords", async () => {
    const token = await registerAndLogin();

    const res = await request(app).post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "No keywords", answer: "Answer" });

    expect(res.status).toBe(201);
    expect(res.body.keywords).toEqual([]);
  });

  it("accepts comma-separated keywords string", async () => {
    const token = await registerAndLogin();

    const res = await request(app).post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "What is JS?", answer: "Language", keywords: "js,node" });

    expect(res.status).toBe(201);
    expect(res.body.keywords).toEqual(["js", "node"]);
  });

  it("returns 400 when uploaded file is not an image", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "Question with bad file")
      .field("answer", "Answer")
      .attach("image", Buffer.from("not-an-image"), "test.txt");

    expect(res.status).toBe(400);
    expect(res.body.msg).toBe("Only image files are allowed");
  });

  it("creates a question with a valid image upload", async () => {
    const token = await registerAndLogin();

    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .field("question", "Question with image")
      .field("answer", "Answer")
      .attach("image", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "test.png");

    expect(res.status).toBe(201);
    expect(res.body.imageUrl).toEqual(expect.stringContaining("/uploads/"));
  });

  it("returns 404 when deleting an unknown question", async () => {
    const token = await registerAndLogin();

    const res = await request(app).delete("/api/questions/99999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 403 when deleting someone else's question", async () => {
    const aliceToken = await registerAndLogin("alice@test.io", "Alice");

    const question = await createQuestion(aliceToken, {
      question: "What is Java?",
      answer: "Programming language",
    });

    const bobToken = await registerAndLogin("bob@test.io", "Bob");

    const res = await request(app)
      .delete(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${bobToken}`);

    expect(res.status).toBe(403);
  });

  it("allows the owner to delete their own question", async () => {
    const token = await registerAndLogin("owner@test.io", "Owner");

    const question = await createQuestion(token, {
      question: "Delete me",
      answer: "Yes",
    });

    const res = await request(app)
      .delete(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Question deleted successfully");
  });

  it("returns 403 when editing someone else's question", async () => {
    const aliceToken = await registerAndLogin("alice@test.io", "Alice");

    const question = await createQuestion(aliceToken, {
      question: "What is Java?",
      answer: "Programming language",
    });

    const bobToken = await registerAndLogin("bob@test.io", "Bob");

    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${bobToken}`)
      .send({ question: "Hacked", answer: "Wrong" });

    expect(res.status).toBe(403);

    const after = await prisma.question.findUnique({
      where: { id: question.id },
    });

    expect(after.question).toBe("What is Java?");
  });

});