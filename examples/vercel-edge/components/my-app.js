/**
 * Demo LitElement component for the Vercel Edge Functions example.
 */
import { LitElement, html, css } from 'lit';

export class MyApp extends LitElement {
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

    h1 { color: #000; }

    .badge {
      display: inline-block;
      background: #f4f4f5;
      color: #18181b;
      border: 1px solid #d4d4d8;
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
      <h1>Hello from Vercel Edge Functions!</h1>
      <p>
        <span class="badge">path: ${this.path}</span>
        <span class="badge">runtime: edge (V8)</span>
        <span class="badge">SSR</span>
      </p>
      <p>
        This page was server-side rendered by lit-ssr-edge running inside a
        Vercel Edge Function. Vercel's edge runtime is V8-isolate based and
        implements the WinterTC Minimum Common Web Platform API.
      </p>
      <slot></slot>
    `;
  }
}

customElements.define('my-app', MyApp);
