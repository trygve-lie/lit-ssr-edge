/**
 * @license
 * Copyright (c) 2019 Google LLC. SPDX-License-Identifier: BSD-3-Clause
 * Portions copyright (c) 2026 lit-ssr-edge contributors.
 *
 * Base element renderer for custom elements.
 *
 * ElementRenderer provides the interface that rendering backends implement to
 * render custom elements during SSR. The default FallbackRenderer is used when
 * no matching renderer is found for a custom element.
 */
import { escapeHtml } from './util/escape-html.js';

/**
 * @license
 * Copyright (c) 2019 Google LLC. SPDX-License-Identifier: BSD-3-Clause
 * Portions copyright (c) 2026 lit-ssr-edge contributors.
 *
 * Looks up the appropriate ElementRenderer for a custom element instance.
 *
 * @param {Object} renderInfo - Current render context
 * @param {string} tagName - Custom element tag name
 * @param {Function} ceClass - Custom element constructor
 * @param {Map<string,string>} attributes - Static attributes on the element
 * @returns {ElementRenderer} Matching renderer instance
 */
export const getElementRenderer = (
  { elementRenderers },
  tagName,
  ceClass = customElements.get(tagName),
  attributes = new Map()
) => {
  if (ceClass === undefined) {
    console.warn(`Custom element ${tagName} was not registered.`);
    return new FallbackRenderer(tagName);
  }

  for (const renderer of elementRenderers) {
    if (renderer.matchesClass(ceClass, tagName, attributes)) {
      return new renderer(tagName);
    }
  }

  return new FallbackRenderer(tagName);
};

/**
 * @license
 * Copyright (c) 2019 Google LLC. SPDX-License-Identifier: BSD-3-Clause
 * Portions copyright (c) 2026 lit-ssr-edge contributors.
 *
 * Base class for element renderers.
 *
 * Subclasses handle specific element types (e.g. LitElement) and implement
 * the renderShadow() and other methods to produce HTML output.
 */
export class ElementRenderer {
  /**
   * Returns true when this renderer handles the given element class/tagName.
   *
   * @param {Function} _ceClass - Custom element constructor
   * @param {string} _tagName - Tag name
   * @param {Map<string,string>} _attributes - Static attributes
   * @returns {boolean}
   */
  static matchesClass(_ceClass, _tagName, _attributes) {
    return false;
  }

  /**
   * @param {string} tagName - Tag name this renderer handles
   */
  constructor(tagName) {
    this.tagName = tagName;
    this.element = undefined;
  }

  /**
   * Called when an attribute is set on the element. Lowercases the name
   * (matching browser behavior), updates the element, and triggers
   * attributeChangedCallback.
   *
   * @param {string} name - Attribute name
   * @param {string} value - Attribute value
   */
  setAttribute(name, value) {
    // Browser lowercases all HTML attribute names.
    name = name.toLowerCase();
    if (this.element !== undefined) {
      const old = this.element.getAttribute(name);
      this.element.setAttribute(name, value);
      this.attributeChangedCallback(name, old, value);
    }
  }

  /**
   * Called when a property is set on the element.
   *
   * @param {string} name - Property name
   * @param {unknown} value - Property value
   */
  setProperty(name, value) {
    if (this.element !== undefined) {
      this.element[name] = value;
    }
  }

  /**
   * Called after all attributes are set, just before light children are
   * rendered. Equivalent to connectedCallback lifecycle.
   */
  connectedCallback() {}

  /**
   * Called from setAttribute() to emulate attributeChangedCallback.
   *
   * @param {string} _name - Attribute name
   * @param {string|null} _old - Old value
   * @param {string} _value - New value
   */
  attributeChangedCallback(_name, _old, _value) {}

  /**
   * The shadow root options for the declarative shadow DOM template.
   * @returns {{ mode: string, delegatesFocus?: boolean }}
   */
  get shadowRootOptions() {
    return { mode: 'open' };
  }

  /**
   * Renders the element's attributes as an array of strings.
   * Returns an array so the result can be concatenated with `defer-hydration`.
   *
   * @returns {Array<string>} Array of attribute strings (each space-prefixed)
   */
  renderAttributes() {
    const result = [];
    if (this.element !== undefined) {
      const { attributes } = this.element;
      for (let i = 0; i < attributes.length; i++) {
        const { name, value } = attributes[i];
        if (value === '' || value === undefined || value === null) {
          result.push(` ${name}`);
        } else {
          result.push(` ${name}="${escapeHtml(value)}"`);
        }
      }
    }
    return result;
  }

  /**
   * Renders the element's shadow DOM. Return undefined to skip shadow root.
   *
   * @param {Object} _renderInfo - Current render context
   * @returns {Array|undefined} Render result or undefined
   */
  renderShadow(_renderInfo) {
    return undefined;
  }

  /**
   * Renders the element's light DOM (slotted children).
   *
   * @param {Object} _renderInfo - Current render context
   * @returns {Array|undefined} Render result or undefined
   */
  renderLight(_renderInfo) {
    return undefined;
  }
}

/**
 * @license
 * Copyright (c) 2019 Google LLC. SPDX-License-Identifier: BSD-3-Clause
 * Portions copyright (c) 2026 lit-ssr-edge contributors.
 *
 * Fallback renderer used when no matching renderer is found.
 * Renders the element as-is (pass-through with no shadow DOM).
 */
export class FallbackRenderer extends ElementRenderer {
  static matchesClass() {
    return false;
  }

  constructor(tagName) {
    super(tagName);
    this._fallbackAttributes = {};
  }

  setAttribute(name, value) {
    this._fallbackAttributes[name.toLowerCase()] = value;
  }

  renderAttributes() {
    const result = [];
    for (const [name, value] of Object.entries(this._fallbackAttributes)) {
      if (value === '' || value === undefined || value === null) {
        result.push(` ${name}`);
      } else {
        result.push(` ${name}="${escapeHtml(value)}"`);
      }
    }
    return result;
  }
}
