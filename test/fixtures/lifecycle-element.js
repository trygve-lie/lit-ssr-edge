/**
 * Component for testing SSR lifecycle behaviour (willUpdate).
 *
 * willUpdate() is the only lifecycle hook that runs during SSR (before
 * render()). This component uses it to compute a derived value so we can
 * verify it is called correctly with the right changedProperties map.
 */
import { LitElement, html } from 'lit';

export class LifecycleElement extends LitElement {
  static properties = {
    firstName: { type: String },
    lastName: { type: String },
    // fullName is derived in willUpdate — never set directly
    fullName: { type: String },
  };

  constructor() {
    super();
    this.firstName = 'John';
    this.lastName = 'Doe';
    this.fullName = 'John Doe';
    // Track lifecycle calls for test assertions
    this._willUpdateCalled = false;
    this._willUpdateChangedProps = null;
  }

  willUpdate(changedProperties) {
    this._willUpdateCalled = true;
    this._willUpdateChangedProps = changedProperties;
    // Recompute derived value whenever either name changes
    if (changedProperties.has('firstName') || changedProperties.has('lastName')) {
      this.fullName = `${this.firstName} ${this.lastName}`;
    }
  }

  render() {
    return html`
      <div>
        <p class="full-name">${this.fullName}</p>
        <p class="first">${this.firstName}</p>
        <p class="last">${this.lastName}</p>
      </div>
    `;
  }
}

customElements.define('lifecycle-element', LifecycleElement);
