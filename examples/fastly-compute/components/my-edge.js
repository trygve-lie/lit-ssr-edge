/**
 * Demo LitElement component for the Fastly Compute example.
 *
 * In a real project, components would be bundled into src/index.js at build
 * time by esbuild before js-compute-runtime compiles it to WebAssembly.
 */
import { LitElement, html, css } from 'lit';

export class MyEdge extends LitElement {
  static properties = {
    path: { type: String },
    region: { type: String },
  };

  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
      line-height: 1.6;
    }

    h1 { color: #c0392b; }

    .meta {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .tag {
      background: #fdecea;
      color: #c0392b;
      border: 1px solid #f5c6c2;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.85em;
      font-family: monospace;
    }
  `;

  constructor() {
    super();
    this.path = '/';
    this.region = 'edge';
  }

  render() {
    return html`
      <h1>Hello from Fastly Compute!</h1>
      <div class="meta">
        <span class="tag">path: ${this.path}</span>
        <span class="tag">region: ${this.region}</span>
        <span class="tag">SSR</span>
      </div>
      <p>
        This page was server-side rendered by lit-ssr-edge running on Fastly Compute
        (SpiderMonkey + WASM). No nodejs_compat or polyfills required.
      </p>
      <slot></slot>
    `;
  }
}

customElements.define('my-edge', MyEdge);
