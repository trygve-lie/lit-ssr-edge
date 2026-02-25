/**
 * Minimal Node.js static file server for the service worker example.
 *
 * Service workers require HTTPS in production, but browsers make an exception
 * for `http://localhost`. This server satisfies that requirement for local
 * development.
 *
 * Everything is served from the public/ directory.
 * The bundled service worker (public/sw.js) is at the root path /sw.js,
 * which gives it the default scope / (the whole site). A service worker at
 * /dist/sw.js would only control pages under /dist/ and would never intercept
 * navigation requests to /.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT ?? 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Serve everything from public/. Fall back to index.html for /.
  const filePath = join(
    __dirname,
    'public',
    pathname === '/' ? 'index.html' : pathname,
  );

  try {
    const content = await readFile(filePath);
    const type = MIME[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`\nlit-ssr-edge service worker example`);
  console.log(`────────────────────────────────────`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(``);
  console.log(`Open the URL above in a browser.`);
  console.log(`The page reloads once automatically as the service worker`);
  console.log(`installs. After that, every navigation is SSR-rendered by`);
  console.log(`lit-ssr-edge inside the browser's service worker thread.\n`);
});
