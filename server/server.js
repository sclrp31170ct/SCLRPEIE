const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve(__dirname);
const FILES = {
  news: 'news.json',
  links: 'links.json',
  reports: 'reports.json',
  achievements: 'achievements.json',
  students: 'students.json',
  songs: 'songs.json',
  lostFound: 'lost_found.json',
  chat: 'chat.json'
};

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const PUBLIC_DIR = path.resolve(__dirname, '../client');
app.use(express.static(PUBLIC_DIR));

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFilePath(key) {
  return path.join(DATA_DIR, FILES[key]);
}

function safeRead(key, fallback) {
  const filePath = getFilePath(key);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

function safeWrite(key, data) {
  const filePath = getFilePath(key);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

ensureDataDir();

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

app.get('/api/:resource', (req, res) => {
  const resource = req.params.resource;
  if (!FILES[resource]) {
    return res.status(404).json({ error: 'Resource not found' });
  }
  const fallback = [];
  const result = safeRead(resource, fallback);
  res.json(result);
});

app.post('/api/:resource', (req, res) => {
  const resource = req.params.resource;
  if (!FILES[resource]) {
    return res.status(404).json({ error: 'Resource not found' });
  }

  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const updated = Array.isArray(payload) ? payload : payload.data || payload;

  if (!Array.isArray(updated)) {
    return res.status(400).json({ error: 'Payload must be an array' });
  }

  if (safeWrite(resource, updated)) {
    return res.json({ status: 'ok', items: updated.length });
  }

  res.status(500).json({ error: 'Failed to save resource' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Student Council backend listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
