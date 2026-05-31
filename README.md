<div align="center">

<img src="branding/nyro-banner.png" alt="Nyro" width="880" />

[![Release](https://img.shields.io/github/v/release/mariusberget92/nyro?style=flat-square&color=3d7fff)](https://github.com/mariusberget92/nyro/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-3d7fff?style=flat-square)](https://github.com/mariusberget92/nyro/releases)
[![License](https://img.shields.io/github/license/mariusberget92/nyro?style=flat-square&color=3fb98a)](LICENSE)

</div>

---

## ✨ Features

### 🎵 Download anything
- **YouTube**, YouTube Music, **SoundCloud**, **Bandcamp**, **Vimeo**
- Output as **MP3** (64–448 kbps, you pick) or **MP4** (4K / 1080p / 720p / 480p)
- Titles, artists and album art parsed automatically — **cover art embedded** in ID3 tags and saved as `cover.jpg` per folder
- Numbered filename prefixes with configurable templates (`{000} - `, `EP{00} - `, etc.)
- **Duplicate detection** — tracks that already exist at the expected output path are skipped automatically

### 📋 Smart queue
- Paste a single URL or an entire **playlist** — Nyro expands it automatically
- Playlists saved into their own named folder; albums into `Albums/Name (Year)/`
- Retry failed downloads, open the source URL, or get a plain-English explanation of what went wrong
- Queue state persists across restarts

### 🎙️ Podcast browser
- Powered by the **Taddy GraphQL API** — search, browse episodes, add to queue in one click
- Podcast episodes organised into `Podcasts / Show Name /` with cover art embedded
- Responses cached for 6 hours to stretch the free-tier request limit

### 📚 Media library
- Scans your output folder on demand, reads **ID3 tags**, extracts and caches cover art
- Browse by **Albums** (grouped by name, Various Artists for mixed), **Artists**, **Podcasts**, flat **Tracks**, or **Videos**
- Create custom **Playlists**, set manual covers, drag to reorder
- Scan results persisted to disk — library available instantly on next launch

### 🎧 Mini player + audio engine
- Built-in player with **shuffle**, **repeat**, **repeat-one**, playback speed control
- Scrub bar with click-to-seek
- **Synced lyrics** fetched from [lrclib.net](https://lrclib.net), saved as `.lrc` sidecars, displayed karaoke-style
- **10-band graphic EQ** with preamp and frequency response curve
- **4-band multiband compressor** with per-band threshold, ratio, attack, release and makeup gain
- **FX chain:** bass boost, treble enhance, stereo widener (M/S), reverb, crossfeed, limiter
- **Play history** page

### 🔐 Cookie authentication
- **Method A (recommended):** import a `cookies.txt` file exported from your browser — works while Chrome is open
- **Method B:** read cookies directly from a live browser profile (Chrome must be fully closed)

### 🔄 Auto-updating yt-dlp
- Checks the GitHub releases API at startup and silently updates the `yt-dlp` binary if a newer version is available

---

## 📸 Screenshots

<table>
  <tr>
    <td><img src="docs/screenshot-queue.png" alt="Queue — item downloaded" /></td>
    <td><img src="docs/screenshot-downloading.png" alt="Queue — actively downloading" /></td>
  </tr>
  <tr>
    <td align="center"><em>Queue — completed item</em></td>
    <td align="center"><em>Queue — download in progress</em></td>
  </tr>
  <tr>
    <td><img src="docs/screenshot-podcasts.png" alt="Podcast episode browser" /></td>
    <td><img src="docs/screenshot-edit.png" alt="Edit track metadata" /></td>
  </tr>
  <tr>
    <td align="center"><em>Podcast episode browser</em></td>
    <td align="center"><em>Edit track metadata before download</em></td>
  </tr>
</table>

---

## 🚀 Installation

### Download a pre-built release *(recommended)*

Head to the [**Releases**](https://github.com/mariusberget92/nyro/releases) page and grab the file for your OS:

| Platform | File | Notes |
|----------|------|-------|
| 🪟 Windows | `Nyro-Setup-x.x.x.exe` | Standard installer |
| 🪟 Windows | `Nyro-x.x.x-portable.exe` | No install needed |
| 🍎 macOS | `Nyro-x.x.x.dmg` | Drag to Applications |

> **macOS first-launch note:** Because the app isn't yet notarised with an Apple Developer certificate, macOS will block it on first open. Right-click (or Ctrl-click) the app → **Open** → **Open** again to allow it. You only need to do this once.

---

## 🛠️ Building from source

**Prerequisites:** Node.js 20+, npm

```bash
# Clone the repo
git clone https://github.com/mariusberget92/nyro.git
cd nyro

# Install dependencies
npm install

# Start in development mode
npm run dev

# Build a release for your current OS
npm run build
```

Installer output lands in `dist/`.

### 📦 Required binaries

Nyro shells out to **yt-dlp** and **FFmpeg**. Place the binaries in the `resources/` folder before building:

```
resources/
├── yt-dlp          # or yt-dlp.exe on Windows
└── ffmpeg          # or ffmpeg.exe on Windows
```

| Binary | Download |
|--------|----------|
| yt-dlp | [github.com/yt-dlp/yt-dlp/releases](https://github.com/yt-dlp/yt-dlp/releases) |
| FFmpeg | [ffmpeg.org/download.html](https://ffmpeg.org/download.html) |

> yt-dlp is **auto-updated at startup** — you only need to seed it once.

---

## ⚙️ Configuration

All settings live in **Settings** (cog icon in the sidebar). Nothing is stored in the repo — credentials are saved to your OS app-data folder.

### 🎙️ Taddy API key *(for Podcast browser)*

1. Sign up at [taddy.org/signup/developers](https://taddy.org/signup/developers)
2. Copy your **User ID** and **API Key** from the dashboard
3. Paste both into **Settings → Taddy API** and hit **Save**

The free tier gives 300 requests/month. Nyro caches responses for 6 hours to keep usage low.

### 🔐 YouTube cookie authentication *(for age-restricted or bot-challenged videos)*

**Method A — cookies.txt file (recommended)**
1. Install the [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) Chrome extension
2. Navigate to [youtube.com](https://youtube.com) while logged in
3. Click the extension → **Export**
4. In Nyro: **Settings → YouTube Cookies → Method A → Browse** and select the file

**Method B — read from browser directly**
- Pick your browser in **Settings → YouTube Cookies → Method B**
- ⚠️ Chrome **must be fully closed** — it locks its cookie database while running

---

## 🗂️ Output folder structure

```
📁 Music/Nyro/
├── 📁 Albums/
│   └── 📁 Album Name (2024)/
│       ├── cover.jpg
│       ├── 001 - Artist – Track.mp3
│       ├── 001 - Artist – Track.lrc
│       └── 002 - Artist – Track.mp3
├── 📁 Playlists/
│   └── 📁 My Playlist/
│       ├── cover.jpg
│       └── 001 - Artist – Song.mp3
├── 📁 Podcasts/
│   └── 📁 Show Name/
│       ├── cover.jpg
│       └── Episode Title.mp3
├── 📁 Videos/
│   └── Artist – Video Title.mp4
└── Artist – Standalone Track.mp3
```

Lyrics (when available) are saved as `.lrc` sidecar files next to each audio file and displayed in the mini player. Cover art is embedded in ID3 tags **and** saved as `cover.jpg` per folder so it survives any tag editor.

---

## 🏗️ Tech stack

| Layer | Technology |
|-------|-----------|
| Shell | [Electron 35](https://www.electronjs.org/) |
| Frontend | [Vue 3](https://vuejs.org/) + [Pinia](https://pinia.vuejs.org/) + [Vue Router 4](https://router.vuejs.org/) |
| Build | [electron-vite](https://electron-vite.org/) + [Tailwind CSS](https://tailwindcss.com/) |
| Downloads | [yt-dlp](https://github.com/yt-dlp/yt-dlp/releases) + [FFmpeg](https://ffmpeg.org/) |
| Tag reading/writing | [node-id3](https://github.com/Zazama/node-id3) |
| Lyrics | [lrclib.net](https://lrclib.net) API |
| Podcasts | [Taddy GraphQL API](https://taddy.org/developers/intro-to-taddy-graphql-api) |
| Audio engine | Web Audio API (EQ, multiband compressor, FX chain) |
| Settings | [electron-store](https://github.com/sindresorhus/electron-store) |

---

## 🤝 Contributing

PRs and issues are welcome. Please open an issue first for large changes so we can align on direction.

---

## ⚖️ Legal

Nyro is a tool for downloading content **you have the right to download**. Respect copyright law and the terms of service of the platforms you use. The authors are not responsible for how this software is used.

---

<div align="center">

Made with ☕ and too many late nights

</div>
