# Classroom Tools (PWA)

A fast, offline-first teacher toolkit that installs to your iPhone, iPad, Chromebook or desktop home screen.
Inspired by the **myClassroom: Class Tools** iOS app — same tool lineup, same one-tap, clicker-friendly workflow,
built as a free, open-source Progressive Web App with zero dependencies and no build step.

**Live app:** https://micca20.github.io/classroom-tools-pwa/

## Tools

| Tool | What it does |
|---|---|
| 🔔 **Bell** | Ring 10 synthesized sounds (chime, school bell, ding dong, triangle, gong, xylophone, whistle, harp, marimba, air horn), optional spoken message. |
| ⏱ **Timer** | Each press adds time (configurable increment). Spoken “5 minutes remaining” style announcements, countdown ticks, custom end sound + message. Keeps running in the background of the app. |
| 🥢 **Sticks** | Random name picker that reads the name aloud, with *no repeats until the cup is empty*. |
| 👥 **Groups** | Make groups by size or count, mark absentees, avoid **unwanted pairs** and last time's partners. |
| ⭐ **Tallies** | Class vs. teacher points with tally marks and goal celebration. |
| ⏳ **Time Lost** | Stopwatch with warning sound, ticking clock and a “time owed” multiplier, tracked per class per day. |
| 💗 **Hearts** | Each press removes a heart; hearts automatically refill after a set time. |
| 📢 **Noise Meter** | Mic gauge filtered to the student-voice band (≈250–3500 Hz) with a buffer to prevent false alarms. Nothing is recorded. |
| 🚪 **Hall Pass** | Sign students out to a destination, overtime warnings, max-out limit and a log. |
| 🎲 **Coin & Dice** | Coin flip, 1–6 dice, or random number range. |
| 🔁 **Transitions** | Timed transitions (Clean Up, Line Up…) with music and spoken start/end cues. |
| 🎵 **Music Box** | Three sources, one player: **Built-in** (224 original generated tracks in 14 moods incl. Pop Hits, Dance/EDM, Hip-Hop Beat, Pop Ballad — offline), **My Music** (import your own MP3/M4A files, stored on-device), and **YouTube** (save playlist/video links; official privacy-enhanced player with a mini player while you use other tools). Shuffle, repeat, sleep timer, clicker control. |
| 📝 **Notes** | One press drops a note auto-tagged with time, date and current subject. Add text or dictate later; export. |
| 🧠 **Brain Breaks** | Guided breathing, movement, stretch and silly breaks with voice + music. |
| 🪑 **Smart Seating** | Draw desks on a grid, then generate seating charts that honor unwanted/wanted pairs and front/middle/back zones using real desk distances (adjustable radius). Tap two desks to swap; print. |

**Plus:** Routines (daily schedule that auto-announces subjects, can switch class and reset tools), multiple classes/rosters,
voice & speed selection, home-screen tool toggles, and JSON backup/restore.

## Bluetooth clicker / remote support

Most Bluetooth presentation clickers and page-turners act as keyboards. Inside any tool:

- **Main button** (Space/Enter/→/↓/PageDown by default) runs the tool's main action — ring, add time, draw a stick, remove a heart…
- **Second button** (←/↑/PageUp) runs the alternate action — pause timer, refill cup, add a heart…
- **Esc/Backspace** returns home.
- On the home screen, keys **1–9** open tools, and you can map any clicker button to jump to a specific tool.

Remap everything in **Settings → Bluetooth clicker & keyboard → Learn**.

## Install

1. Open the live URL in Safari (iOS/iPadOS) or Chrome.
2. **Share → Add to Home Screen** (iOS) or **Install app** (Chrome/Edge).
3. Launch once while online — after that it works fully offline.

Tip: the app requests a screen wake lock while a tool is open so routines and timers keep announcing. On iOS, sound
starts after your first tap (browser rule).

## Sound & microphone troubleshooting (iPhone/iPad)

- **No sound:** tap the “Tap to turn on sound” banner, turn the volume up, and turn off the ring/silent switch (or Silent Mode in Control Center). Settings → *Test sound*.
- **Mic blocked:** Settings app → Apps → Safari → Microphone → *Ask* or *Allow* (also Privacy & Security → Microphone). In Safari you can use **aA → Website Settings → Microphone → Allow**. Then fully close and reopen the app.
- Home Screen web apps on iOS may ask for mic permission again each launch — that's an Apple limitation.
- In-app: **Settings → Microphone → Test microphone** shows the permission state and live level. The Noise Meter has **Calibrate quiet room** for accurate readings.

## About music & copyright

The built-in tracks are original, generated in the browser — no copyrighted songs ship with this app. For current hits, use
**My Music** with files you own (e.g. purchased instrumental/cover albums) or **YouTube** links, which play through YouTube's
official embedded player. Imported music stays on the device and isn't included in backups.

## Privacy

Everything (rosters, notes, logs) is stored in your browser's `localStorage` on that device only. No accounts, no
server, no analytics. Use **Settings → Export backup** to move data between devices.

## Develop

No build tools needed — plain ES modules.

```bash
python3 -m http.server 8765   # then open http://localhost:8765
```

```
index.html, manifest.webmanifest, sw.js   PWA shell + offline cache
css/app.css                               all styles
js/app.js                                 router, home screen, clicker handling
js/store.js  js/ui.js  js/audio.js        state, UI helpers, Web Audio sounds + speech
js/music.js  js/routines.js  js/pages.js  music engine, routine engine, Routines/Classes/Settings
js/tools/*.js                             one module per tool
```

Bump `VERSION` in `sw.js` when you change files so installed copies update.

## Disclaimer

Independent project, not affiliated with or endorsed by myClassroom or its developer. All code, icons and sounds are original.

## License

MIT
