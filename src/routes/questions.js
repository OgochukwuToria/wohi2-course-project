const prisma = require("../lib/prisma");
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const upload = require("../middleware/upload");
const multer = require("multer");
const { ValidationError,NotFoundError,ForbiddenError,UnauthorizedError,ConflictError,} = require("../lib/errors");
const { z } = require("zod");


router.use(authenticate);
const QuestionInput = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.union([z.string(),z.array(z.string())]).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

function formatQuestion(question) {
  return {
    ...question,
    keywords: question.keywords.map((k) => k.name),
    userName: question.user?.name || null,
    solved: question.attempts && question.attempts.length > 0,
    difficulty: question.difficulty || null,
    user: undefined,
  };
}

function parseKeywords(keywords) {
  if (Array.isArray(keywords)) return keywords;
  if (typeof keywords === "string") {
    return keywords.split(",").map((k) => k.trim()).filter(Boolean);
  }
  return [];
}



// GET /questions
// List all questions

router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
const skip = (page - 1) * limit;

  const { keyword, difficulty } = req.query;

  const where = {};
  if (keyword) where.keywords = { some: { name: keyword } };
  if (difficulty) where.difficulty = difficulty;

 const [filteredQuestions, total] = await Promise.all([
    prisma.question.findMany({
        where,
     include: {
  keywords: true,
  user: true,
  attempts: {
    where: {
      userId: req.user.userId,
      correct: true,
    },
    take: 1,
  },
},
        orderBy: { id: "asc" },
        skip,
        take: limit,
    }),
    prisma.question.count({ where }),
]);


  res.json({
    data: filteredQuestions.map(formatQuestion),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
});

});


// GET /questions/quiz
// Return 10 random questions
router.get("/quiz", async (req, res) => {
  const allIds = await prisma.question.findMany({ select: { id: true } });

  // Fisher-Yates shuffle
  const arr = allIds.map((q) => q.id);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const selectedIds = arr.slice(0, 10);

  const rows = await prisma.question.findMany({
    where: { id: { in: selectedIds } },
    include: {
      keywords: true,
      user: true,
      attempts: {
        where: { userId: req.user.userId, correct: true },
        take: 1,
      },
    },
  });

  // Restore the shuffled order (findMany returns rows sorted by id)
  const byId = new Map(rows.map((q) => [q.id, q]));
  const questions = selectedIds.map((id) => byId.get(id)).filter(Boolean);

  res.json({ data: questions.map(formatQuestion) });
});


// GET /questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      keywords: true,
      user: true,
  }
  });

  if (!question) {
  req.log.warn({ questionId },"Question not found" );

  throw new NotFoundError("Question not found");
}

  res.json(formatQuestion(question));
});


// POST /questions
// Create a new question
//router.post("/", upload.single("image"), async (req, res) => {

  router.post("/", upload.single("image"), async (req, res) => {
  const data = QuestionInput.parse(req.body); // throws ZodError on failure
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

const { question, answer, keywords, difficulty } = data;

  //Correct validation
 if (!question || !answer) {
  req.log.warn("Question creation failed validation" );

  throw new ValidationError("question and answer are mandatory",);
}

  const keywordsArray = parseKeywords(keywords);

  const newQuestion = await prisma.question.create({
    data: {
      question,
      answer,
      imageUrl,
      difficulty: difficulty || null,
      userId: req.user.userId,
      keywords: {
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: {
      keywords: true,
      user: true,
      attempts: {
        where: {
          userId: req.user.userId,
          correct: true,
        },
        take: 1,
      },
    },
  });

req.log.info({ questionId: newQuestion.id },"Question created");
  res.status(201).json(formatQuestion(newQuestion));
});


router.put("/:questionId", upload.single("image"), async (req, res) => {
  const questionId = Number(req.params.questionId);
  const { question, answer, keywords, difficulty } = req.body;

  const existingQuestion = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!existingQuestion) {
    throw new NotFoundError("Question not found");
  }

  if (existingQuestion.userId !== req.user.userId) {
    throw new ForbiddenError("You can only modify your own questions");
  }

  if (!question || !answer) {
    throw new ValidationError("question and answer are mandatory");
  }

  const keywordsArray = parseKeywords(keywords);

  const data = {
    question,
    answer,
    difficulty: difficulty || null,
    keywords: {
      set: [],
      connectOrCreate: keywordsArray.map((kw) => ({
        where: { name: kw },
        create: { name: kw },
      })),
    },
  };

  if (req.file) {
    data.imageUrl = `/uploads/${req.file.filename}`;
  }

  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data,
    include: {
      keywords: true,
      user: true,
      attempts: {
        where: {
          userId: req.user.userId,
          correct: true,
        },
        take: 1,
      },
    },
  });

  res.json(formatQuestion(updatedQuestion));
});



// DELETE /questions/:questionId
// Delete a question
router.delete("/:questionId", isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true },
  });

  await prisma.question.delete({ where: { id: questionId } });

  res.json({
    message: "Question deleted successfully",
    question: formatQuestion(question),
  });
});


router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError ||
        err?.message === "Only image files are allowed") {
        return res.status(400).json({ msg: err.message });
    }
    next(err);
});


router.post("/:questionId/play", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const { answer } = req.body;

  if (!answer) {
    throw new ValidationError("Answer is required");
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    throw new NotFoundError("Question not found");
  }

  const correct =
    question.answer.toLowerCase().trim() ===
    String(answer).toLowerCase().trim();

  try {
    await prisma.attempt.create({
      data: {
        submittedAnswer: answer,
        correct,
        userId: req.user.userId,
        questionId,
      },
    });
  } catch (err) {
  
  }

  res.json({
    correct,
    correctAnswer: question.answer,
  });
});
//});
module.exports = router;
