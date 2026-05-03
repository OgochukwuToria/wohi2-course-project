const prisma = require("../lib/prisma");
const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const upload = require("../middleware/upload");
router.use(authenticate);

function formatQuestion(question) {
  return {
    ...question,
   // date: question.date.toISOString().split("T")[0],
    keywords: question.keywords.map((k) => k.name),
    userName: question.user?.name || null,
    likeCount: question._count?.likes ?? 0,
    liked: question.likes ? question.likes.length > 0 : false,
    solved: question.attempts && question.attempts.length > 0,
    user: undefined,
    likes: undefined,
    _count: undefined,

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

  const { keyword } = req.query;

  const where = keyword
    ? { keywords: { some: { name: keyword } } }
    : {};

 const [filteredQuestions, total] = await Promise.all([
    prisma.question.findMany({
        where,
     include: {
  keywords: true,
  user: true,
  likes: {
    where: { userId: req.user.userId },
    take: 1,
  },
  attempts: {
    where: {
      userId: req.user.userId,
      correct: true,
    },
    take: 1,
  },
  _count: {
    select: { likes: true },
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


// GET /questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      keywords: true,
      user: true,
      likes: { where: { userId: req.user.userId }, take: 1 },
      _count: { select: { likes: true } },
  }
  });

  if (!question) {
    return res.status(404).json({ 
		message: "Question not found" 
    });
  }

  res.json(formatQuestion(question));
});


// POST /questions
// Create a new question
router.post("/", upload.single("image"), async (req, res) => {
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const { question, answer, keywords } = req.body;

  // ✅ Correct validation
  if (!question || !answer) {
    return res.status(400).json({
      msg: "question and answer are mandatory",
    });
  }

  const keywordsArray = parseKeywords(keywords);

  const newQuestion = await prisma.question.create({
    data: {
      question,
      answer,
      imageUrl,
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
      likes: {
        where: { userId: req.user.userId },
        take: 1,
      },
      attempts: {
        where: {
          userId: req.user.userId,
          correct: true,
        },
        take: 1,
      },
      _count: {
        select: { likes: true },
      },
    },
  });

  res.status(201).json(formatQuestion(newQuestion));
});


// PUT /questions/:questionId
// Edit a question
router.put("/:questionId", upload.single("image"), isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);
  const { question, answer, keywords } = req.body;

  //  Correct validation
  if (!question || !answer) {
    return res.status(400).json({ msg: "question and answer are mandatory" });
  }

  // Handle keywords (string or array)
  const keywordsArray = parseKeywords(keywords);

  const data = {
    question,
    answer,
    keywords: {
      set: [],
      connectOrCreate: keywordsArray.map((kw) => ({
        where: { name: kw },
        create: { name: kw },
      })),
    },
  };

  //  Handle optional image
  if (req.file) {
    data.imageUrl = `/uploads/${req.file.filename}`;
  }

  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data,
    include: {
      keywords: true,
      user: true,
      likes: {
        where: { userId: req.user.userId },
        take: 1,
      },
      _count: {
        select: { likes: true, attempts: true },
      },
    },
  });

  res.json(formatQuestion(updatedQuestion));
});

// // PUT /questions/:questionId
// // Edit a question
//  router.put("/:questionId", upload.single("image"), isOwner, async (req, res) => {
//   const questionId = Number(req.params.questionId);
//   const { title, date, content, keywords } = req.body;


//   if (!title || !date || !content) {
//     return res.status(400).json({ msg: "title, date and content are mandatory" });
//   }

//   //const keywordsArray = Array.isArray(keywords) ? keywords : [];
//   const keywordsArray = parseKeywords(keywords);
//   const data = {
//   title,
//   date: new Date(date),
//   content,
//   keywords: {
//     set: [],
//     connectOrCreate: keywordsArray.map((kw) => ({
//       where: { name: kw },
//       create: { name: kw },
//     })),
//   },
// };


// if (req.file) {
//   data.imageUrl = `/uploads/${req.file.filename}`;
// }

// const updatedQuestion = await prisma.question.update({
//   where: { id: questionId },
//   data,
//   include: {
//     keywords: true,
//     user: true,
//     likes: {
//       where: { userId: req.user.userId },
//       take: 1,
//     },
//     _count: {
//       select: { likes: true },
//     },
//   },
// });
    
//   res.json(formatQuestion(updatedQuestion));
// });




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


router.post("/:questionId/like", async (req, res) => {
    const questionId = Number(req.params.questionId);

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
        return res.status(404).json({ message: "Question not found" });
    }

    const like = await prisma.like.upsert({
        where: { userId_questionId: { userId: req.user.userId, questionId } },
        update: {},
        create: { userId: req.user.userId, questionId },
    });

    const likeCount = await prisma.like.count({ where: { questionId } });

    res.status(201).json({
        id: like.id,
        questionId,
        liked: true,
        likeCount,
        createdAt: like.createdAt,
    });
});

router.delete("/:questionId/like", async (req, res) => {
    const questionId = Number(req.params.questionId);

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
        return res.status(404).json({ message: "Question not found" });
    }

    await prisma.like.deleteMany({
        where: { userId: req.user.userId, questionId },
    });

    const likeCount = await prisma.like.count({ where: { questionId } });

    res.json({ questionId, liked: false, likeCount });
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
  return res.status(400).json({ message: "Answer is required" });
}

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  const correct =
  question.answer.toLowerCase().trim() === String(answer).toLowerCase().trim();

  // Save attempt
  await prisma.attempt.create({
    data: {
      submittedAnswer: answer,
      correct,
      userId: req.user.userId,
      questionId,
    },
  });

  res.json({
    correct,
    correctAnswer: question.answer,
  });
});
module.exports = router;
