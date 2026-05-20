const bcrypt = require("bcrypt")
const { resetDb, request, app, prisma } = require("./helpers");

beforeEach(resetDb);

it("registers, hashes the password, returns a token", async () => {
  const res = await request(app).post("/api/auth/register")
    .send({ email: "a@test.io", password: "pw12345", name: "A" });

  expect(res.status).toBe(201);
  expect(res.body.token).toEqual(expect.any(String));

  const user = await prisma.user.findUnique({ where: { email: "a@test.io" } });
  expect(user.password).not.toBe("pw12345");                          // not plain
  expect(await bcrypt.compare("pw12345", user.password)).toBe(true);  // valid hash
});

it("returns 400 when register fields are missing", async () => {
  const res = await request(app).post("/api/auth/register").send({ email: "a@test.io" });
  expect(res.status).toBe(400);
});

it("returns 409 when registering with an existing email", async () => {
  await request(app).post("/api/auth/register").send({
    email: "a@test.io",
    password: "pw12345",
    name: "A",
  });

  const res = await request(app).post("/api/auth/register").send({
    email: "a@test.io",
    password: "pw12345",
    name: "A",
  });

  expect(res.status).toBe(409);
});

it("returns 409 when prisma create throws P2002", async () => {
  const spy = vi
    .spyOn(prisma.user, "create")
    .mockRejectedValueOnce(Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    }));

  const res = await request(app).post("/api/auth/register").send({
    email: "p2002@test.io",
    password: "pw12345",
    name: "P2002",
  });

  expect(res.status).toBe(409);

  spy.mockRestore();
});

it("returns 500 when prisma create throws unexpected error", async () => {
  const spy = vi
    .spyOn(prisma.user, "create")
    .mockRejectedValueOnce(new Error("boom"));

  const res = await request(app).post("/api/auth/register").send({
    email: "error@test.io",
    password: "pw12345",
    name: "Error",
  });

  expect(res.status).toBe(500);
  expect(res.body.error).toBe("Something went wrong");

  spy.mockRestore();
});

it("returns 400 when login fields are missing", async () => {
  const res = await request(app).post("/api/auth/login").send({});
  expect(res.status).toBe(400);
});

it("returns 401 when login credentials are invalid", async () => {
  await request(app).post("/api/auth/register").send({
    email: "a@test.io",
    password: "pw12345",
    name: "A",
  });

  const res = await request(app).post("/api/auth/login").send({
    email: "a@test.io",
    password: "wrong-password",
  });

  expect(res.status).toBe(401);
});

it("returns 401 when login email is not registered", async () => {
  const res = await request(app).post("/api/auth/login").send({
    email: "missing@test.io",
    password: "pw12345",
  });

  expect(res.status).toBe(401);
});

it("returns 200 and a token when login succeeds", async () => {
  await request(app).post("/api/auth/register").send({
    email: "loginok@test.io",
    password: "pw12345",
    name: "Login Ok",
  });

  const res = await request(app).post("/api/auth/login").send({
    email: "loginok@test.io",
    password: "pw12345",
  });

  expect(res.status).toBe(200);
  expect(res.body.token).toEqual(expect.any(String));
});
