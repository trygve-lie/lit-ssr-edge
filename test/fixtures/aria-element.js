/**
 * Component with ElementInternals for testing ARIA/AOM attribute reflection.
 *
 * Uses attachInternals() to set ARIA properties. During SSR, lit-ssr-edge should
 * reflect these to the rendered HTML so that search bots and assistive
 * technologies can read semantics before JavaScript runs.
 */
import { LitElement, html } from 'lit';

export class AriaElement extends LitElement {
  static properties = {
    label: { type: String },
    pressed: { type: Boolean },
  };

  constructor() {
    super();
    this.label = 'Button';
    this.pressed = false;
    // attachInternals() is available on the SSR DOM shim
    this._internals = this.attachInternals?.();
  }

  willUpdate(changed) {
    // Reflect ARIA state via ElementInternals
    if (this._internals) {
      this._internals.ariaLabel = this.label;
      this._internals.ariaPressed = String(this.pressed);
    }
  }

  render() {
    return html`<span role="button">${this.label}</span>`;
  }
}

customElements.define('aria-element', AriaElement);
