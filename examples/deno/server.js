/**
 * Deno HTTP server — lit-ssr-edge SSR example.
 *
 * Demonstrates how to use lit-ssr-edge to server-side render Lit web components
 * with Deno's built-in HTTP server. No adapters or polyfills are needed — Deno
 * natively supports the Web Platform APIs (Request, Response, ReadableStream,
 * TextEncoder) that lit-ssr-edge targets.
 *
 * Usage:
 *   deno task start
 *   # then open http://localhost:3000
 */

// 1. Install the DOM shim FIRST — as a static import so it is evaluated before
//    any Lit or component modules. Deno has no HTMLElement or customElements;
//    this sets up the minimal subset that lit-element and lit-ssr-edge require.
import 'lit-ssr-edge/install-global-dom-shim.js';

import { render, RenderResultReadable } from 'lit-ssr-edge';
import { html as serverHtml } from 'lit-ssr-edge/server-template.js';
import { html } from 'lit';

// 2. Import components (registers custom elements as a side effect).
import './components/my-page.js';

const PORT = Number(Deno.env.get('PORT') ?? 3000);

Deno.serve(
  {
    port: PORT,
    onListen({ port }) {
      console.log(`\nlit-ssr-edge + Deno`);
      console.log(`───────────────────`);
      console.log(`Server: http://localhost:${port}\n`);
    },
  },
  (request) => {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const { pathname } = new URL(request.url);

    const page = serverHtml`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>lit-ssr-edge + Deno</title>
  </head>
  <body>
    ${html`<my-page path="${pathname}"></my-page>`}
  </body>
</html>`;

    const stream = new RenderResultReadable(render(page)).getStream();

    return new Response(stream, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
);
