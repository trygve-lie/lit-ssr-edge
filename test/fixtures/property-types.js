/**
 * Component with various property types for testing SSR property handling
 */
import { LitElement, html } from 'lit';

export class PropertyTypes extends LitElement {
  static properties = {
    // String property
    stringProp: { type: String },

    // Number property
    numberProp: { type: Number },

    // Boolean property
    booleanProp: { type: Boolean },

    // Array property
    arrayProp: { type: Array },

    // Object property
    objectProp: { type: Object },

    // Attribute with custom name
    customAttr: { type: String, attribute: 'data-custom' }
  };

  constructor() {
    super();
    this.stringProp = 'default';
    this.numberProp = 0;
    this.booleanProp = false;
    this.arrayProp = [];
    this.objectProp = {};
    this.customAttr = '';
  }

  render() {
    return html`
      <div>
        <p>String: ${this.stringProp}</p>
        <p>Number: ${this.numberProp}</p>
        <p>Boolean: ${this.booleanProp}</p>
        <p>Array: ${JSON.stringify(this.arrayProp)}</p>
        <p>Object: ${JSON.stringify(this.objectProp)}</p>
        <p>Custom: ${this.customAttr}</p>
      </div>
    `;
  }
}

customElements.define('property-types', PropertyTypes);
