# Web Reader

Minimal mobile-first markdown reader.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## How chapters work

Place all chapter files (`*.md`) in the project root. Example:

- `01-intro.md`
- `02-chapter-two.md`

The app reads them automatically, sorts by filename, and shows them in the burger menu.

## Deploy to Render

This repo already includes `render.yaml`.

1. Push this project to GitHub.
2. Create a new Web Service in Render from this repository.
3. Render will use:
   - Build: `npm install`
   - Start: `npm start`

If Render does not auto-detect config, set Root Directory to project root and use the same build/start commands manually.
