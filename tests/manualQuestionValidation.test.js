const request = require("supertest");
const prisma = require("../src/lib/prisma");

const zodResolvePath = require.resolve("zod");
const originalZodModule = require.cache[zodResolvePath];
require.cache[zodResolvePath] = {
  id: zodResolvePath,
  filename: zodResolvePath,
  loaded: true,
  exports: {
    ZodError: class ZodError extends Error {},
    z: {
      string: () => ({ min: () => ({}) }),
      array: () => ({}),
      union: () => ({ optional: () => ({}) }),
      object: () => ({
        parse: () => ({ question: "", answer: "", keywords: [] }),
      }),
    },
  },
};

const app = require("../src/app");

beforeEach(async () => {
  await prisma.attempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(() => {
  if (originalZodModule) {
    require.cache[zodResolvePath] = originalZodModule;
  } else {
    delete require.cache[zodResolvePath];
  }
  vi.resetModules();
});

describe("manual question validation branch", () => {
  it("returns 400 when manual POST question validation branch is triggered", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      email: "mockparse@test.io",
      password: "pw12345",
      name: "Mock Parser",
    });

    const token = registerRes.body.token;

    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({ question: "ignored", answer: "ignored" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("question and answer are mandatory");
  });
});
