import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Content-Security-Policy for the production build. It is injected as a <meta> tag so it works on
// any static host. Where your host allows it, also send it as a real HTTP header (see README),
// which additionally makes frame-ancestors (clickjacking protection) possible.
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' https: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export default defineConfig(({command}) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'watchparty-csp',
        transformIndexHtml(html: string) {
          // Not applied in dev: the dev server injects inline scripts that this policy would block.
          if (command !== 'build') return html;
          return html.replace(
            '</title>',
            `</title>\n    <meta http-equiv="Content-Security-Policy" content="${PRODUCTION_CSP}" />`,
          );
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
