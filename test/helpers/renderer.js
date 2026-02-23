/**
 * Renderer abstraction layer for testing both @lit-labs/ssr and lit-edge
 *
 * This allows the same tests to run against both implementations to verify
 * that lit-edge produces identical output to @lit-labs/ssr.
 *
 * Usage:
 *   const renderer = createRenderer(); // Uses TEST_IMPL env var
 *   const html = await renderer.renderToString(template);
 */

/**
 * Base renderer interface
 */
class Renderer {
  /**
   * Render a template to a complete HTML string
   * @param {TemplateResult} template - Lit template to render
   * @param {Object} options - Rendering options
   * @returns {Promise<string>} Rendered HTML
   */
  async renderToString(template, options = {}) {
    throw new Error('renderToString must be implemented by subclass');
  }

  /**
   * Render a template to a ReadableStream
   * @param {TemplateResult} template - Lit template to render
   * @param {Object} options - Rendering options
   * @returns {ReadableStream} Stream of HTML chunks
   */
  renderToStream(template, options = {}) {
    throw new Error('renderToStream must be implemented by subclass');
  }

  /**
   * Registers custom element components
   * @param {Map<string, CustomElementConstructor>} components - Map of tag names to constructors
   */
  registerComponents(components) {
    throw new Error('registerComponents must be implemented by subclass');
  }

  /**
   * Cleans up renderer state (optional)
   */
  cleanup() {
    // Optional cleanup hook
  }
}

/**
 * Renderer implementation using @lit-labs/ssr
 */
class LitSSRRenderer extends Renderer {
  async renderToString(template, options = {}) {
    const { render } = await import('@lit-labs/ssr');
    const { collectResult } = await import('@lit-labs/ssr/lib/render-result.js');

    const result = render(template, options);
    return collectResult(result);
  }

  renderToStream(template, options = {}) {
    // Note: @lit-labs/ssr uses Node.js streams, not Web Streams
    // We'll handle the conversion in tests if needed
    throw new Error('Stream rendering for @lit-labs/ssr not yet implemented');
  }

  registerComponents(components) {
    // @lit-labs/ssr uses global customElements
    for (const [name, ctor] of components) {
      if (!customElements.get(name)) {
        customElements.define(name, ctor);
      }
    }
  }
}

/**
 * Renderer implementation using lit-edge (our implementation)
 */
class LitEdgeRenderer extends Renderer {
  async renderToString(template, options = {}) {
    const { render } = await import('../../src/index.js');
    const { collectResult } = await import('../../src/lib/render-result.js');

    const result = render(template, options);
    return collectResult(result);
  }

  renderToStream(template, options = {}) {
    // Will use Web Streams ReadableStream
    throw new Error('Stream rendering for lit-edge not yet implemented');
  }

  registerComponents(components) {
    // lit-edge component registration (uses global customElements for now)
    for (const [name, ctor] of components) {
      if (!customElements.get(name)) {
        customElements.define(name, ctor);
      }
    }
  }
}

/**
 * Create a renderer instance based on environment or explicit choice
 * @param {string} implementation - 'lit-ssr' or 'lit-edge' (defaults to TEST_IMPL env var)
 * @returns {Renderer}
 */
export function createRenderer(implementation = process.env.TEST_IMPL || 'lit-edge') {
  if (implementation === 'lit-ssr') {
    return new LitSSRRenderer();
  } else if (implementation === 'lit-edge') {
    return new LitEdgeRenderer();
  } else {
    throw new Error(`Unknown renderer implementation: ${implementation}`);
  }
}

/**
 * Normalize HTML for comparison by removing:
 * - Extra whitespace between tags
 * - Line breaks
 * - Leading/trailing whitespace
 *
 * This ensures consistent comparison while preserving meaningful whitespace
 * inside text content.
 *
 * @param {string} html - HTML string to normalize
 * @returns {string} Normalized HTML
 */
export function normalizeHTML(html) {
  return html
    .trim()
    // Normalize line breaks to single spaces
    .replace(/\n/g, ' ')
    // Remove extra whitespace between tags
    .replace(/>\s+</g, '><')
    // Normalize whitespace within text content
    .replace(/\s+/g, ' ');
}

/**
 * Strip hydration markers from HTML output for testing
 *
 * Removes Lit SSR hydration markers to allow content comparison:
 * - <!--lit-part DIGEST--> and <!--/lit-part-->
 * - <!--lit-node INDEX-->
 * - <?>  (placeholder markers - note: not HTML comments!)
 *
 * This allows tests to focus on rendered content rather than marker format.
 *
 * @param {string} html - HTML string with hydration markers
 * @returns {string} HTML with markers removed
 */
export function stripHydrationMarkers(html) {
  return html
    // Remove lit-part markers with digest
    .replace(/<!--lit-part [^>]+?-->/g, '')
    // Remove lit-part closing markers
    .replace(/<!--\/lit-part-->/g, '')
    // Remove lit-node markers
    .replace(/<!--lit-node \d+-->/g, '')
    // Remove empty lit-part markers
    .replace(/<!--lit-part-->/g, '')
    // Remove placeholder markers (these are NOT HTML comments!)
    .replace(/<\?>/g, '');
}
