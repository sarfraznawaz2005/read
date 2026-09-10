# Read!

A local-first, read-it-later desktop app for Windows/macOS/Linux, built with Electron, React, and TypeScript. Save articles, read them distraction-free, and follow RSS/Atom feeds — all stored locally in SQLite, no account or cloud sync required.

## Features

### Read-it-later library

- Save any article by URL — full article text is extracted (via Mozilla Readability), sanitized, and stored locally, including code-block syntax highlighting.
- Organize articles into categories, mark read/unread, favorite, archive, or delete.
- Filter the library by All / Unread / Favorites / Archive, or search by title/author/content.
- Right-click any article card for quick actions (mark read, favorite, archive, retry, delete).

### Distraction-free reader

- Adjustable font family, font size, and background theme (Paper White, Sepia, Slate Dark, OLED Black).
- Highlight text in 4 colors and attach notes/comments to highlights.
- Find-in-article search.
- Estimated reading time and a live reading-progress bar.
- External links open in an in-app browser window (with its own back/forward/reload toolbar and an "open in system browser" escape hatch).

### RSS / Atom feeds

- Subscribe to feeds, rename or bulk-delete them, import/export subscriptions via OPML.
- Automatic background scanning on a configurable interval, plus manual "Refresh All".
- Exactly one desktop notification per scan (manual or automatic) summarizing new articles and any feeds that failed, plus one notification per OPML import.
- Feeds that stop responding are flagged in bold red with a warning icon so you can clean them up.
- Unread counts per feed and in total, with unread-first sorting and a "Mark all read" action.
- An "All Entries" combined view across every feed, opened by default with the latest item auto-selected.
- Feed items open as the real, live web page (not just the RSS summary) right inside the app, with its own mini toolbar and right-click menu.
- Save any feed item straight into your read-it-later library.
- Configurable limits: max entries fetched per feed, max age of entries, and a total stored-entries cap (oldest pruned automatically).

### Settings & data

- Light/dark theme, launch at Windows startup, minimize/close to system tray.
- Automatic rolling local backups (keeps the last 5) plus manual backup, and JSON import/export of settings.
- A basic analytics view (reading streaks, time spent, per-category stats).

## Requirements

- [Node.js](https://nodejs.org/) 20+ and npm.
- Windows, macOS, or Linux.

## Installation

```bash
npm install
```

## Running in development

```bash
npm run dev
```

On Windows you can also double-click `run.bat`, or run `run.ps1` in PowerShell.

## Building for production

```bash
npm run build:win    # Windows installer
npm run build:mac    # macOS
npm run build:linux  # Linux (AppImage/snap/deb)
```

On Windows you can also double-click `build.bat`, or run `build.ps1` in PowerShell — the installer is written to the `dist/` folder.

## Other useful scripts

```bash
npm run typecheck  # TypeScript checks (main + renderer)
npm run lint        # ESLint
npm run format      # Prettier
```

## Tech stack

Electron, React 19, TypeScript, Tailwind CSS, Vite (via electron-vite), better-sqlite3-style `node:sqlite`, Mozilla Readability, rss-parser.
