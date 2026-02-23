/**
 * Simple greeting component for testing basic rendering
 */
import { LitElement, html, css } from 'lit';

export class SimpleGreeting extends LitElement {
  static properties = {
    name: { type: String }
  };

  static styles = css`
    :host {
      display: block;
      padding: 1rem;
    }

    .greeting {
      color: blue;
      font-weight: bold;
    }
  `;

  constructor() {
    super();
    this.name = 'World';
  }

  render() {
    return html`
      <div class="greeting">
        Hello, ${this.name}!
      </div>
    `;
  }
}

customElements.define('simple-greeting', SimpleGreeting);
