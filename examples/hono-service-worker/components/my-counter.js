/**
 * A simple counter component that demonstrates SSR + client-side hydration.
 *
 * The server renders the initial count value into the HTML. After the
 * client-side bundle loads, @lit-labs/ssr-client attaches to the existing
 * shadow DOM and the +/- buttons become interactive — without re-rendering.
 */
import { LitElement, html, css } from 'lit';

export class MyCounter extends LitElement {
  static properties = {
    label: { type: String },
    count: { type: Number },
  };

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #fff8f0;
      border: 1px solid #ffcc80;
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      font-family: system-ui, sans-serif;
    }

    span { font-size: 0.95rem; min-width: 8rem; }

    strong { color: #e36002; font-size: 1.1rem; }

    button {
      width: 2rem;
      height: 2rem;
      border: 1px solid #e36002;
      border-radius: 4px;
      background: #fff;
      color: #e36002;
      font-size: 1.1rem;
      cursor: pointer;
      line-height: 1;
    }

    button:hover:not(:disabled) { background: #fff3e0; }
    button:disabled { opacity: 0.35; cursor: default; }
  `;

  constructor() {
    super();
    this.label = 'Count';
    this.count = 0;
  }

  render() {
    return html`
      <span>${this.label}: <strong>${this.count}</strong></span>
      <button @click=${() => this.count--} ?disabled=${this.count <= 0}>−</button>
      <button @click=${() => this.count++}>+</button>
    `;
  }
}

customElements.define('my-counter', MyCounter);
