const prisma = require('../config/database');

let bot = null;

function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[TelegramBot] No TELEGRAM_BOT_TOKEN set, bot disabled');
    return null;
  }

  try {
    const TelegramBot = require('node-telegram-bot-api');
    bot = new TelegramBot(token, { polling: true });
    console.log('[TelegramBot] Bot started');

    // /start — link account
    bot.onText(/\/start (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = match[1];
      try {
        await prisma.telegramLink.upsert({
          where: { userId },
          update: { chatId: String(chatId), username: msg.from.username },
          create: { userId, chatId: String(chatId), username: msg.from.username },
        });
        bot.sendMessage(chatId, 'Account linked! You will receive notifications.');
      } catch (err) {
        bot.sendMessage(chatId, 'Error linking account. Check your user ID.');
      }
    });

    bot.onText(/\/start$/, (msg) => {
      bot.sendMessage(msg.chat.id,
        'MetricsAiUp Bot\n\n' +
        'Commands:\n' +
        '/status - STO overview\n' +
        '/post N - Post info (e.g. /post 3)\n' +
        '/free - Free posts\n' +
        '/report - Quick report\n\n' +
        'To link account, use the link from your profile page.'
      );
    });

    // /status
    bot.onText(/\/status/, async (msg) => {
      try {
        const posts = await prisma.post.findMany({ where: { isActive: true } });
        const free = posts.filter(p => p.status === 'free').length;
        const occupied = posts.filter(p => p.status !== 'free').length;
        const active = posts.filter(p => p.status === 'active_work').length;
        const recs = await prisma.recommendation.count({ where: { status: 'active' } });

        bot.sendMessage(msg.chat.id,
          `STO Status:\n` +
          `Posts: ${posts.length} total, ${free} free, ${occupied} occupied\n` +
          `Active work: ${active}\n` +
          `Active recommendations: ${recs}`
        );
      } catch {
        bot.sendMessage(msg.chat.id, 'Error fetching status');
      }
    });

    // /post N
    bot.onText(/\/post (\d+)/, async (msg, match) => {
      const num = parseInt(match[1], 10);
      try {
        const post = await prisma.post.findFirst({
          where: { name: { contains: String(num) }, isActive: true },
          include: { stays: { where: { endTime: null }, include: { vehicleSession: true }, take: 1 } },
        });
        if (!post) return bot.sendMessage(msg.chat.id, `Post ${num} not found`);

        const vehicle = post.stays[0]?.vehicleSession;
        bot.sendMessage(msg.chat.id,
          `Post ${num}:\n` +
          `Status: ${post.status}\n` +
          (vehicle ? `Vehicle: ${vehicle.plateNumber || 'unknown'}\n` : 'No vehicle\n')
        );
      } catch {
        bot.sendMessage(msg.chat.id, 'Error fetching post');
      }
    });

    // /free
    bot.onText(/\/free/, async (msg) => {
      try {
        const free = await prisma.post.findMany({ where: { isActive: true, status: 'free' } });
        if (free.length === 0) return bot.sendMessage(msg.chat.id, 'No free posts');
        bot.sendMessage(msg.chat.id, `Free posts (${free.length}):\n` + free.map(p => `- ${p.name}`).join('\n'));
      } catch {
        bot.sendMessage(msg.chat.id, 'Error fetching free posts');
      }
    });

    // /report
    bot.onText(/\/report/, async (msg) => {
      try {
        const sessions = await prisma.vehicleSession.count({ where: { status: 'active' } });
        const completed = await prisma.vehicleSession.count({
          where: { status: 'completed', exitTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        });
        const recs = await prisma.recommendation.findMany({
          where: { status: 'active' },
          take: 5,
          orderBy: { createdAt: 'desc' },
        });

        let text = `Daily Report:\n` +
          `Active sessions: ${sessions}\n` +
          `Completed today: ${completed}\n`;
        if (recs.length > 0) {
          text += `\nRecent recommendations:\n`;
          recs.forEach(r => { text += `- [${r.type}] ${r.message}\n`; });
        }
        bot.sendMessage(msg.chat.id, text);
      } catch {
        bot.sendMessage(msg.chat.id, 'Error generating report');
      }
    });

    return bot;
  } catch (err) {
    console.error('[TelegramBot] Failed to start:', err.message);
    return null;
  }
}

// Send notification to linked user
async function sendTelegramNotification(userId, message) {
  if (!bot) return;
  try {
    const link = await prisma.telegramLink.findUnique({ where: { userId } });
    if (link) {
      await bot.sendMessage(link.chatId, message);
    }
  } catch (err) {
    console.error('[TelegramBot] Send error:', err.message);
  }
}

// Broadcast to all linked users
async function broadcastTelegram(message) {
  if (!bot) return;
  try {
    const links = await prisma.telegramLink.findMany();
    for (const link of links) {
      try { await bot.sendMessage(link.chatId, message); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

// Send document to specific chat
async function sendTelegramDocument(chatId, buffer, filename, caption) {
  if (!bot) return;
  await bot.sendDocument(chatId, buffer, { caption }, { filename, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Broadcast document to all linked users
async function broadcastDocument(buffer, filename, caption) {
  if (!bot) return;
  const links = await prisma.telegramLink.findMany();
  for (const link of links) {
    try { await sendTelegramDocument(link.chatId, buffer, filename, caption); } catch {}
  }
}

module.exports = { initTelegramBot, sendTelegramNotification, broadcastTelegram, sendTelegramDocument, broadcastDocument };
