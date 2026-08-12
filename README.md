# HousePlay

HousePlay is a complete, mobile-first private game. It combines daily chores, approval-based points, ticket rewards, Coke and water tracking, a pleasure/punishment wheel, persistent lock timing, active effects, admin controls, and a full history ledger.

Everything runs locally in the browser. There is no database, account service, build step, CDN, or internet dependency.

## Live app

HousePlay is published at <https://dylanmsprouse3455.github.io/Houseplay/>.

## Open in Koder

1. Unzip the `HousePlay` folder.
2. Move the whole folder into Koder without changing its internal folder structure.
3. Open `index.html`.
4. Use Koder’s local preview.

The Coke-can and water-bottle images are stored in `assets/`, so they remain available offline.

## Publish with GitHub Pages

The included GitHub Actions workflow publishes the repository to GitHub Pages whenever `main` changes. `index.html` is the only webpage and all links are relative, so no build process is required.

## Project structure

```text
HousePlay/
├── index.html
├── assets/
│   ├── coke-can.png
│   └── water-bottle.png
├── css/
│   ├── base.css
│   └── theme.css
├── js/
│   ├── config.js
│   ├── state.js
│   ├── tasks.js
│   ├── cokes.js
│   ├── wheel-lock.js
│   ├── ui.js
│   ├── privacy.js
│   └── main.js
└── README.md
```

## Edit choices

The normal chore choices, wheel outcomes, durations, labels, and fixed game constants live in `js/config.js`. Keep existing chore IDs stable after the app has saved data; the IDs connect daily and historical records to their chore names.

The standard extra-Coke price is fixed at 2 points. The normal daily allowance is four free Cokes, except while the seven-day reduced-Coke wheel effect is active.

## Saved data

The app stores one central state object under the localStorage key `houseplay-v3`. Data is local to the browser and device that opened the app. Export a JSON backup in Admin before clearing browser data or moving to another device, then import that backup on the new device.

HousePlay attempts safe migration from older compatible saves, including `houseplay-public-v1`, renamed effects and lock properties, old Coke log shapes, older daily-required records, pending items, and history entries.

## Admin security

Admin access verifies the entered access code with browser `crypto.subtle` SHA-256. The plain access code is not stored in localStorage. The unlocked session exists only in memory and ends on refresh, tab close, or when **Lock Admin** is pressed.

Because this is a client-side static app, the protection prevents ordinary in-app access but is not server-grade authentication. A technically skilled person with control of the browser and source can inspect or alter client-side behavior.

## Browser support

HousePlay is designed for current iPhone Safari, Android Chrome, desktop browsers, Koder local preview, and GitHub Pages. A secure local preview or HTTPS page is required for browser cryptographic verification in Admin.
