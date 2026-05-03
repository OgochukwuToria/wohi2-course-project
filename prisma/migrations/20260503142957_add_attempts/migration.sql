/*
  Warnings:

  - You are about to drop the column `content` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `questions` table. All the data in the column will be lost.
  - Added the required column `answer` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question` to the `questions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `questions` DROP COLUMN `content`,
    DROP COLUMN `date`,
    DROP COLUMN `title`,
    ADD COLUMN `answer` TEXT NOT NULL,
    ADD COLUMN `question` TEXT NOT NULL;

-- CreateTable
CREATE TABLE `Attempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `submittedAnswer` VARCHAR(191) NOT NULL,
    `correct` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
