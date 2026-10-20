# Watch Party

Pick a film, get a 6-digit room code, and watch together: play, pause and seek are shared, and there is a chat and a notes pad that tags messages with the video timestamp.

> **Status: front-end prototype.** There is no server yet, so rooms only work between **tabs of the same browser**. A different browser, a private window or another device cannot see a room. See [Limitations](#limitations) and [Roadmap](#roadmap).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 (this machine only)
npm run build      # production build in dist/
npm run lint       # type check
```

`npm run dev:lan` also exposes the dev server to your network. Only use it on networks you trust, because dev servers are not meant to be public.

To try the sync: click **Launch New Watch Room**, copy the invite link, open it in a second tab of the same browser, and press play in either tab.

## How it works

- **Stack:** React 19, TypeScript, Vite, Tailwind CSS 4. No backend.
- **Rooms:** creating a room generates a random 6-digit code (Web Crypto) and stores a small record in `localStorage` so another tab can join it by code or by the `#room=123456` link. Records expire after 24 hours.
- **Sync:** `src/components/SyncEngine.ts` sends messages over a `BroadcastChannel` named after the room. Message types are `PLAY`, `PAUSE`, `SEEK`, `CHAT`, `REACTION` and `SYNC_REQUEST` (a tab that joins late asks the others for their position). A `storage`-event fallback is used only if `BroadcastChannel` is missing.
- **Seeking:** dragging the slider moves only your tab; the new position is sent when you release it.
- **Identity:** there are no accounts. Each tab gets a random id for every page load; only your display name is remembered in `localStorage`.

## Limitations

- Sync does not cross browsers or devices (no server).
- Anyone in a room can control playback. There is no host role, because it could not be enforced without a server.
- Rate limits and message checks run in the browser, so they protect your own tab but cannot stop a determined user.
- Chat names are self-declared and can be spoofed.
- Custom video links are loaded directly by every viewer's browser, so the site hosting the video can see viewers' IP addresses. Only use sources you trust.

## Security notes

- Incoming sync messages are validated: message type whitelist, bounded numbers, recency check, rebuilt payloads, sanitized text, and a fixed set of allowed reactions.
- Custom video links must be `https://` URLs on public-looking domain names (no credentials, raw IP addresses or internal hostnames). This is a client-side check and cannot detect a public name that points to a private address.
- The production build adds a Content-Security-Policy `<meta>` tag (see `vite.config.ts`). A `<meta>` tag cannot set `frame-ancestors` or `X-Content-Type-Options`, so when you deploy, also send real HTTP headers if your host allows it:
  - `Content-Security-Policy` with `frame-ancestors 'none'`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` that disables features the app does not use
- `.env.example` is left over from the AI Studio template; the app uses no environment variables. If you add AI features, call the API from a server. Never put an API key in the browser bundle.

## Roadmap

1. Real-time backend (WebSocket service, or a hosted realtime database) so rooms work across devices.
2. Server-held room state (position, play state) and a snapshot for late joiners.
3. A host role enforced on the server, longer random room IDs and server-side rate limiting.

## Credits

The sample films are the Blender Foundation's open movies, streamed from Google's public sample bucket. They are used under Creative Commons Attribution licenses:

| Film | Credit | License |
| --- | --- | --- |
| Tears of Steel (2012) | © Blender Foundation, [mango.blender.org](https://mango.blender.org/) | CC BY 3.0 |
| Big Buck Bunny (2008) | © Blender Foundation, [peach.blender.org](https://peach.blender.org/) | CC BY 3.0 |
| Sintel (2010) | © Blender Foundation, [durian.blender.org](https://durian.blender.org/) | CC BY 3.0 |
| Elephants Dream (2006) | © 2006 Blender Foundation / Netherlands Media Art Institute, [orange.blender.org](https://orange.blender.org/) | CC BY 2.5 |

Generated from the [google-gemini/aistudio-repository-template](https://github.com/google-gemini/aistudio-repository-template).
