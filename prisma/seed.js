// const { PrismaClient } = require("@prisma/client");
// const prisma = new PrismaClient();
// const bcrypt = require("bcrypt");

// const seedQuestions = [
//   {
//     title: "Introduction to HTTP",
//     date: new Date("2026-03-20"),
//     content:
//       "HTTP is the foundation of communication on the web. It defines how clients and servers exchange data.",
//     keywords: ["http", "web"],
//   },
  
//   {
//     title: "Understanding REST APIs",
//     date: new Date("2026-03-22"),
//     content:
//       "REST is an architectural style that uses standard HTTP methods like GET, POST, PUT, and DELETE.",
//     keywords: ["http", "api"],
//   },
//   {
//     title: "Node.js Basics",
//     date: new Date("2026-03-25"),
//     content:
//       "Node.js allows you to run JavaScript on the server using a non-blocking, event-driven architecture.",
//     keywords: ["javascript", "backend"],
//   },
//   {
//     title: "Introduction to Databases",
//     date: new Date("2026-03-26"),
//     content:
//       "Databases store and organize data. Common types include relational databases like PostgreSQL and MySQL.",
//     keywords: ["database", "backend"],
//   },
// ];

// async function main() {
//   const hashedPassword = await bcrypt.hash("1234", 10);
//    // Create a default user
//   const user = await prisma.user.create({
//   data: {
//     email: "admin@example.com",
//     password: hashedPassword,
//     name: "Admin User",
//   },
// });

//   console.log("Created user:", user.email);


//   await prisma.question.deleteMany();
//   await prisma.keyword.deleteMany();

//   for (const question of seedQuestions) {
//     await prisma.question.create({
//       data: {
//         title: question.title,
//         date: question.date,
//         content: question.content,
//         userId: user.id,
//         keywords: {
//           connectOrCreate: question.keywords.map((kw) => ({
//             where: { name: kw },
//             create: { name: kw },
//           })),
//         },
      
//       },
//     });
//   }

//   console.log("Seed data inserted successfully");
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(() => prisma.$disconnect());


const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");

const seedQuestions = [
  {
    question: "What is HTTP?",
    answer: "HTTP is the foundation of communication on the web.",
    keywords: ["http", "web"],
  },
  {
    question: "What is REST?",
    answer: "REST is an architectural style using HTTP methods like GET, POST, PUT, DELETE.",
    keywords: ["http", "api"],
  },
  {
    question: "What is Node.js?",
    answer: "Node.js allows you to run JavaScript on the server.",
    keywords: ["javascript", "backend"],
  },
  {
    question: "What is a database?",
    answer: "A database stores and organizes data.",
    keywords: ["database", "backend"],
  },
];

async function main() {
  const hashedPassword = await bcrypt.hash("1234", 10);

  // Create or reuse default user
  const user = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {}, // do nothing if user exists
    create: {
      email: "admin@example.com",
      password: hashedPassword,
      name: "Admin User",
    },
  });

  console.log("Using user:", user.email);

  // Clean old data
 // await prisma.attempt.deleteMany();
  await prisma.like.deleteMany();
  await prisma.question.deleteMany();
  await prisma.keyword.deleteMany();

  // Insert quiz questions
  for (const q of seedQuestions) {
    await prisma.question.create({
      data: {
        question: q.question,
        answer: q.answer,
        userId: user.id,
        keywords: {
          connectOrCreate: q.keywords.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
    });
  }

  console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());