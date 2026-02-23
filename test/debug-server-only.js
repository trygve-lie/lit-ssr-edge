/**
 * Debug server-only template output
 */
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';

const { html: serverHtml } = await import('@lit-labs/ssr');

const data = { user: 'Alice', id: 123 };
const template = serverHtml`
  <script type="application/json">
    ${JSON.stringify(data)}
  </script>
`;

const result = render(template);
const html = await collectResult(result);

console.log('OUTPUT:');
console.log(html);
