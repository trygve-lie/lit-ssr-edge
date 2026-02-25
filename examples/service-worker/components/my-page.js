/**
 * Demo LitElement component for the Service Worker SSR example.
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

    h1 { color: #1a1a2e; }

    .badge {
      display: inline-block;
      background: #e8f4fd;
      color: #1565c0;
      border: 1px solid #90caf9;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.85em;
      font-family: monospace;
    }

    .note {
      background: #fff8e1;
      border-left: 4px solid #ffc107;
      padding: 0.75rem 1rem;
      margin-top: 1.5rem;
      font-size: 0.9em;
    }
  `;

  constructor() {
    super();
    this.path = '/';
  }

  render() {
    return html`
      <h1>Hello from a Service Worker!</h1>
      <p>
        <span class="badge">path: ${this.path}</span>
        <span class="badge">runtime: ServiceWorker (browser)</span>
        <span class="badge">SSR</span>
      </p>
      <p>
        This page was server-side rendered by lit-ssr-edge running inside a
        browser Service Worker — no server required. The HTML was generated in
        the browser's service worker thread and streamed into the page response.
      </p>
      <div class="note">
        <strong>How it works:</strong> The service worker intercepts this
        navigation request (<code>${this.path}</code>), renders the Lit
        component to HTML using lit-ssr-edge, and returns the streamed response
        — all inside your browser.
      </div>
      <slot></slot>
    `;
  }
}

customElements.define('my-page', MyPage);
