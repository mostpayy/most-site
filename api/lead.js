// api/lead.js
//
// Разверните этот файл в проекте на Vercel по пути /api/lead.js — Vercel
// автоматически превратит его в endpoint https://ваш-домен/api/lead
//
// Что нужно настроить в Vercel (Project Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN   — токен от @BotFather
//   TELEGRAM_CHAT_ID     — chat_id, куда слать уведомления
//   SHEETS_WEBHOOK_URL   — URL вашего Google Apps Script Web App (см. google-apps-script.js)
//
// Ничего из этого не должно попадать в код лендинга или в git — только
// в переменные окружения на Vercel.

export default async function handler(req, res) {
  // Разрешаем запросы только с вашего домена (замените на настоящий после подключения)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { name, contact, city, business, type } = req.body || {};

  // Простая валидация — не даём пустым/мусорным заявкам уйти дальше
  if (!name || !contact || !city || !business || !type) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  const timestamp = new Date().toISOString();

  const message =
    `🆕 Новая заявка с сайта MOST\n\n` +
    `Имя: ${name}\n` +
    `Контакт: ${contact}\n` +
    `Город: ${city}\n` +
    `Бизнес: ${business}\n` +
    `Тип: ${type}`;

  const tasks = [];

  // 1) Уведомление в Telegram
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      })
    );
  }

  // 2) Строка в Google-таблицу (постоянная база заявок)
  const sheetsUrl = process.env.SHEETS_WEBHOOK_URL;
  if (sheetsUrl) {
    tasks.push(
      fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp, name, contact, city, business, type }),
      })
    );
  }

  try {
    await Promise.all(tasks);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Lead forwarding failed:', err);
    // Заявку всё равно не теряем молча — возвращаем ошибку, чтобы фронтенд это показал
    return res.status(502).json({ ok: false, error: 'Forwarding failed' });
  }
}
