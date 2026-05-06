require('dotenv').config();
const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const cors      = require('cors');
const path      = require('path');
const { PrismaClient } = require('@prisma/client');

const app    = express();
const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Auth middleware ──────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Не авторизований' });
  try {
    req.user = jwt.verify(header.replace('Bearer ', ''), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Токен недійсний' });
  }
}

// ── Register ─────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Заповни всі поля' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Пароль мінімум 6 символів' });
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(400).json({ error: 'Email вже зайнятий' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// ── Login ─────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Введи email і пароль' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ error: 'Невірний email або пароль' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Невірний email або пароль' });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// ── Get all progress ─────────────────────────────
app.get('/api/progress', auth, async (req, res) => {
  const rows = await prisma.progress.findMany({ where: { userId: req.user.id } });
  const result = {};
  for (const r of rows) result[r.topicId] = r.data;
  res.json(result);
});

// ── Save progress for topic ───────────────────────
app.put('/api/progress/:topicId', auth, async (req, res) => {
  const { topicId } = req.params;
  const data = req.body;
  await prisma.progress.upsert({
    where:  { userId_topicId: { userId: req.user.id, topicId } },
    update: { data },
    create: { userId: req.user.id, topicId, data },
  });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '::', () => console.log(`Server: http://localhost:${PORT}`));
