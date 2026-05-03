const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const questionsRouter = require("./routes/questions"); 
const authRouter = require("./routes/auth");
const prisma = require("./lib/prisma");
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static("public"));

// Middleware to parse JSON bodies (will be useful in later steps)
app.use(express.json());

//Routes
app.use("/api/questions", questionsRouter);
app.use("/api/auth", authRouter);
app.use((req, res) => {
  res.status(404).json({ msg: "Not found" });
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
