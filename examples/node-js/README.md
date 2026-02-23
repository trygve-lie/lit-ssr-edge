# lit-ssr-edge — Node.js example

Server-side renders Lit web components in a Node.js 18+ HTTP server using lit-ssr-edge.

## Requirements

- Node.js 18 or later (native `fetch()` and Web Streams support)

## Getting started

```bash
npm install
npm start
# Open http://localhost:3000
```

## How it works

```
server.js
  │
  ├─ import 'lit-ssr-edge/install-global-dom-shim.js'   → sets up HTMLElement, customElements
  ├─ import './components/my-page.js'                → registers <my-page>
  │
  └─ createServer((req, res) => {
       const result = render(serverHtml`...`);
       const stream = new RenderResultReadable(result).getStream();
       // pipe Uint8Array chunks into Node's ServerResponse
     })
```

## Streaming vs buffered output

**Streaming** (recommended for large pages — sends HTML as it is rendered):
```js
const stream = new RenderResultReadable(render(page)).getStream();
const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  res.write(value); // Uint8Array chunk
}
res.end();
```

**Buffered** (simpler — waits for full render before sending):
```js
const htmlString = await collectResult(render(page));
res.end(htmlString);
```

## Web Streams on Node.js

lit-ssr-edge produces `ReadableStream<Uint8Array>` (Web Streams API), which is
available natively in Node.js 18+. The stream's `getReader()` API is used to
pipe chunks into Node's `ServerResponse`.

For Node.js 16 or older, you can convert Web Streams to Node streams via
`stream.Readable.fromWeb()` (available in Node 17+).
