const menuButton = document.getElementById('menuButton');
const menu = document.getElementById('menu');
const backdrop = document.getElementById('backdrop');
const chaptersList = document.getElementById('chaptersList');
const reader = document.getElementById('reader');

let chapters = [];

function toggleMenu(forceOpen) {
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !menu.classList.contains('open');

  menu.classList.toggle('open', shouldOpen);
  menu.setAttribute('aria-hidden', String(!shouldOpen));
  menuButton.setAttribute('aria-expanded', String(shouldOpen));
  backdrop.hidden = !shouldOpen;
}

menuButton.addEventListener('click', () => toggleMenu());
backdrop.addEventListener('click', () => toggleMenu(false));

function toSafeHtml(markdown) {
  const rawHtml = marked.parse(markdown || '');
  return DOMPurify.sanitize(rawHtml);
}

function normalizeTitle(chapter, index) {
  const title = chapter.title || chapter.fileName;
  return `${index + 1}. ${title}`;
}

function renderMenu() {
  chaptersList.innerHTML = '';

  chapters.forEach((chapter, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'chapter-link';
    button.textContent = normalizeTitle(chapter, index);

    button.addEventListener('click', () => {
      const section = document.getElementById(`chapter-${index}`);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      toggleMenu(false);
    });

    li.appendChild(button);
    chaptersList.appendChild(li);
  });
}

function renderEmptyState() {
  reader.innerHTML = `
    <section class="chapter empty">
      <div>
        <h1>No markdown files found</h1>
        <p>Add .md chapters to the project root and refresh.</p>
      </div>
    </section>
  `;
}

async function fetchChapter(fileName) {
  const response = await fetch(`/api/chapter/${encodeURIComponent(fileName)}`);
  if (!response.ok) {
    throw new Error(`Failed to load chapter: ${fileName}`);
  }
  return response.json();
}

function markActiveByViewport() {
  const sections = Array.from(reader.querySelectorAll('.chapter[data-index]'));
  if (!sections.length) {
    return;
  }

  const viewportCenter = reader.scrollTop + window.innerHeight * 0.35;
  let activeIndex = 0;

  sections.forEach((section) => {
    if (section.offsetTop <= viewportCenter) {
      activeIndex = Number(section.dataset.index);
    }
  });

  const links = Array.from(chaptersList.querySelectorAll('.chapter-link'));
  links.forEach((link, index) => {
    link.classList.toggle('active', index === activeIndex);
  });
}

async function renderReader() {
  const listRes = await fetch('/api/chapters');

  if (!listRes.ok) {
    throw new Error('Failed to load chapters list.');
  }

  chapters = await listRes.json();

  if (!chapters.length) {
    renderMenu();
    renderEmptyState();
    return;
  }

  renderMenu();

  const chapterPayloads = await Promise.all(chapters.map((chapter) => fetchChapter(chapter.fileName)));

  const sectionsHtml = chapterPayloads
    .map((payload, index) => {
      const html = toSafeHtml(payload.content);
      const chapterName = normalizeTitle(chapters[index], index);
      return `
        <section id="chapter-${index}" class="chapter" data-index="${index}">
          <article>
            <h1>${chapterName}</h1>
            ${html}
          </article>
        </section>
      `;
    })
    .join('');

  reader.innerHTML = sectionsHtml;
  markActiveByViewport();
}

reader.addEventListener('scroll', markActiveByViewport, { passive: true });
window.addEventListener('resize', markActiveByViewport);

renderReader().catch((error) => {
  reader.innerHTML = `
    <section class="chapter empty">
      <div>
        <h1>Unable to load chapters</h1>
        <p>${error.message}</p>
      </div>
    </section>
  `;
});

// --- Visit tracking ---
const sessionId = crypto.randomUUID();
const sessionStart = Date.now();

fetch('/api/track/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId })
});

function sendEndBeacon() {
  const duration = Math.round((Date.now() - sessionStart) / 1000);
  const payload = JSON.stringify({ sessionId, duration });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/track/end', new Blob([payload], { type: 'application/json' }));
  }
}

window.addEventListener('pagehide', sendEndBeacon);
window.addEventListener('beforeunload', sendEndBeacon);

