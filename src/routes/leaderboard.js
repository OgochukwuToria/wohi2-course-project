const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");

router.use(authenticate);

router.get("/", async (req, res) => {
  const results = await prisma.attempt.groupBy({
    by: ["userId"],
    where: { correct: true },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  const userIds = results.map((r) => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const leaderboard = results.map((r, i) => ({
    rank: i + 1,
    name: userMap.get(r.userId) || "Unknown",
    correctAttempts: r._count.id,
  }));

  res.json(leaderboard);
});

module.exports = router;
