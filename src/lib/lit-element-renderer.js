/**
 * LitElement-specific renderer for server-side rendering.
 *
 * Handles LitElement lifecycle (willUpdate, render) and generates declarative
 * shadow DOM output with embedded styles.
 */
import { ElementRenderer } from './element-renderer.js';
import { LitElement, ReactiveElement } from 'lit';
import { _$LE } from 'lit-element/private-ssr-support.js';
import { renderValue } from './render-value.js';

const { attributeToProperty, changedProperties } = _$LE;

// Patch createRenderRoot so that LitElement doesn't call browser DOM APIs
// during SSR (adoptStyles requires browser support).
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
  static matchesClass(ctor) {
    // This property must remain unminified.
    return ctor['_$litElement$'];
  }

  constructor(tagName) {
    super(tagName);
    this.element = new (customElements.get(this.tagName))();
  }

  get shadowRootOptions() {
    return (
      this.element.constructor.shadowRootOptions ?? super.shadowRootOptions
    );
  }

  connectedCallback() {
    const propertyValues = changedProperties(this.element);
    // Call LitElement's willUpdate — must not use DOM APIs.
    this.element?.['willUpdate'](propertyValues);
    // Reflect properties to attributes by calling ReactiveElement's update
    // (which only reflects attributes, does not touch the DOM).
    ReactiveElement.prototype['update'].call(this.element, propertyValues);
  }

  attributeChangedCallback(name, _old, value) {
    attributeToProperty(this.element, name, value);
  }

  renderShadow(renderInfo) {
    const result = [];

    // Render styles.
    const styles = this.element.constructor.elementStyles;
    if (styles !== undefined && styles.length > 0) {
      result.push('<style>');
      for (const style of styles) {
        result.push(style.cssText);
      }
      result.push('</style>');
    }

    // Render template.
    result.push(() => renderValue(this.element.render(), renderInfo));

    return result;
  }

  renderLight(renderInfo) {
    const result = this.element['renderLight']?.();
    if (result !== undefined) {
      return [() => renderValue(result, renderInfo)];
    }
    return undefined;
  }
}
