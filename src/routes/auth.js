const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { createCaptcha, verifyCaptcha } = require("../lib/captcha");
const { ValidationError, ConflictError, UnauthorizedError }
  = require("../lib/errors");

const SECRET = process.env.JWT_SECRET;

async function createUser({ email, password, name }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError("Email already registered");

  const hashedPassword = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { email, password: hashedPassword, name },
  });
}

// Here we will add all routes related to authentication

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
     throw new ValidationError("email, password and name are required");
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError("Email already registered");

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create the user
 let user;

try {
  user = await prisma.user.create({
    data: { email, password: hashedPassword, name },
  });
} catch (err) {
  if (err.code === "P2002") {
   throw new ConflictError({error: "Email already registered",});
  }
  return res.status(500).json({ error: "Something went wrong" });
}

  // Generate a token
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "1h" });

  res.status(201).json({
    message: "User registered successfully",
    token,
  });
});



// GET /api/auth/captcha
router.get("/captcha", (req, res) => {
  const captcha = createCaptcha();
  res.json(captcha);
});

// POST /api/auth/register-captcha
router.post("/register-captcha", async (req, res) => {
  const { email, password, name, captchaId, captchaAnswer } = req.body;

  if (!email || !password || !name)
    throw new ValidationError("email, password and name are required");

  if (!captchaId || !captchaAnswer)
    throw new ValidationError("captcha is required");

  if (!verifyCaptcha(captchaId, captchaAnswer))
    throw new ValidationError("incorrect captcha answer");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError("Email already registered");

  const hashedPassword = await bcrypt.hash(password, 10);

  let user;
  try {
    user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });
  } catch (err) {
    if (err.code === "P2002") throw new ConflictError("Email already registered");
    return res.status(500).json({ error: "Something went wrong" });
  }

  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "1h" });
  res.status(201).json({ message: "User registered successfully", token });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    throw new ValidationError("email and password are required");

  // Find the user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new UnauthorizedError("Invalid credentials");

  // Verify the password
   const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new UnauthorizedError("Invalid credentials");

  // Generate a token
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "1h" });

  res.json({ token });
});


module.exports = router; 