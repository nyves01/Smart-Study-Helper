const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');
const session  = require('express-session');
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database ────────────────────────────────────
const db = new Database('./users.db');
console.log('Connected to SQLite database.');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT UNIQUE NOT NULL,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS saved_topics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    thumb       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ── Middleware ──────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static('.'));
app.use(session({
  secret: 'ssh-secret-2024-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 86400000 }
}));

// ── Auth guard ──────────────────────────────────
function requireAuth(req, res, next) {
  req.session.userId ? next() : res.status(401).json({ error: 'Authentication required' });
}

// ── Register ────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (username.length < 3)
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email format' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)')
                   .run(username, email, hash);
    req.session.userId   = info.lastInsertRowid;
    req.session.username = username;
    res.json({ message: 'Registration successful', user: { id: info.lastInsertRowid, username, email } });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed'))
      return res.status(409).json({ error: 'Username or email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Login ───────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?')
                   .get(username, username);
    if (!user)
      return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId   = user.id;
    req.session.username = user.username;
    res.json({ message: 'Login successful', user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Logout ──────────────────────────────────────
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err =>
    err ? res.status(500).json({ error: 'Could not log out' })
        : res.json({ message: 'Logout successful' })
  );
});

// ── Current user ────────────────────────────────
app.get('/api/auth/me', (req, res) => {
  req.session.userId
    ? res.json({ user: { id: req.session.userId, username: req.session.username } })
    : res.status(401).json({ error: 'Not authenticated' });
});

// ── Saved topics ────────────────────────────────
app.get('/api/saved-topics', requireAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM saved_topics WHERE user_id = ? ORDER BY created_at DESC')
                   .all(req.session.userId);
    res.json(rows);
  } catch { res.status(500).json({ error: 'Database error' }); }
});

app.post('/api/saved-topics', requireAuth, (req, res) => {
  const { title, description, thumb } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  try {
    const info = db.prepare('INSERT INTO saved_topics (user_id, title, description, thumb) VALUES (?, ?, ?, ?)')
                   .run(req.session.userId, title, description || null, thumb || null);
    res.json({ id: info.lastInsertRowid, message: 'Topic saved successfully' });
  } catch { res.status(500).json({ error: 'Database error' }); }
});

app.delete('/api/saved-topics/:id', requireAuth, (req, res) => {
  try {
    const info = db.prepare('DELETE FROM saved_topics WHERE id = ? AND user_id = ?')
                   .run(req.params.id, req.session.userId);
    info.changes === 0
      ? res.status(404).json({ error: 'Topic not found' })
      : res.json({ message: 'Topic deleted successfully' });
  } catch { res.status(500).json({ error: 'Database error' }); }
});

// ── Wikipedia proxy ─────────────────────────────
app.get('/api/topic/:topic', async (req, res) => {
  try {
    const key     = encodeURIComponent(req.params.topic.trim().replace(/ /g, '_'));
    const headers = { Accept: 'application/json' };

    const [sumResult, relResult] = await Promise.allSettled([
      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${key}`, { headers }),
      fetch(`https://en.wikipedia.org/api/rest_v1/page/related/${key}`,  { headers }),
    ]);

    if (sumResult.status === 'rejected' || !sumResult.value.ok)
      return res.status(sumResult.value?.status === 404 ? 404 : 500)
               .json({ error: 'Topic not found' });

    const summary = await sumResult.value.json();
    if (summary.type === 'disambiguation')
      return res.status(400).json({ error: 'Disambiguation page' });

    let related = [];
    if (relResult.status === 'fulfilled' && relResult.value.ok) {
      try { related = (await relResult.value.json()).pages ?? []; } catch {}
    }

    res.json({ summary, related });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── Dictionary proxy ────────────────────────────
app.get('/api/definition/:word', async (req, res) => {
  try {
    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(req.params.word.toLowerCase())}`);
    r.ok ? res.json(await r.json()) : res.status(404).json({ error: 'Definition not found' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── Start ───────────────────────────────────────
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
