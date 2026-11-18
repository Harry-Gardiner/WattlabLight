# WattlabLight

Indoor cycling app for a Bluetooth smart trainer. Runs in Chrome on Android, installs as an app, and updates itself when this repo changes.

- Pair a trainer (FTMS), heart-rate strap/watch and cadence sensor over Web Bluetooth
- ERG (fixed watts) and slope control
- 12 preset workouts, all with warm-up and cool-down, with an upcoming-intervals timeline and countdown cues
- Per-rider FTP profiles

## Use it
Open the site in Chrome on Android, then menu → **Install app**. Bluetooth needs Chrome (not iOS browsers).
No trainer handy? Devices → **Use demo devices**.

## Develop
```
npm install
npm run dev      # local dev server
npm test         # protocol + workout tests
npm run build
```
Pushing to `main` builds and deploys to GitHub Pages. Open apps show a "new version ready" banner.
