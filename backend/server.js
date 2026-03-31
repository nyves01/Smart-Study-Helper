const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database setup ──────────────────────────────
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initDatabase();
  }
});

function initDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS saved_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    thumb TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
}

// ── Middleware ──────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

// Session configuration
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// ── Authentication middleware ───────────────────
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// ── Authentication routes ──────────────────────

// Register new user
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Validation
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }

        req.session.userId = this.lastID;
        req.session.username = username;
        res.json({ message: 'Registration successful', user: { id: this.lastID, username, email } });
      });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get(`SELECT * FROM users WHERE username = ? OR email = ?`, [username, username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ message: 'Login successful', user: { id: user.id, username: user.username, email: user.email } });
  });
});

// Logout user
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Get current user
app.get('/api/auth/me', (req, res) => {
  if (req.session.userId) {
    res.json({
      user: {
        id: req.session.userId,
        username: req.session.username
      }
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// ── Saved topics routes (protected) ────────────

// Get user's saved topics
app.get('/api/saved-topics', requireAuth, (req, res) => {
  db.all(`SELECT * FROM saved_topics WHERE user_id = ? ORDER BY created_at DESC`,
    [req.session.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
});

// Save a topic for user
app.post('/api/saved-topics', requireAuth, (req, res) => {
  const { title, description, thumb } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  db.run(`INSERT INTO saved_topics (user_id, title, description, thumb) VALUES (?, ?, ?, ?)`,
    [req.session.userId, title, description || null, thumb || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ id: this.lastID, message: 'Topic saved successfully' });
    });
});

// Delete a saved topic
app.delete('/api/saved-topics/:id', requireAuth, (req, res) => {
  const topicId = req.params.id;

  db.run(`DELETE FROM saved_topics WHERE id = ? AND user_id = ?`,
    [topicId, req.session.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Topic not found' });
      }
      res.json({ message: 'Topic deleted successfully' });
    });
});

// Wikipedia API proxy
app.get('/api/topic/:topic', async (req, res) => {
  try {
    const topic = req.params.topic;
    const key = encodeURIComponent(topic.trim().replace(/ /g, '_'));
    const headers = { Accept: 'application/json' };

    const [sumResult, relResult] = await Promise.allSettled([
      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${key}`, { headers }),
      fetch(`https://en.wikipedia.org/api/rest_v1/page/related/${key}`, { headers }),
    ]);

    // Handle summary
    if (sumResult.status === 'rejected') {
      return res.status(500).json({ error: 'Network error' });
    }
    if (!sumResult.value.ok) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const summary = await sumResult.value.json();
    if (summary.type === 'disambiguation') {
      return res.status(400).json({ error: 'Disambiguation page' });
    }

    // Handle related pages
    let related = [];
    if (relResult.status === 'fulfilled' && relResult.value.ok) {
      try {
        const relData = await relResult.value.json();
        related = relData.pages ?? [];
      } catch (e) {
        // Silently ignore related pages error
      }
    }

    res.json({ summary, related });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Dictionary API proxy
app.get('/api/definition/:word', async (req, res) => {
  try {
    const word = req.params.word;
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);

    if (!response.ok) {
      return res.status(404).json({ error: 'Definition not found' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});