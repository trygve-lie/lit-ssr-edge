/**
 * Demo LitElement component for the Deno example.
 */
import { LitElement, html, css } from 'lit';

export class MyPage extends LitElement {
  static properties = {
    path: { type: String },
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

    h1 { color: #334155; }

    .badge {
      display: inline-block;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.85em;
      font-family: monospace;
    }
  `;

  constructor() {
    super();
    this.path = '/';
  }

  render() {
    return html`
      <h1>Hello from Deno!</h1>
      <p>
        <span class="badge">path: ${this.path}</span>
        <span class="badge">runtime: Deno</span>
        <span class="badge">SSR</span>
      </p>
      <p>
        This page was server-side rendered by lit-ssr-edge running inside
        Deno's built-in HTTP server. No adapters or polyfills are needed —
        Deno natively supports the Web Platform APIs that lit-ssr-edge targets.
      </p>
      <slot></slot>
    `;
  }
}

customElements.define('my-page', MyPage);
