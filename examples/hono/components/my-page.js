/**
 * Demo LitElement component for the Hono example.
 */
import { LitElement, html, css } from 'lit';

export class MyPage extends LitElement {
  static properties = {
    path: { type: String },
    framework: { type: String },
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

    h1 { color: #e36002; }

    .badge {
      display: inline-block;
      background: #fff3e0;
      color: #e36002;
      border: 1px solid #ffcc80;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.85em;
      font-family: monospace;
    }
  `;

  constructor() {
    super();
    this.path = '/';
    this.framework = 'Hono';
  }

  render() {
    return html`
      <h1>🔥 Hello from ${this.framework}!</h1>
      <p>
        <span class="badge">path: ${this.path}</span>
        <span class="badge">framework: ${this.framework}</span>
        <span class="badge">SSR</span>
      </p>
      <p>
        This page was server-side rendered by lit-ssr-edge running inside a
        Hono application. The same app code runs on Cloudflare Workers, Fastly
        Compute, Bun, Deno, and Node.js — only the entry point differs.
      </p>
      <slot></slot>
    `;
  }
}

customElements.define('my-page', MyPage);
