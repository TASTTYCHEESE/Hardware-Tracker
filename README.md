# Hardware Tracker

App for PC gaming hardware news, prices and specs, focused on GPUs, CPUs and RAM.
Runs on Windows, Mac and Linux, on Android as an app, and on iPhone (or any browser) as a web app.

## Get it

| Device | Get it |
| --- | --- |
| **iPhone / iPad** | Open the web app **[tasttycheese.github.io/Hardware-Tracker](https://tasttycheese.github.io/Hardware-Tracker/)** in Safari, then Share → **Add to Home Screen** |
| **Android** | `HardwareTracker-<version>-android.apk` from the [latest release](https://github.com/TASTTYCHEESE/Hardware-Tracker/releases/latest) (or use the [web app](https://tasttycheese.github.io/Hardware-Tracker/)) |
| **Windows** | `HardwareTracker-Setup-<version>.exe` from the [latest release](https://github.com/TASTTYCHEESE/Hardware-Tracker/releases/latest) |
| **Mac** | `HardwareTracker-<version>-mac-arm64.dmg` (Apple Silicon) or `-mac-x64.dmg` (Intel) from the [latest release](https://github.com/TASTTYCHEESE/Hardware-Tracker/releases/latest) |
| **Linux** | `HardwareTracker-<version>-linux-x86_64.AppImage` or `.deb` from the [latest release](https://github.com/TASTTYCHEESE/Hardware-Tracker/releases/latest) |
| **Any browser** | [tasttycheese.github.io/Hardware-Tracker](https://tasttycheese.github.io/Hardware-Tracker/) |

Setup details for each one are further down.

- **Today**: today's recap (Summary / News / Prices tabs) and headlines, plus **Yesterday** and **Day before**.
- **Overview**: price direction per country, biggest drops, headlines. Top tabs: **Overview / Live news / Archive** (every past day).
- **Prices**: tabs **Prices** (17 countries, any combination, optional single currency) / **Price alerts** / **Tracking** (watchlist with target prices; Windows notification when a target is hit).
- **PC Hardware**: a spec encyclopedia. Pick **Hardware** or **Peripherals**, then a category (GPU chips since 1986, graphics cards, CPUs, motherboards, RAM, SSDs, HDDs, PSUs, coolers, cases, monitors, keyboards, mice, headsets and more), filter by manufacturer, years and category-specific specs, and open any product for its full specifications.
- **In-app reader** for every link (Reader view or full Web page; Ctrl-click opens your browser).
- **Background mode**: tray icon, starts with Windows (hidden), morning summary notification, hourly recap sync. Closing the window unloads it completely (low memory). Auto-closes when the PC is busy (CPU > 85% or memory < 10% free for 3 minutes) while in the background.
- **Auto-updates**: the installer build (made by GitHub Actions, `.github/workflows/release.yml`) updates itself from GitHub Releases.

## Install (Windows)

1. Download `HardwareTracker-Setup-<version>.exe` from the [latest release](https://github.com/TASTTYCHEESE/Hardware-Tracker/releases/latest) and run it (installs for your user, no admin needed). It updates itself from then on.
2. Windows SmartScreen may warn because the app isn't code-signed yet: click **More info → Run anyway**.
3. New daily and weekly recaps download automatically every hour from `recaps/` in this repo. They're stored in `Documents\Hardware Tracker`.

## Install (Mac)

1. Download `HardwareTracker-<version>-mac-arm64.dmg` (Apple Silicon: M1 and newer) or `-mac-x64.dmg` (Intel Macs) from the [latest release](https://github.com/TASTTYCHEESE/Hardware-Tracker/releases/latest), open it and drag the app into Applications.
2. The app isn't signed with a paid Apple certificate, so the first time macOS says it can't check it: open **System Settings → Privacy & Security**, scroll down and click **Open Anyway** (on older macOS: right-click the app → Open).
3. The app tells you when a new version is out (Updates page) and links the download; Mac apps can only update themselves when they're signed.

## Install (Linux)

Download `HardwareTracker-<version>-linux-x86_64.AppImage`, make it executable (`chmod +x`) and run it. The AppImage updates itself. A `.deb` (Debian, Ubuntu, Mint) is in the release too: `sudo apt install ./HardwareTracker-<version>-linux-amd64.deb` (updates by installing the new .deb).

## Android

Download `HardwareTracker-<version>-android.apk` from the latest release on the phone and open it. Android asks once to allow installs from your browser or Files app. New versions show up on the Updates page with a download link; installing the new APK keeps your settings.

## iPhone, iPad and any browser (web app)

Open **[tasttycheese.github.io/Hardware-Tracker](https://tasttycheese.github.io/Hardware-Tracker/)** in Safari, tap **Share → Add to Home Screen**, and it opens like an app. On Android Chrome use **⋮ → Add to Home screen**. It's always the newest version. News comes from a snapshot GitHub refreshes every 20 minutes (browsers can't read news sites directly), and articles open in the browser instead of the in-app reader. Settings, favorites and the news archive are saved in the browser on that device.

## Publishing (maintainer)

- **Releases**: running the "Release app" workflow builds Windows, Mac, Linux and Android and attaches them all to one GitHub Release.
- **Android signing**: the APK is signed with the key in the `ANDROID_SIGNING` repository secret (line 1: password, line 2: the keystore in base64). Keep the same key forever: Android only installs an update over the old app when it's signed with the same key. Without the secret, the release has no APK.
- **Web app**: `.github/workflows/web.yml` publishes to GitHub Pages on every push and every 20 minutes. GitHub Pages must be turned on once: **Settings → Pages → Source: GitHub Actions**.

## Develop

```
npm install
npm run dev            # UI in a browser at http://localhost:5173 (uses the web fallback layer)
npm start              # build and run the desktop app
npm run dist:win-zip   # Windows zip in release/ (any OS)
npm run dist:win       # Windows installer + zip (needs Windows, or Wine)
npm run dist:linux     # Linux AppImage
npm run dist:mac       # Mac .dmg + .zip (needs a Mac)
npm run android        # build the web files and copy them into android/ (then open android/ in Android Studio)
```

## Layout

- `electron/` – desktop shell (window, file access, feed fetching without CORS, notifications).
- `src/` – React UI. Talks to the platform only through `src/lib/platform.ts`; the same UI runs in Electron, in the Android app (`android/`, Capacitor) and as the web app.
- `android/` – Android project (Capacitor). `capacitor.config.json` turns on native HTTP so feeds load without CORS limits.
- `tools/web/snapshot.mjs` – saves the news feeds and exchange rates for the web app.
- `src/data/` – bundled catch-up report.
- `RECAP_FORMAT.md` – the JSON format the scheduled recaps write.

## Roadmap

Code signing (Windows and Mac), phone notifications for price alerts, iOS App Store app (needs an Apple Developer account).

### Planned for 1.0.0: rename to "Hardware Hub"

When 1.0.0 is released, rename the app from "Hardware Tracker" to "Hardware Hub". The owner asked for this to happen even if nobody brings it up at release time. The rename covers:
- the app name and window title
- the installer name and `productName`/`appId`
- the GitHub repo
- the update feed URL, the catalog and recap URLs, and the `Documents\Hardware Tracker` data folder (move existing data over on first start)

## Hardware catalog

`catalog/` is generated by `tools/catalog/build.py` and rebuilt by `.github/workflows/catalog.yml` every Monday and Thursday (and whenever the builder or `catalog-extra/` changes). Sources:

- [dbgpu](https://pypi.org/project/dbgpu/) (MIT): every GPU chip in the TechPowerUp GPU database, 1986 onwards.
- [pc-part-dataset](https://github.com/docyx/pc-part-dataset) (MIT): parts and peripherals listed on PCPartPicker.
- [Wikidata](https://www.wikidata.org/) (CC0): processors with release dates and specs.
- `catalog-extra/<category>.json`: hand-added products (new launches, categories the datasets don't cover).

The app downloads a category the first time it's opened, keeps it in `Documents\Hardware Tracker\catalog` for offline use, and refreshes downloaded categories in the background when a new catalog version appears.

## Releasing

1. Bump `version` in package.json, commit, then `git tag v0.8.0 && git push --tags` (or run the "Release Windows app" workflow by hand).
2. GitHub Actions builds `HardwareTracker-Setup-<version>.exe` and publishes a Release.
3. Installed apps download it in the background and install it when they're closed.

## Recap sync

The recap folder (`recaps/` in the repo) has an `index.json` listing the recap files. In Settings → Recap sync, set the URL to
`https://raw.githubusercontent.com/TASTTYCHEESE/Hardware-Tracker/main/recaps/` (the default). The app checks it every hour.
