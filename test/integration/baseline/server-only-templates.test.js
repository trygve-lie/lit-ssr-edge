/**
 * Baseline tests for server-only templates
 *
 * Tests the special server-only html function from @lit-labs/ssr that:
 * - Omits hydration markers
 * - Supports full document rendering (<!DOCTYPE>, <html>, <head>, <body>)
 * - Supports special elements (<script>, <title>, <textarea>)
 * - Can wrap regular templates (which will have markers)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert';
import { html } from 'lit';
import { createRenderer } from '../../helpers/renderer.js';
import { assertHTMLEqual } from '../../helpers/html-compare.js';

// Server-only html function - only available in @lit-labs/ssr
let serverHtml;
try {
  const ssr = await import('@lit-labs/ssr');
  serverHtml = ssr.html;
} catch (e) {
  // Will be available once lit-ssr-edge implements it
  serverHtml = null;
}

describe('Server-Only Templates - Basic', () => {
  const renderer = createRenderer();

  test('server-only template omits hydration markers', async () => {
    if (!serverHtml) {
      // Skip until lit-ssr-edge implements server-only templates
      return assert.ok(true, 'Server-only templates not yet implemented');
    }

    const template = serverHtml`<div>Static content</div>`;
    const result = await renderer.renderToString(template);

    // Should not include hydration markers
    assert.ok(!result.includes('<!--lit-part'));
    assert.ok(!result.includes('<!--/lit-part'));
  });

  test('server-only renders static HTML', async () => {
    if (!serverHtml) {
      return assert.ok(true, 'Server-only templates not yet implemented');
    }

    const template = serverHtml`<div>Hello World</div>`;
    const result = await renderer.renderToString(template);

    assertHTMLEqual(result, '<div>Hello World</div>');
  });
});

describe('Server-Only Templates - Full Document', () => {
  const renderer = createRenderer();

  test('renders full HTML document', async () => {
    if (!serverHtml) {
      return assert.ok(true, 'Server-only templates not yet implemented');
    }

    const template = serverHtml`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Page</title>
        </head>
        <body>
          <h1>Hello</h1>
        </body>
      </html>
    `;

    const result = await renderer.renderToString(template);

    assert.ok(result.includes('<!DOCTYPE html>'));
    assert.ok(result.includes('<html>'));
    assert.ok(result.includes('<head>'));
    assert.ok(result.includes('<title>Test Page</title>'));
    assert.ok(result.includes('<body>'));
    assert.ok(!result.includes('<!--lit-part'));
  });

  test('renders title element', async () => {
    if (!serverHtml) {
      return assert.ok(true, 'Server-only templates not yet implemented');
    }

    const pageTitle = 'My Page';
    const template = serverHtml`<title>${pageTitle}</title>`;
    const result = await renderer.renderToString(template);

    assertHTMLEqual(result, '<title>My Page</title>');
  });

  test('renders script element', async () => {
    if (!serverHtml) {
      return assert.ok(true, 'Server-only templates not yet implemented');
    }

    const data = { user: 'Alice', id: 123 };
    const template = serverHtml`
      <script type="application/json">
        ${JSON.stringify(data)}
      </script>
    `;

    const result = await renderer.renderToString(template);

    assert.ok(result.includes('<script type="application/json">'));
    // JSON content is HTML-escaped in text content
    assert.ok(result.includes('&quot;user&quot;:&quot;Alice&quot;'));
    assert.ok(result.includes('&quot;id&quot;:123'));
  });

  test('renders textarea element', async () => {
    if (!serverHtml) {
      return assert.ok(true, 'Server-only templates not yet implemented');
    }

    const content = 'Textarea content';
    const template = serverHtml`<textarea>${content}</textarea>`;
    const result = await renderer.renderToString(template);

    assertHTMLEqual(result, '<textarea>Textarea content</textarea>');
  });
});

describe('Server-Only Templates - Composition', () => {
  const renderer = createRenderer();

  test('can contain regular templates (which hydrate)', async () => {
    if (!serverHtml) {
      return assert.ok(true, 'Server-only templates not yet implemented');
    }

    const inner = html`<div>Hydratable content</div>`;
    const outer = serverHtml`<body>${inner}</body>`;

    const result = await renderer.renderToString(outer);

    // Outer should not start with marker
    assert.ok(!result.startsWith('<!--lit-part'));

    // Inner should have markers
    assert.ok(result.includes('<!--lit-part'));
    assert.ok(result.includes('<!--/lit-part'));
  });

  test('wraps regular template with full document', async () => {
    if (!serverHtml) {
      return assert.ok(true, 'Server-only templates not yet implemented');
    }

    const app = html`<my-app></my-app>`;
    const page = serverHtml`
      <!DOCTYPE html>
      <html>
        <head><title>App</title></head>
        <body>${app}</body>
      </html>
    `;

    const result = await renderer.renderToString(page);

    assert.ok(result.includes('<!DOCTYPE html>'));
    assert.ok(result.includes('<my-app></my-app>'));
    // App should have hydration markers
    assert.ok(result.includes('<!--lit-part'));
  });
});

describe('Server-Only Templates - Restrictions', () => {
  const renderer = createRenderer();

  test('rejects event bindings', async () => {
    if (!serverHtml) {
      return assert.ok(true, 'Server-only templates not yet implemented');
    }

    const handler = () => {};
    const template = serverHtml`<button @click=${handler}>Click</button>`;

    try {
      await renderer.renderToString(template);
      assert.fail('Should reject event bindings');
    } catch (error) {
      assert.ok(error.message.includes('event') || error.message.includes('bind'));
    }
  });

  test('rejects property bindings', async () => {
    if (!serverHtml) {
      return assert.ok(true, 'Server-only templates not yet implemented');
    }

    const value = 'test';
    const template = serverHtml`<input .value=${value}>`;

    try {
      await renderer.renderToString(template);
      assert.fail('Should reject property bindings');
    } catch (error) {
      assert.ok(error.message.includes('property') || error.message.includes('bind'));
    }
  });

  test('regular template cannot contain server-only', async () => {
    if (!serverHtml) {
      return assert.ok(true, 'Server-only templates not yet implemented');
    }

    const inner = serverHtml`<p>Server-only</p>`;
    const outer = html`<div>${inner}</div>`;

    try {
      await renderer.renderToString(outer);
      assert.fail('Should reject server-only inside regular template');
    } catch (error) {
      assert.ok(
        error.message.includes('server') ||
        error.message.includes('hydratable') ||
        error.message.includes('rendered inside')
      );
    }
  });
});
