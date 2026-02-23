/**
 * Node.js HTTP server — lit-edge SSR example.
 *
 * Demonstrates how to use lit-edge to server-side render Lit web components
 * in a Node.js 18+ environment.
 *
 * Usage:
 *   node server.js
 *   # or: npm start
 *   # then open http://localhost:3000
 */

// 1. Install the DOM shim FIRST, before any Lit or component imports.
//    On Node.js, lit-element installs this automatically as a transitive
//    dependency, but explicitly importing here makes the dependency clear
//    and works even when lit is not in scope.
import 'lit-edge/install-global-dom-shim.js';

import { createServer } from 'node:http';
import { render, RenderResultReadable, collectResult } from 'lit-edge';
import { html as serverHtml } from 'lit-edge/server-template.js';
import { html } from 'lit';

// 2. Import components (registers custom elements as a side effect).
import './components/my-page.js';

const PORT = process.env.PORT ?? 3000;

// ── Rendering helpers ────────────────────────────────────────────────────────

/**
 * Builds the full HTML document for a given URL path.
 * Returns a lit-edge RenderResult iterable.
 */
function buildPage(pathname) {
  return render(
    serverHtml`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lit-edge Node.js example</title>
  </head>
  <body>
    ${html`
      <my-page
        title="Hello from Node.js!"
        content="Path: ${pathname}"
      ></my-page>
    `}
  </body>
</html>`
  );
}

// ── HTTP server ──────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405).end('Method Not Allowed');
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── Option A: Streaming (low TTFB, ideal for large pages) ────────────────
  //
  // Pipe the Web Streams ReadableStream directly into Node's ServerResponse.
  // This sends HTML chunks to the client as they are rendered.

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Transfer-Encoding': 'chunked',
  });

  const result = buildPage(url.pathname);
  const stream = new RenderResultReadable(result).getStream();
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    reader.releaseLock();
    res.end();
  }

  // ── Option B: Buffered (simpler, for small pages or when Content-Length is needed) ──
  //
  // const html = await collectResult(buildPage(url.pathname));
  // res.writeHead(200, {
  //   'Content-Type': 'text/html; charset=utf-8',
  //   'Content-Length': Buffer.byteLength(html),
  // });
  // res.end(html);
});

server.listen(PORT, () => {
  console.log(`lit-edge SSR server running at http://localhost:${PORT}`);
});
