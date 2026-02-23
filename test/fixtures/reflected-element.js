/**
 * Component with reflect:true properties for testing attribute reflection.
 *
 * Properties declared with reflect:true should appear as attributes on the
 * rendered HTML element tag, allowing CSS attribute selectors and server-side
 * inspection to work without JavaScript.
 */
import { LitElement, html } from 'lit';

export class ReflectedElement extends LitElement {
  static properties = {
    // Reflected string — appears as the 'status' attribute
    status: { type: String, reflect: true },
    // Reflected number — appears as the 'count' attribute
    count: { type: Number, reflect: true },
    // Reflected boolean — appears as 'active' (present/absent)
    active: { type: Boolean, reflect: true },
    // Non-reflected — should NOT appear as an attribute
    internal: { type: String },
  };

  constructor() {
    super();
    this.status = 'idle';
    this.count = 0;
    this.active = false;
    this.internal = 'hidden';
  }

  render() {
    return html`
      <div>
        <p>Status: ${this.status}</p>
        <p>Count: ${this.count}</p>
        <p>Active: ${this.active}</p>
      </div>
    `;
  }
}

customElements.define('reflected-element', ReflectedElement);
