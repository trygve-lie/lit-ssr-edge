/**
 * Demo LitElement component for the Bun example.
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

    h1 { color: #fbf0df; }

    .badge {
      display: inline-block;
      background: #282a36;
      color: #fbf0df;
      border: 1px solid #fbf0df44;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.85em;
      font-family: monospace;
    }

    body { background: #14151a; }
  `;

  constructor() {
    super();
    this.path = '/';
  }

  render() {
    return html`
      <h1>Hello from Bun!</h1>
      <p>
        <span class="badge">path: ${this.path}</span>
        <span class="badge">runtime: Bun</span>
        <span class="badge">SSR</span>
      </p>
      <p>
        This page was server-side rendered by lit-ssr-edge running inside
        Bun's built-in HTTP server. No adapters or polyfills are needed —
        Bun natively supports the Web Platform APIs that lit-ssr-edge targets.
      </p>
      <slot></slot>
    `;
  }
}

customElements.define('my-page', MyPage);
