/**
 * LitElement-specific renderer for server-side rendering.
 *
 * Handles the LitElement SSR lifecycle (willUpdate → update → render) and
 * produces declarative shadow DOM output with embedded styles.
 *
 * Enhancements over the base ElementRenderer:
 *  - Instantiates the real element class so property declarations,
 *    converters, and defaults are respected.
 *  - Reflects ElementInternals ARIAMixin properties back to DOM attributes
 *    before serialisation so that search bots can read ARIA semantics without
 *    JavaScript running.
 *  - Patches LitElement.createRenderRoot to avoid adoptStyles (browser API)
 *    during SSR.
 */
import { ElementRenderer } from './element-renderer.js';
import { LitElement, ReactiveElement } from 'lit';
import { _$LE } from 'lit-element/private-ssr-support.js';
import { ariaMixinAttributes, HYDRATE_INTERNALS_ATTR_PREFIX } from './dom-shim.js';
import { renderValue } from './render-value.js';

const { attributeToProperty, changedProperties } = _$LE;

// Patch createRenderRoot so that LitElement does not call adoptStyles
// (a browser-only API) during SSR. The patch is idempotent — subsequent
// imports of this module are no-ops because the prototype is already patched.
LitElement.prototype['createRenderRoot'] = function () {
  return (
    this.shadowRoot ??
    this.attachShadow(this.constructor.shadowRootOptions)
  );
};

/**
 * ElementRenderer implementation for LitElements.
 */
export class LitElementRenderer extends ElementRenderer {
  /**
   * Matches any class whose constructor carries the _$litElement$ flag.
   *
   * @param {Function} ctor - Custom element constructor
   * @returns {boolean}
   */
  static matchesClass(ctor) {
    return ctor['_$litElement$'];
  }

  /**
   * @param {string} tagName - The custom element tag name
   */
  constructor(tagName) {
    super(tagName);
    this.element = new (customElements.get(this.tagName))();

    // Reflect ElementInternals ARIAMixin properties to DOM attributes so that
    // search bots can read semantic information without JavaScript. This mirrors
    // the behaviour of @lit-labs/ssr.
    //
    // The HYDRATE_INTERNALS_ATTR_PREFIX attribute is also set so that the
    // client can remove reflected attributes after hydration (they would
    // otherwise appear as visible HTML attributes in the DevTools inspector).
    const internals = this.element.__internals;
    if (internals) {
      for (const [ariaProp, ariaAttr] of Object.entries(ariaMixinAttributes)) {
        const value = internals[ariaProp];
        if (value && !this.element.hasAttribute(ariaAttr)) {
          this.element.setAttribute(ariaAttr, value);
          this.element.setAttribute(
            `${HYDRATE_INTERNALS_ATTR_PREFIX}${ariaAttr}`,
            value
          );
        }
      }
    }
  }

  /**
   * Shadow root options from the element class (mode, delegatesFocus, etc.).
   * Falls back to the base class default of `{ mode: 'open' }`.
   */
  get shadowRootOptions() {
    return (
      this.element.constructor.shadowRootOptions ?? super.shadowRootOptions
    );
  }

  /**
   * Runs the SSR lifecycle:
   *  1. willUpdate(changedProperties) — compute derived values
   *  2. ReactiveElement.update() — reflect reactive properties to attributes
   *     (attribute setting only; no DOM mutation)
   */
  connectedCallback() {
    const propertyValues = changedProperties(this.element);
    this.element?.['willUpdate'](propertyValues);
    ReactiveElement.prototype['update'].call(this.element, propertyValues);
  }

  /**
   * Called when a bound attribute changes. Converts the attribute string value
   * to the element's declared property type and sets it on the instance.
   *
   * @param {string} name - Attribute name
   * @param {string|null} _old - Previous value (unused)
   * @param {string} value - New value
   */
  attributeChangedCallback(name, _old, value) {
    attributeToProperty(this.element, name, value);
  }

  /**
   * Renders the element's shadow DOM as a ThunkedRenderResult.
   *
   * The result is an array of:
   *  - Style strings (from elementStyles)
   *  - A thunk that renders the template returned by element.render()
   *
   * @param {Object} renderInfo - Current render context
   * @returns {Array} ThunkedRenderResult
   */
  renderShadow(renderInfo) {
    const result = [];

    const styles = this.element.constructor.elementStyles;
    if (styles !== undefined && styles.length > 0) {
      result.push('<style>');
      for (const style of styles) {
        result.push(style.cssText);
      }
      result.push('</style>');
    }

    result.push(() => renderValue(this.element.render(), renderInfo));

    return result;
  }

  /**
   * Renders the element's light DOM if it defines a renderLight() method.
   *
   * @param {Object} renderInfo - Current render context
   * @returns {Array|undefined}
   */
  renderLight(renderInfo) {
    const result = this.element['renderLight']?.();
    if (result !== undefined) {
      return [() => renderValue(result, renderInfo)];
    }
    return undefined;
  }
}
