/**
 * Demo LitElement component for the Cloudflare Worker example.
 *
 * In a real project, components would be bundled into worker.js at build time.
 */
import { LitElement, html, css } from 'lit';

export class MyApp extends LitElement {
  static properties = {
    path: { type: String },
    greeting: { type: String },
  };

  static styles = css`
    :host {
      display: block;
      font-family: sans-serif;
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }

    h1 {
      color: #1a73e8;
    }

    .path {
      font-family: monospace;
      background: #f5f5f5;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }
  `;

  constructor() {
    super();
    this.path = '/';
    this.greeting = 'Hello from the edge!';
  }

  render() {
    return html`
      <h1>${this.greeting}</h1>
      <p>You are at: <span class="path">${this.path}</span></p>
      <p>This page was server-side rendered by lit-ssr-edge on Cloudflare Workers.</p>
      <slot></slot>
    `;
  }
}

customElements.define('my-app', MyApp);
