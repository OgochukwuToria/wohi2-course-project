// Load environment variables from .env for local development
try {
  require("dotenv").config();
} catch (e) {
  // ignore if dotenv isn't available in production
}

const app = require("./app");
const logger = require("./lib/logger");
const prisma = require("./lib/prisma");

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "server listening");
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}
process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);

// const express = require('express');
// const app = express();
// const PORT = process.env.PORT || 3000;
// const questionsRouter = require("./routes/questions"); 
// const authRouter = require("./routes/auth");
// const prisma = require("./lib/prisma");
// const path = require('path');
// const errorHandler = require("./middleware/errorHandler");
// const pinoHttp = require("pino-http");
// const logger = require("./lib/logger");


// app.use(express.static(path.join(__dirname, '..', 'public')));
// app.use(express.static("public"));


// // Middleware to parse JSON bodies (will be useful in later steps)
// app.use(express.json());

// app.use(pinoHttp({logger,autoLogging: { ignore: (req) => req.url.startsWith("/uploads") },
// }));

// //Routes
// app.use("/api/questions", questionsRouter);
// app.use("/api/auth", authRouter);
// app.use((req, res) => {
//   res.status(404).json({ msg: "Not found" });
// });

// app.use(errorHandler);

// // Start the server
// app.listen(PORT, () => {
// const logger = require("./lib/logger");
// logger.info({ port: PORT }, "server listening");
// });

// // Graceful shutdown
// process.on("SIGINT", async () => {
//   await prisma.$disconnect();
//   process.exit(0);
// });

// process.on("SIGTERM", async () => {
//   await prisma.$disconnect();
//   process.exit(0);
// });
