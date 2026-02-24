/**
 * @license
 * Copyright (c) 2019 Google LLC. SPDX-License-Identifier: BSD-3-Clause
 * Portions copyright (c) 2026 lit-ssr-edge contributors.
 *
 * Server-only template support for lit-ssr-edge.
 *
 * Server-only templates do not generate hydration markers and support
 * full document rendering including <html>, <head>, <body>, and <!DOCTYPE>.
 */
import { html as baseHtml } from 'lit-html';

const SERVER_ONLY = 1;

/**
 * @license
 * Copyright (c) 2019 Google LLC. SPDX-License-Identifier: BSD-3-Clause
 * Portions copyright (c) 2026 lit-ssr-edge contributors.
 *
 * A lit-html template that can only be rendered on the server, and cannot be
 * hydrated.
 *
 * These templates can be used for rendering full documents including the
 * doctype, and rendering into elements that Lit normally cannot, like
 * `<title>`, `<textarea>`, `<template>`, and non-executing `<script>` tags
 * like `<script type="text/json">`. They are also slightly more efficient than
 * normal Lit templates because the generated HTML doesn't include markers for
 * updating.
 *
 * Server-only templates can only be rendered on the server; they will throw
 * an Error if created in the browser.
 *
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {TemplateResult}
 */
export function html(strings, ...values) {
  const value = baseHtml(strings, ...values);
  value._$litServerRenderMode = SERVER_ONLY;
  return value;
}

/**
 * @license
 * Copyright (c) 2019 Google LLC. SPDX-License-Identifier: BSD-3-Clause
 * Portions copyright (c) 2026 lit-ssr-edge contributors.
 *
 * Returns true if the given template result is a normal (hydratable) lit-html
 * template, not a server-only template.
 *
 * Server-only templates are rendered once and don't create the marker comments
 * needed to identify and update their dynamic parts.
 *
 * @param {TemplateResult} template
 * @returns {boolean}
 */
export const isHydratable = (template) => {
  return template._$litServerRenderMode !== SERVER_ONLY;
};
