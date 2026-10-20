# Watch Party

Watch a video together with friends, in sync. Pick a film (or paste a direct video link), share a private room code, and everyone's player follows the same play, pause and seek. Live chat, reactions and a viewer list included.

**Stack:** React 19, TypeScript, Vite, Tailwind 4, Firebase Authentication (anonymous) and Firebase Realtime Database.

## Set it up (about 10 minutes)

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication > Sign-in method:** enable **Anonymous**.
3. **Realtime Database:** create a database (locked mode is fine). Note its URL.
4. **Project settings > Your apps:** add a **Web app** and copy its config.
5. Locally: `cp .env.example .env.local` and fill in the five `VITE_FIREBASE_*` values.
6. Deploy the security rules and the site (needs `npm i -g firebase-tools` and `firebase login`):

   ```bash
   cp .firebaserc.example .firebaserc      # then put your project id inside
   npm install
   firebase deploy --only database          # publishes database.rules.json  (do this first!)
   npm run build && firebase deploy --only hosting
   ```

7. **Lock down the API key:** Google Cloud console > APIs & Services > Credentials > your browser key > restrict to your site's address (HTTP referrers).
8. Recommended: turn on **App Check** (reCAPTCHA) for Authentication and Realtime Database, and set a **budget alert**, to limit automated abuse.

Until step 5 is done the site shows a "not connected" notice instead of working.

```bash
npm run dev        # http://localhost:3000
npm test           # database rules + sync engine tests
npm run lint       # type check
npm run build      # type check + production build in dist/
```

## How it works

- **Identity:** every visitor is signed in anonymously by Firebase: a random user id, no password, no personal data. Clearing site data creates a new identity. Only the display name is kept in `localStorage`.
- **Rooms:** `rooms/<code>` holds `meta` (host, title, video link, control mode), `playback`, `members`, `chat`, `reactions`. Codes are 10 random characters (50 bits). Rooms cannot be listed, only opened by someone who knows the code, and stop working after 24 hours.
- **Sync (`src/lib/playbackSync.ts`):** the room stores one fact: "at server time T the video was at position P and was playing/paused". Every client computes the target position from that using the database's server clock (so wrong device clocks do not matter) and steers its own `<video>`: small errors are corrected with a 5% speed change, large ones by seeking. Late joiners compute the same target on arrival. If the browser blocks autoplay, a "Tap to join playback" overlay appears.
- **Control:** by default only the host can play, pause and seek; the host can switch the room to "everyone". Enforced by the database rules, not just the UI.
- **Presence:** members are added on join and removed automatically on disconnect (`onDisconnect`). The host can remove and ban a viewer and delete chat messages.

## Security

What the rules (`database.rules.json`) enforce on the server:

- Nothing is readable or writable without sign-in; no listing of rooms or the database root.
- A room can be created once and never overwritten; the host cannot be changed; the video link cannot be swapped after creation.
- Only the host (or members, if the host chose "everyone") can write `playback`; timestamps must be the server's time; author fields must equal the caller's uid.
- Chat and reactions: members only, as themselves, under their registered name, with length limits, a fixed set of reactions, and no editing. Only the host can delete.
- Video links must be `https://` on a real domain name: no raw IP addresses, no `localhost`/internal suffixes, no embedded credentials.
- Rooms expire after 24 hours.

Browser side: all text is rendered by React (no raw HTML), data read back from the database is re-validated before use, the build ships a strict Content-Security-Policy (`script-src 'self'`; connections only to Firebase), and `firebase.json` adds headers (CSP with `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy). Fonts are bundled, so no request goes to Google Fonts. The old hardcoded student identity and fake login were removed.

## Known limits

- **No rate limiting on the server.** Realtime Database rules cannot throttle writes, so a determined user could spam chat. Client-side limits only protect honest users. Use App Check, budget alerts, and if needed a Cloud Function for throttling.
- **Anonymous accounts are cheap to create**, so a banned viewer can come back with a new browser profile.
- **Custom video links** are loaded directly by every viewer's browser, so that site can see their IP addresses. The browser cannot detect a public name that points at a private address (DNS rebinding). Only direct MP4/WebM links work, not YouTube pages. Only share videos you have the right to share.
- Sync accuracy depends on each viewer's connection and buffering; typical drift is well under a second.

## Testing status

- `npm test` runs 93 tests: the database rules (simulated with `targaryen`, including that the browser-side and server-side URL checks agree) and the sync engine against a simulated video element.
- The real UI was also driven by several separate Chromium browsers against an in-memory stand-in for Firebase (same API, no rules). Host and guests stayed within about 0.1 s through play, pause, seek and a late join; chat text was shown as plain text, not HTML; reactions, host-only vs everyone control, removing a viewer, presence on tab close and the "room not found" screen all behaved correctly.
- **Not verified:** a run against the real Firebase emulator or a live project (the emulator could not be downloaded where this was built), and the "Tap to join playback" overlay in a real browser (covered only by a unit test). After deploying, do a two-device check: create a room on one device, join on another, press play. Use the Rules Playground in the Firebase console to spot-check the rules.

## Credits

The sample films are the Blender Foundation's open movies, streamed from Google's public sample bucket under Creative Commons Attribution licenses.

| Film | Credit | License |
| --- | --- | --- |
| Tears of Steel (2012) | © Blender Foundation, [mango.blender.org](https://mango.blender.org/) | CC BY 3.0 |
| Big Buck Bunny (2008) | © Blender Foundation, [peach.blender.org](https://peach.blender.org/) | CC BY 3.0 |
| Sintel (2010) | © Blender Foundation, [durian.blender.org](https://durian.blender.org/) | CC BY 3.0 |
| Elephants Dream (2006) | © 2006 Blender Foundation / Netherlands Media Art Institute, [orange.blender.org](https://orange.blender.org/) | CC BY 2.5 |

Started from the [google-gemini/aistudio-repository-template](https://github.com/google-gemini/aistudio-repository-template).
