import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

/**
 * Content-Security-Policy for the production build, injected as a <meta> tag so it also works on
 * hosts that cannot set headers. firebase.json sends the same policy as a real HTTP header, which
 * additionally allows frame-ancestors (clickjacking protection); a <meta> tag cannot.
 *
 * Scripts may only come from this site. Videos may come from any https address because hosts
 * choose their own video links. The only network connections allowed are to Firebase.
 */
function contentSecurityPolicy(databaseUrl: string | undefined): string {
  const connect = ["'self'", 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com'];
  try {
    if (databaseUrl) {
      const {host} = new URL(databaseUrl);
      connect.push(`https://${host}`, `wss://${host}`);
    }
  } catch {
    // An invalid URL is reported by the app at startup; leave it out of the policy
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    "media-src 'self' https: blob:",
    `connect-src ${connect.join(' ')}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export default defineConfig(({command, mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'watchparty-csp',
        transformIndexHtml(html: string) {
          // Not applied in dev: the dev server injects inline scripts that this policy would block.
          if (command !== 'build') return html;
          const policy = contentSecurityPolicy(env.VITE_FIREBASE_DATABASE_URL);
          return html.replace('</title>', `</title>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // Reachable from this machine only. Use `npm run dev:lan` to share it on your network.
      host: 'localhost',
    },
  };
});
