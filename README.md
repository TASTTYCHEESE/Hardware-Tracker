# Hardware Tracker

Desktop app (Windows first) for PC gaming hardware news and prices, focused on
GPUs, CPUs and RAM.

- **Today**: today's recap (Summary / News / Prices tabs) and headlines, plus **Yesterday** and **Day before**.
- **Overview**: price direction per country, biggest drops, headlines. Top tabs: **Overview / Live news / Archive** (every past day).
- **Prices**: tabs **Prices** (17 countries, any combination, optional single currency) / **Price alerts** / **Tracking** (watchlist with target prices; Windows notification when a target is hit).
- **In-app reader** for every link (Reader view or full Web page; Ctrl-click opens your browser).
- **Background mode**: tray icon, starts with Windows (hidden), morning summary notification, hourly recap sync. Closing the window unloads it completely (low memory). Auto-closes when the PC is busy (CPU > 85% or memory < 10% free for 3 minutes) while in the background.
- **Auto-updates**: the installer build (made by GitHub Actions, `.github/workflows/release.yml`) updates itself from GitHub Releases.

## Install (Windows)

1. Download `HardwareTracker-Setup-<version>.exe` from the [latest release](https://github.com/TASTTYCHEESE/Hardware-Tracker/releases/latest) and run it (installs for your user, no admin needed). It updates itself from then on.
2. Windows SmartScreen may warn because the app isn't code-signed yet: click **More info → Run anyway**.
3. New daily and weekly recaps download automatically every hour from `recaps/` in this repo. They're stored in `Documents\Hardware Tracker`.

## Develop

```
npm install
npm run dev            # UI in a browser at http://localhost:5173 (uses the web fallback layer)
npm start              # build and run the desktop app
npm run dist:win-zip   # Windows zip in release/ (any OS)
npm run dist:win       # Windows installer + zip (needs Windows, or Wine)
```

## Layout

- `electron/` – desktop shell (window, file access, feed fetching without CORS, notifications).
- `src/` – React UI. Talks to the platform only through `src/lib/platform.ts`, so the same UI can later be wrapped for phone (Capacitor) and served as a website.
- `src/data/` – bundled catch-up report.
- `RECAP_FORMAT.md` – the JSON format the scheduled recaps write.

## Roadmap

Phone app (Capacitor, same UI), browser version, GitHub repo + auto-sync of recaps (so recaps reach every device without copying files), code signing / installer.

## Releasing (once the GitHub repo exists)

1. Bump `version` in package.json, commit, then `git tag v0.7.0 && git push --tags`.
2. GitHub Actions builds `HardwareTracker-Setup-<version>.exe` and publishes a Release.
3. Installed apps download it in the background and install it when they're closed.

## Recap sync

The recap folder (`recaps/` in the repo) has an `index.json` listing the recap files. In Settings → Recap sync, set the URL to
`https://raw.githubusercontent.com/TASTTYCHEESE/Hardware-Tracker/main/recaps/` (the default). The app checks it every hour.
