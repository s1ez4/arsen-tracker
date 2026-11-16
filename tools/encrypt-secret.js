// =====================================================================
// ШИФРОВАЛЬЩИК СЕКРЕТНОГО ЛОРА
// Берёт secret-lore.json (он НЕ уходит на GitHub), спрашивает пароль
// и пишет secret.js — его публиковать можно: без пароля это каша.
//
// Запуск из папки arsen-tracker:   node tools/encrypt-secret.js
// =====================================================================
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "secret-lore.json");
const OUT = path.join(ROOT, "secret.js");
const ITERATIONS = 600000;   // сколько раз «перемалываем» пароль — чем больше, тем дольше подбор

// Спрашиваем пароль, вместо символов печатаем звёздочки
function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => rl.output.write(rl.muted && !/^\r?\n$/.test(s) ? "*" : s);
    rl.question(question, answer => { rl.close(); process.stdout.write("\n"); resolve(answer); });
    rl.muted = true;
  });
}

async function main() {
  if (!fs.existsSync(SRC)) throw new Error("Нет файла secret-lore.json рядом с index.html");
  const items = JSON.parse(fs.readFileSync(SRC, "utf8"));
  if (!Array.isArray(items)) throw new Error("secret-lore.json должен быть списком [ {title, text}, ... ]");

  // SECRET_PASS — только для автотеста; обычно пароль вводится руками
  let pass = process.env.SECRET_PASS;
  if (!pass) {
    pass = await askHidden("Придумай пароль (минимум 10 символов): ");
    const again = await askHidden("Повтори пароль: ");
    if (pass !== again) throw new Error("Пароли не совпали, попробуй ещё раз");
  }
  if (pass.length < 10) throw new Error("Слишком короткий пароль — нужно минимум 10 символов");

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(pass, salt, ITERATIONS, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(items), "utf8"), cipher.final(), cipher.getAuthTag()]);

  const payload = { v: 1, iter: ITERATIONS, salt: salt.toString("base64"), iv: iv.toString("base64"), data: data.toString("base64") };
  fs.writeFileSync(OUT, "// Зашифрованный секретный лор (AES-256-GCM). Без пароля не прочитать.\nwindow.SECRET_LORE = " + JSON.stringify(payload) + ";\n");
  console.log("✅ Готово: зашифровано " + items.length + " историй → secret.js");
}

main().catch(e => { console.error("❌ " + e.message); process.exit(1); });
