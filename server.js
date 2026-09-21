/**
 * Resonant Casino API
 * Deploy on Render: set BOT_TOKEN, optional DATABASE later
 *
 * Endpoints:
 *   GET  /health
 *   POST /api/balance
 *   POST /api/bet
 *   POST /api/bet/resolve
 *   POST /api/history
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const DEMO_FALLBACK = process.env.DEMO_FALLBACK !== 'false'; // allow play without valid initData in dev
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({ origin: true }));
app.use(express.json({ limit: '32kb' }));

// ---- In-memory store (replace with Postgres/Redis in production) ----
const users = new Map(); // userId -> { balance, bets, history, createdAt }
const pendingBets = new Map(); // betId -> { userId, game, amount, meta, createdAt }

function getUser(userId) {
  if (!users.has(userId)) {
    users.set(userId, {
      balance: Number(process.env.START_BALANCE || 1000),
      bets: 0,
      turnover: 0,
      won: 0,
      history: [],
      createdAt: Date.now()
    });
  }
  return users.get(userId);
}

// ---- Telegram initData validation ----
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return { ok: false, reason: 'missing' };
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { ok: false, reason: 'no_hash' };
    params.delete('hash');
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (calculated !== hash) return { ok: false, reason: 'bad_hash' };
    // auth_date freshness (24h)
    const authDate = Number(params.get('auth_date') || 0);
    if (authDate && Date.now() / 1000 - authDate > 86400) {
      return { ok: false, reason: 'expired' };
    }
    let user = null;
    try { user = JSON.parse(params.get('user') || 'null'); } catch (_) {}
    return { ok: true, user };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function resolveUser(req) {
  const { initData, userId } = req.body || {};
  const v = validateInitData(initData);
  if (v.ok && v.user?.id) {
    return { ok: true, userId: String(v.user.id), user: v.user };
  }
  if (DEMO_FALLBACK && userId) {
    return { ok: true, userId: String(userId), user: null, demo: true };
  }
  return { ok: false, error: 'unauthorized', reason: v.reason };
}

// ---- Routes ----
app.get('/health', (_, res) => {
  res.json({
    ok: true,
    service: 'resonant-casino-api',
    version: '1.0.0',
    botToken: !!BOT_TOKEN,
    users: users.size,
    pendingBets: pendingBets.size
  });
});

app.post('/api/balance', (req, res) => {
  const auth = resolveUser(req);
  if (!auth.ok) return res.status(401).json(auth);
  const u = getUser(auth.userId);
  res.json({
    ok: true,
    balance: u.balance,
    bets: u.bets,
    turnover: u.turnover,
    won: u.won
  });
});

app.post('/api/bet', (req, res) => {
  const auth = resolveUser(req);
  if (!auth.ok) return res.status(401).json(auth);
  const { game, amount, meta } = req.body || {};
  const amt = Number(amount);
  if (!game || !Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ ok: false, error: 'invalid_bet' });
  }
  const u = getUser(auth.userId);
  if (u.balance < amt) {
    return res.status(400).json({ ok: false, error: 'insufficient' });
  }
  u.balance = round2(u.balance - amt);
  u.bets += 1;
  u.turnover = round2(u.turnover + amt);
  const betId = crypto.randomBytes(8).toString('hex');
  pendingBets.set(betId, {
    userId: auth.userId,
    game: String(game),
    amount: amt,
    meta: meta || {},
    createdAt: Date.now()
  });
  // auto-expire pending after 10 min
  setTimeout(() => pendingBets.delete(betId), 10 * 60 * 1000);
  res.json({ ok: true, betId, balance: u.balance });
});

app.post('/api/bet/resolve', (req, res) => {
  const auth = resolveUser(req);
  if (!auth.ok) return res.status(401).json(auth);
  const { betId, result } = req.body || {};
  const pending = pendingBets.get(betId);
  if (!pending || pending.userId !== auth.userId) {
    return res.status(400).json({ ok: false, error: 'bet_not_found' });
  }
  pendingBets.delete(betId);
  const u = getUser(auth.userId);
  const payout = Number(result?.payout || 0);
  const win = !!result?.win;
  if (win && payout > 0) {
    u.balance = round2(u.balance + payout);
    u.won = round2(u.won + payout);
  }
  u.history.unshift({
    game: pending.game,
    amount: pending.amount,
    win,
    mult: result?.mult ?? null,
    payout: win ? payout : 0,
    ts: Date.now()
  });
  if (u.history.length > 100) u.history.length = 100;
  res.json({ ok: true, balance: u.balance });
});

app.post('/api/history', (req, res) => {
  const auth = resolveUser(req);
  if (!auth.ok) return res.status(401).json(auth);
  const u = getUser(auth.userId);
  res.json({ ok: true, history: u.history.slice(0, 50) });
});

// Admin-ish: reset user (dev only)
app.post('/api/dev/reset', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ ok: false });
  }
  const auth = resolveUser(req);
  if (!auth.ok) return res.status(401).json(auth);
  users.delete(auth.userId);
  res.json({ ok: true, balance: getUser(auth.userId).balance });
});


function requireAdmin(req, res) {
  const auth = resolveUser(req);
  if (!auth.ok) {
    res.status(401).json(auth);
    return null;
  }
  if (ADMIN_IDS.length && !ADMIN_IDS.includes(String(auth.userId))) {
    res.status(403).json({ ok: false, error: 'forbidden' });
    return null;
  }
  // If ADMIN_IDS empty in dev — allow any authenticated user
  if (!ADMIN_IDS.length && process.env.NODE_ENV === 'production') {
    res.status(403).json({ ok: false, error: 'admin_not_configured' });
    return null;
  }
  return auth;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}


// ---- Admin routes ----
app.post('/api/admin/users', (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  const list = [];
  for (const [id, u] of users.entries()) {
    list.push({
      id,
      balance: u.balance,
      bets: u.bets,
      turnover: u.turnover,
      won: u.won,
      createdAt: u.createdAt
    });
  }
  list.sort((a, b) => b.balance - a.balance);
  res.json({ ok: true, users: list.slice(0, 100) });
});

app.post('/api/admin/set-balance', (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  const targetId = String(req.body?.targetId || '');
  const balance = Number(req.body?.balance);
  if (!targetId || !Number.isFinite(balance) || balance < 0) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }
  const u = getUser(targetId);
  u.balance = round2(balance);
  res.json({ ok: true, balance: u.balance, targetId });
});

app.post('/api/admin/reset-user', (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  const targetId = String(req.body?.targetId || '');
  if (!targetId) return res.status(400).json({ ok: false, error: 'invalid' });
  users.delete(targetId);
  const u = getUser(targetId);
  res.json({ ok: true, balance: u.balance, targetId });
});

app.post('/api/admin/stats', (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  let totalBalance = 0, totalBets = 0, totalWon = 0;
  for (const u of users.values()) {
    totalBalance += u.balance;
    totalBets += u.bets;
    totalWon += u.won;
  }
  res.json({
    ok: true,
    users: users.size,
    pendingBets: pendingBets.size,
    totalBalance: round2(totalBalance),
    totalBets,
    totalWon: round2(totalWon)
  });
});


app.listen(PORT, () => {
  console.log(`[Resonant API] http://localhost:${PORT}`);
  console.log(`  BOT_TOKEN: ${BOT_TOKEN ? 'set' : 'NOT SET (validation off / demo fallback)'}`);
  console.log(`  DEMO_FALLBACK: ${DEMO_FALLBACK}`);
});
