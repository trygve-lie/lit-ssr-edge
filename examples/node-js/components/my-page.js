/**
 * Demo LitElement component for the Node.js example.
 */
import { LitElement, html, css } from 'lit';

export class MyPage extends LitElement {
  static properties = {
    title: { type: String },
    content: { type: String },
  };

  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      max-width: 720px;
      margin: 2rem auto;
      padding: 0 1rem;
      line-height: 1.6;
    }

    h1 { color: #2d3748; }

    .badge {
      display: inline-block;
      background: #e6fffa;
      color: #234e52;
      border: 1px solid #b2f5ea;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.85em;
    }
  `;

  constructor() {
    super();
    this.title = 'lit-edge on Node.js';
    this.content = 'Server-side rendered with lit-edge.';
  }

  render() {
    return html`
      <h1>${this.title} <span class="badge">SSR</span></h1>
      <p>${this.content}</p>
      <slot></slot>
    `;
  }
}

customElements.define('my-page', MyPage);
