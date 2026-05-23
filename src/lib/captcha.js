const { randomUUID } = require("crypto");

const captchas = new Map();

function createCaptcha() {
  const id = randomUUID();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYabcdefghijklmnopqrstuvwxz23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  const question = `Enter the code: ${code}`;
  const answer = code;

  captchas.set(id, {
    answer,
    createdAt: Date.now(),
  });

  return { id, question };
}

function verifyCaptcha(id, answer) {
  if (!captchas.has(id)) return false;
  const captcha = captchas.get(id);
  captchas.delete(id);
  return captcha.answer === String(answer).trim();
}

function cleanupExpiredCaptchas() {
  const now = Date.now();
  for (const [id, captcha] of captchas) {
    if (now - captcha.createdAt > 5 * 60 * 1000) {
      captchas.delete(id);
    }
  }
}

setInterval(cleanupExpiredCaptchas, 60 * 1000);

module.exports = {
  createCaptcha,
  verifyCaptcha,
};
