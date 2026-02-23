/**
 * Card component for testing nested components and slots
 */
import { LitElement, html, css } from 'lit';

export class CardComponent extends LitElement {
  static properties = {
    title: { type: String },
    variant: { type: String }
  };

  static styles = css`
    :host {
      display: block;
      border: 1px solid #ccc;
      border-radius: 8px;
      overflow: hidden;
    }

    :host([variant="primary"]) {
      border-color: blue;
    }

    .card-header {
      background: #f0f0f0;
      padding: 1rem;
      font-weight: bold;
    }

    .card-body {
      padding: 1rem;
    }
  `;

  constructor() {
    super();
    this.title = '';
    this.variant = 'default';
  }

  render() {
    return html`
      <div class="card-header">
        ${this.title}
      </div>
      <div class="card-body">
        <slot></slot>
      </div>
    `;
  }
}

customElements.define('card-component', CardComponent);
