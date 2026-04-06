const express = require("express");
const router = express.Router();

const questions = require("../data/questions");

// GET /questions
// List all questions
router.get("/", (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.json(questions);
  }

  const filteredQuestions = questions.filter(question =>
    question.keywords.includes(keyword.toLowerCase())
  );

  res.json(filteredQuestions);
});

// GET /questions/:questionId
// Show a specific question
router.get("/:questionId", (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = questions.find(q => q.id === questionId);

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(question);
});

// POST /questions
// Create a new question
router.post("/", (req, res) => {
  const { title, date, content, keywords } = req.body;

  if (!title || !date || !content) {
    return res.status(400).json({
      message: "title, date, and content are required"
    });
  }

  const maxId = Math.max(...questions.map(q => q.id), 0);

  const newQuestion = {
    id: questions.length ? maxId + 1 : 1,
    title,
    date,
    content,
    keywords: Array.isArray(keywords) ? keywords : []
  };

  questions.push(newQuestion);
  res.status(201).json(newQuestion);
});

// PUT /questions/:questionId
// Edit a question
router.put("/:questionId", (req, res) => {
  const questionId = Number(req.params.questionId);
  const { title, date, content, keywords } = req.body;

  const question = questions.find(q => q.id === questionId);

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  if (!title || !date || !content) {
    return res.json({
      message: "title, date, and content are required"
    });
  }

  question.title = title;
  question.date = date;
  question.content = content;
  question.keywords = Array.isArray(keywords) ? keywords : [];

  res.json(question);
});

// DELETE /questions/:questionId
// Delete a question
router.delete("/:questionId", (req, res) => {
  const questionId = Number(req.params.questionId);

  const questionIndex = questions.findIndex(q => q.id === questionId);

  if (questionIndex === -1) {
    return res.status(404).json({ message: "Question not found" });
  }

  const deletedQuestion = questions.splice(questionIndex, 1);

  res.json({
    message: "Question deleted successfully",
    question: deletedQuestion[0]
  });
});

module.exports = router;
