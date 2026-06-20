const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const VISITS_FILE = path.join(DATA_DIR, 'visits.json');

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(VISITS_FILE)) fs.writeFileSync(VISITS_FILE, '[]', 'utf8');
}

function readVisits() {
  ensureStorage();
  try {
    return JSON.parse(fs.readFileSync(VISITS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeVisits(visits) {
  ensureStorage();
  fs.writeFileSync(VISITS_FILE, JSON.stringify(visits, null, 2), 'utf8');
}

function startVisit(sessionId, ip) {
  const visits = readVisits();
  visits.push({ sessionId, ip, startedAt: new Date().toISOString(), duration: null });
  writeVisits(visits);
}

function endVisit(sessionId, duration) {
  const visits = readVisits();
  const visit = visits.findLast((v) => v.sessionId === sessionId && v.duration === null);
  if (visit) {
    visit.duration = typeof duration === 'number' && duration >= 0 ? Math.round(duration) : null;
    writeVisits(visits);
  }
}

module.exports = { readVisits, startVisit, endVisit };
