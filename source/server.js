const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const tracker = require('./tracker');

const ADMIN_PASSWORD = '777';

const app = express();
const port = process.env.PORT || 3000;

const projectRoot = path.resolve(__dirname);
const publicDir = path.join(__dirname, 'public');

app.disable('etag');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static(publicDir));

function isMarkdownFile(fileName) {
  return fileName.toLowerCase().endsWith('.md');
}

function chapterTitleFromFileName(fileName) {
  return fileName
    .replace(/\.md$/i, '')
    .replace(/^[0-9]+[-_. ]*/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

app.use(express.json());

app.post('/api/track/start', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 64) {
    return res.status(400).json({ error: 'Invalid sessionId.' });
  }
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
  tracker.startVisit(sessionId, ip);
  res.json({ ok: true });
});

app.post('/api/track/end', (req, res) => {
  const { sessionId, duration } = req.body;
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 64) {
    return res.status(400).json({ error: 'Invalid sessionId.' });
  }
  tracker.endVisit(sessionId, duration);
  res.json({ ok: true });
});

app.get('/admin', (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) {
    return res.status(401).send(`<!doctype html>
<html><head><meta charset="UTF-8"><title>Admin</title>
<style>
  body{background:#0d0f12;color:#f5f7fa;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0}
  form{display:flex;flex-direction:column;gap:10px;align-items:center}
  input{background:#12161c;border:1px solid #20262f;color:#f5f7fa;padding:8px 12px;border-radius:8px;font-size:1rem}
  button{background:#6da8ff;color:#0d0f12;border:none;padding:8px 20px;border-radius:8px;font-size:1rem;cursor:pointer}
</style></head><body>
<form method="GET" action="/admin">
  <h2>Admin</h2>
  <input type="password" name="password" placeholder="Password" autofocus />
  <button type="submit">Enter</button>
</form>
</body></html>`);
  }

  const visits = tracker.readVisits();
  const total = visits.length;
  const withDuration = visits.filter((v) => v.duration !== null);
  const avgDuration = withDuration.length
    ? Math.round(withDuration.reduce((s, v) => s + v.duration, 0) / withDuration.length)
    : 0;

  function fmtDuration(sec) {
    if (sec === null) return '—';
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  }

  const rows = [...visits]
    .reverse()
    .map(
      (v) => `<tr>
    <td>${new Date(v.startedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}</td>
    <td>${fmtDuration(v.duration)}</td>
    <td>${v.ip}</td>
  </tr>`
    )
    .join('');

  res.send(`<!doctype html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — Visits</title>
<style>
  *{box-sizing:border-box}
  body{background:#0d0f12;color:#f5f7fa;font-family:sans-serif;padding:24px;margin:0}
  h1{font-size:1.4rem;margin:0 0 6px}
  .stats{color:#aeb6c2;margin-bottom:20px;font-size:0.95rem}
  table{width:100%;border-collapse:collapse;font-size:0.9rem}
  th{text-align:left;color:#aeb6c2;padding:8px 10px;border-bottom:1px solid #20262f}
  td{padding:8px 10px;border-bottom:1px solid #161b22}
  tr:hover td{background:#12161c}
</style></head><body>
<h1>Visits</h1>
<p class="stats">Total: <b>${total}</b> &nbsp;|&nbsp; Avg time: <b>${fmtDuration(avgDuration)}</b></p>
<table>
  <thead><tr><th>Time (MSK)</th><th>Duration</th><th>IP</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="3" style="color:#aeb6c2">No visits yet</td></tr>'}</tbody>
</table>
</body></html>`);
});


  try {
    const entries = await fs.readdir(projectRoot, { withFileTypes: true });

    const chapters = entries
      .filter((entry) => entry.isFile() && isMarkdownFile(entry.name))
      .map((entry) => ({
        fileName: entry.name,
        title: chapterTitleFromFileName(entry.name) || entry.name
      }))
      .sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));

    res.json(chapters);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read chapters.' });
  }
});

app.get('/api/chapter/:fileName', async (req, res) => {
  try {
    const requested = req.params.fileName;
    const fileName = path.basename(requested);

    if (!isMarkdownFile(fileName)) {
      return res.status(400).json({ error: 'Only .md files are allowed.' });
    }

    const chapterPath = path.join(projectRoot, fileName);
    const content = await fs.readFile(chapterPath, 'utf8');

    return res.json({ fileName, content });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Chapter not found.' });
    }

    return res.status(500).json({ error: 'Failed to read chapter.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Web reader running on port ${port}`);
});
