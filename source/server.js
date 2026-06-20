const express = require('express');
const fs = require('fs/promises');
const path = require('path');

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

app.get('/api/chapters', async (req, res) => {
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

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Web reader running on port ${port}`);
});
