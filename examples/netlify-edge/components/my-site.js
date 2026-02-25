/**
 * Demo LitElement component for the Netlify Edge Functions example.
 */
import { LitElement, html, css } from 'lit';

export class MySite extends LitElement {
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

    h1 { color: #00ad9f; }

    .badge {
      display: inline-block;
      background: #e6fffa;
      color: #00695c;
      border: 1px solid #b2dfdb;
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
      <h1>Hello from Netlify Edge Functions!</h1>
      <p>
        <span class="badge">path: ${this.path}</span>
        <span class="badge">runtime: Deno</span>
        <span class="badge">SSR</span>
      </p>
      <p>
        This page was server-side rendered by lit-ssr-edge running inside a
        Netlify Edge Function (Deno runtime). No build step was required —
        Netlify bundles edge functions automatically.
      </p>
      <slot></slot>
    `;
  }
}

customElements.define('my-site', MySite);
