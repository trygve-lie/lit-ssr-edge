/**
 * Core rendering engine for lit-ssr-edge.
 *
 * Implements template opcode generation (via parse5 AST traversal) and
 * opcode execution to produce streamed HTML output. Adapted from
 * @lit-labs/ssr but uses only Web Platform APIs.
 */
import { nothing, noChange } from 'lit';
import { PartType } from 'lit/directive.js';
import {
  isPrimitive,
  isTemplateResult,
  getDirectiveClass,
  TemplateResultType,
} from 'lit/directive-helpers.js';
import { _$LH } from 'lit-html/private-ssr-support.js';

const {
  getTemplateHtml,
  marker,
  markerMatch,
  boundAttributeSuffix,
  patchDirectiveResolve,
  getAttributePartCommittedValue,
  resolveDirective,
  AttributePart,
  PropertyPart,
  BooleanAttributePart,
  EventPart,
  connectedDisconnectable,
  isIterable,
} = _$LH;

import { digestForTemplateResult } from './digest.js';
import { openTemplatePart, openPart, closePart, nodeMarker } from './markers.js';
import { getElementRenderer } from './element-renderer.js';
import { escapeHtml } from './util/escape-html.js';
import { parseFragment, parse } from 'parse5';
import {
  isElementNode,
  isCommentNode,
  traverse,
  isTextNode,
  isTemplateNode,
} from '@parse5/tools';
import { isHydratable } from './server-template.js';
import { reflectedAttributeName } from './reflected-attributes.js';
import { validateDirectiveSupport } from './directives-validation.js';

/**
 * Patches a DirectiveResult's Directive class to call `render()` instead of
 * `update()` during SSR.
 */
function ssrResolve(_part, values) {
  return patchIfDirective(this.render(...values));
}

/**
 * Checks if a value is a DirectiveResult, validates it is SSR-compatible,
 * and patches its Directive class to call render() instead of update().
 *
 * Throws a descriptive error for known client-only directives (cache, live,
 * until, asyncAppend, asyncReplace, ref, templateContent).
 */
const patchIfDirective = (value) => {
  const directiveCtor = getDirectiveClass(value);
  if (directiveCtor !== undefined) {
    validateDirectiveSupport(directiveCtor);
    patchDirectiveResolve(directiveCtor, ssrResolve);
  }
  return value;
};

/**
 * Patches directive results in AttributePart values, which may be arrays.
 */
const patchAnyDirectives = (part, value, valueIndex) => {
  if (part.strings !== undefined) {
    for (let i = 0; i < part.strings.length - 1; i++) {
      patchIfDirective(value[valueIndex + i]);
    }
  } else {
    patchIfDirective(value);
  }
};

/**
 * Template opcode cache, keyed by TemplateStringsArray reference.
 * Shared across requests (templates are immutable).
 */
const templateCache = new WeakMap();

/**
 * Pattern matching top-level document tags that require full-document parsing.
 */
const REGEXP_TEMPLATE_HAS_TOP_LEVEL_PAGE_TAG =
  /^(\s|<!--[^(-->)]*-->)*(<(!doctype|html|head|body))/i;

/**
 * Generates and caches opcodes for a given TemplateResult.
 *
 * Opcodes are an array of instructions that guide rendering:
 * - `text`: emit a static string
 * - `child-part`: emit a dynamic child value
 * - `attribute-part`: emit a dynamic attribute
 * - `possible-node-marker`: conditionally emit a `<!--lit-node N-->` marker
 * - `custom-element-open/attributes/shadow/close`: render custom elements
 *
 * @param {TemplateResult} result
 * @returns {Array} Opcode list
 */
const getTemplateOpcodes = (result) => {
  const cached = templateCache.get(result.strings);
  if (cached !== undefined) {
    return cached;
  }

  const [html, attrNames] = getTemplateHtml(
    result.strings,
    // SVG namespace handling is only needed on the client; use HTML here.
    TemplateResultType.HTML
  );

  const hydratable = isHydratable(result);
  const htmlString = String(html);

  // Only server-only templates may contain top-level document tags.
  const isPageLevelTemplate =
    !hydratable && REGEXP_TEMPLATE_HAS_TOP_LEVEL_PAGE_TAG.test(htmlString);

  const ast = (isPageLevelTemplate ? parse : parseFragment)(htmlString, {
    sourceCodeLocationInfo: true,
  });

  const ops = [];
  let lastOffset = 0;
  let attrIndex = 0;

  /**
   * Advance lastOffset to `offset`, skipping the range in between.
   */
  const skipTo = (offset) => {
    if (offset < lastOffset) {
      throw new Error(
        `offset must be >= lastOffset.\n  offset: ${offset}\n  lastOffset: ${lastOffset}`
      );
    }
    lastOffset = offset;
  };

  /**
   * Append a string to the current `text` opcode, or create a new one.
   */
  const flush = (value) => {
    const op = ops.at(-1);
    if (op !== undefined && op.type === 'text') {
      op.value += value;
    } else {
      ops.push({ type: 'text', value });
    }
  };

  /**
   * Flush the HTML substring [lastOffset, offset) as a `text` opcode.
   */
  const flushTo = (offset) => {
    const previousLastOffset = lastOffset;
    lastOffset = offset ?? htmlString.length;
    const value = htmlString.substring(previousLastOffset, lastOffset);
    flush(value);
  };

  // Depth-first node index (comment + element nodes only), matching client lit-html.
  let nodeIndex = 0;

  traverse(ast, {
    'pre:node'(node, parent) {
      if (isCommentNode(node)) {
        if (node.data === markerMatch) {
          flushTo(node.sourceCodeLocation.startOffset);
          skipTo(node.sourceCodeLocation.endOffset);
          ops.push({
            type: 'child-part',
            index: nodeIndex,
            useCustomElementInstance:
              parent && isElementNode(parent) && parent.isDefinedCustomElement,
          });
        }
        nodeIndex++;
      } else if (isElementNode(node)) {
        let boundAttributesCount = 0;
        const tagName = node.tagName;

        if (
          node.parentNode &&
          isElementNode(node.parentNode) &&
          node.parentNode.isDefinedCustomElement
        ) {
          ops.push({
            type: 'slotted-element-open',
            name: node.attrs.find((a) => a.name === 'slot')?.value,
          });
        }

        if (tagName.indexOf('-') !== -1) {
          const ctor = customElements.get(tagName);
          if (ctor !== undefined) {
            node.isDefinedCustomElement = true;
            ops.push({
              type: 'custom-element-open',
              tagName,
              ctor,
              staticAttributes: new Map(
                node.attrs
                  .filter((attr) => !attr.name.endsWith(boundAttributeSuffix))
                  .map((attr) => [attr.name, attr.value])
              ),
            });
          }
        } else if (tagName === 'slot') {
          ops.push({
            type: 'slot-element-open',
            name: node.attrs.find((a) => a.name === 'name')?.value,
          });
        }

        const attrInfo = node.attrs.map((attr) => {
          const isAttrBinding = attr.name.endsWith(boundAttributeSuffix);
          const isElementBinding = attr.name.startsWith(marker);
          if (isAttrBinding || isElementBinding) {
            boundAttributesCount += 1;
          }
          return [isAttrBinding, isElementBinding, attr];
        });

        if (boundAttributesCount > 0 || node.isDefinedCustomElement) {
          flushTo(node.sourceCodeLocation.startTag.startOffset);
          ops.push({
            type: 'possible-node-marker',
            boundAttributesCount,
            nodeIndex,
          });
        }

        for (const [isAttrBinding, isElementBinding, attr] of attrInfo) {
          if (isAttrBinding || isElementBinding) {
            const strings = attr.value.split(marker);
            const attrSourceLocation =
              node.sourceCodeLocation.attrs[attr.name];
            const attrNameStartOffset = attrSourceLocation.startOffset;
            const attrEndOffset = attrSourceLocation.endOffset;

            flushTo(attrNameStartOffset);

            if (isAttrBinding) {
              const name = attrNames[attrIndex++];
              const [, prefix, caseSensitiveName] = /([.?@])?(.*)/.exec(name);

              if (!hydratable) {
                if (prefix === '.') {
                  throw new Error(
                    `Server-only templates can't bind to properties. Bind to attributes instead.`
                  );
                } else if (prefix === '@') {
                  throw new Error(
                    `Server-only templates can't bind to events.`
                  );
                }
              }

              ops.push({
                type: 'attribute-part',
                index: nodeIndex,
                name: caseSensitiveName,
                ctor:
                  prefix === '.'
                    ? PropertyPart
                    : prefix === '?'
                    ? BooleanAttributePart
                    : prefix === '@'
                    ? EventPart
                    : AttributePart,
                strings,
                tagName: tagName.toUpperCase(),
                useCustomElementInstance: node.isDefinedCustomElement,
              });
            } else {
              if (!hydratable) {
                throw new Error(
                  `Server-only templates don't support element parts.`
                );
              }
              ops.push({
                type: 'element-part',
                index: nodeIndex,
              });
            }

            skipTo(attrEndOffset);
          } else if (node.isDefinedCustomElement) {
            const attrSourceLocation =
              node.sourceCodeLocation.attrs[attr.name];
            flushTo(attrSourceLocation.startOffset);
            skipTo(attrSourceLocation.endOffset);
          }
        }

        if (node.isDefinedCustomElement) {
          flushTo(node.sourceCodeLocation.startTag.endOffset - 1);
          ops.push({ type: 'custom-element-attributes' });
          flush('>');
          skipTo(node.sourceCodeLocation.startTag.endOffset);
          ops.push({ type: 'custom-element-shadow' });
        } else if (
          !hydratable &&
          /^(title|textarea|script|style)$/.test(node.tagName)
        ) {
          const dangerous = isJavaScriptScriptTag(node);
          for (const child of node.childNodes) {
            if (!isTextNode(child)) {
              throw new Error(
                `Internal error: Unexpected child node inside raw text node.`
              );
            }
            const text = child.value;
            const textStart = child.sourceCodeLocation.startOffset;
            flushTo(textStart);
            const markerRegex = new RegExp(
              marker.replace(/\$/g, '\\$'),
              'g'
            );
            for (const mark of text.matchAll(markerRegex)) {
              flushTo(textStart + mark.index);
              if (dangerous) {
                throw new Error(
                  `Found binding inside an executable <script> tag in a server-only template.`
                );
              }
              if (node.tagName === 'style') {
                throw new Error(
                  `Found binding inside a <style> tag in a server-only template.`
                );
              }
              ops.push({
                type: 'child-part',
                index: nodeIndex,
                useCustomElementInstance: false,
              });
              skipTo(textStart + mark.index + mark[0].length);
            }
            flushTo(textStart + text.length);
          }
        } else if (!hydratable && isTemplateNode(node)) {
          traverse(node.content, this, node);
        }

        nodeIndex++;
      }
    },
    node(node) {
      if (!isElementNode(node)) {
        return;
      }
      if (node.isDefinedCustomElement) {
        ops.push({ type: 'custom-element-close' });
      } else if (node.tagName === 'slot') {
        ops.push({ type: 'slot-element-close' });
      }
      if (
        node.parentNode &&
        isElementNode(node.parentNode) &&
        node.parentNode.isDefinedCustomElement
      ) {
        ops.push({ type: 'slotted-element-close' });
      }
    },
  });

  // Flush remaining static HTML (e.g. closing tags).
  flushTo();

  templateCache.set(result.strings, ops);
  return ops;
};

/**
 * Renders a value to an array of strings and thunks (ThunkedRenderResult).
 *
 * @param {unknown} value - Value to render
 * @param {Object} renderInfo - Current render context
 * @param {boolean} [hydratable=true] - Whether to emit hydration markers
 * @returns {Array} ThunkedRenderResult
 */
export function renderValue(value, renderInfo, hydratable = true) {
  patchIfDirective(value);
  value = resolveDirective(
    connectedDisconnectable({ type: PartType.CHILD }),
    value
  );

  const result = [];

  if (value != null && isTemplateResult(value)) {
    if (hydratable) {
      result.push(openTemplatePart(digestForTemplateResult(value)));
    }
    result.push(() => renderTemplateResult(value, renderInfo));
    if (hydratable) {
      result.push(closePart);
    }
  } else {
    if (hydratable) {
      result.push(openPart());
    }
    if (
      value === undefined ||
      value === null ||
      value === nothing ||
      value === noChange
    ) {
      // render nothing
    } else if (!isPrimitive(value) && isIterable(value)) {
      for (const item of value) {
        result.push(() => renderValue(item, renderInfo, hydratable));
      }
    } else {
      result.push(
        escapeHtml(typeof value === 'string' ? value : String(value))
      );
    }
    if (hydratable) {
      result.push(closePart);
    }
  }

  return result;
}

/**
 * Renders a TemplateResult to a ThunkedRenderResult.
 *
 * @param {TemplateResult} result
 * @param {Object} renderInfo
 * @returns {Array} ThunkedRenderResult
 */
function renderTemplateResult(result, renderInfo) {
  const hydratable = isHydratable(result);
  const ops = getTemplateOpcodes(result);
  let partIndex = 0;
  const renderResult = [];

  for (const op of ops) {
    switch (op.type) {
      case 'text':
        renderResult.push(op.value);
        break;

      case 'child-part': {
        renderResult.push(() => {
          const value = result.values[partIndex++];
          let isValueHydratable = hydratable;
          if (isTemplateResult(value)) {
            isValueHydratable = isHydratable(value);
            if (!isValueHydratable && hydratable) {
              throw new Error(
                `A server-only template can't be rendered inside an ordinary, hydratable template.`
              );
            }
          }
          return renderValue(value, renderInfo, isValueHydratable);
        });
        break;
      }

      case 'attribute-part': {
        renderResult.push(() => {
          const statics = op.strings;
          const part = new op.ctor(
            { tagName: op.tagName },
            op.name,
            statics,
            connectedDisconnectable(),
            {}
          );
          const value =
            part.strings === undefined
              ? result.values[partIndex]
              : result.values;
          patchAnyDirectives(part, value, partIndex);
          let committedValue = noChange;
          if (!(part.type === PartType.EVENT)) {
            committedValue = getAttributePartCommittedValue(
              part,
              value,
              partIndex
            );
          }
          let attributeResult = undefined;
          if (committedValue !== noChange) {
            const instance = op.useCustomElementInstance
              ? renderInfo.customElementInstanceStack.at(-1)
              : undefined;
            if (part.type === PartType.PROPERTY) {
              attributeResult = renderPropertyPart(
                instance,
                op,
                committedValue
              );
            } else if (part.type === PartType.BOOLEAN_ATTRIBUTE) {
              attributeResult = renderBooleanAttributePart(
                instance,
                op,
                committedValue
              );
            } else {
              attributeResult = renderAttributePart(
                instance,
                op,
                committedValue
              );
            }
          }
          partIndex += statics.length - 1;
          return attributeResult;
        });
        break;
      }

      case 'element-part': {
        renderResult.push(() => {
          partIndex++;
        });
        break;
      }

      case 'custom-element-open': {
        renderResult.push(() => {
          const instance = getElementRenderer(
            renderInfo,
            op.tagName,
            op.ctor,
            op.staticAttributes
          );
          for (const [name, value] of op.staticAttributes) {
            instance.setAttribute(name, value);
          }
          renderInfo.customElementInstanceStack.push(instance);
        });
        break;
      }

      case 'custom-element-attributes': {
        renderResult.push(() => {
          const instance = renderInfo.customElementInstanceStack.at(-1);
          if (instance === undefined) {
            throw new Error(
              `Internal error: ${op.type} outside of custom element context`
            );
          }
          instance.connectedCallback();
          let attrResult = instance.renderAttributes();
          if (
            renderInfo.deferHydration ||
            renderInfo.customElementHostStack.length > 0
          ) {
            attrResult = attrResult.concat(' defer-hydration');
          }
          return attrResult;
        });
        break;
      }

      case 'possible-node-marker': {
        renderResult.push(() => {
          if (
            (op.boundAttributesCount > 0 ||
              renderInfo.customElementHostStack.length > 0) &&
            hydratable
          ) {
            return nodeMarker(op.nodeIndex);
          }
          return undefined;
        });
        break;
      }

      case 'custom-element-shadow': {
        renderResult.push(() => {
          const instance = renderInfo.customElementInstanceStack.at(-1);
          if (instance === undefined) {
            throw new Error(
              `Internal error: ${op.type} outside of custom element context`
            );
          }
          renderInfo.customElementHostStack.push(instance);
          const shadowContents = instance.renderShadow(renderInfo);
          const shadowResult = [];
          if (shadowContents !== undefined) {
            const { mode = 'open', delegatesFocus } =
              instance.shadowRootOptions ?? {};
            const delegatesfocusAttr = delegatesFocus
              ? ' shadowrootdelegatesfocus'
              : '';
            shadowResult.push(
              `<template shadowroot="${mode}" shadowrootmode="${mode}"${delegatesfocusAttr}>`
            );
            shadowResult.push(() => shadowContents);
            shadowResult.push('</template>');
            shadowResult.push(() => {
              renderInfo.customElementHostStack.pop();
            });
          }
          return shadowResult;
        });
        break;
      }

      case 'custom-element-close':
        renderResult.push(() => {
          renderInfo.customElementInstanceStack.pop();
        });
        break;

      case 'slot-element-open': {
        renderResult.push(() => {
          // Track slots for event path calculation (future use).
        });
        break;
      }

      case 'slot-element-close':
        renderResult.push(() => {});
        break;

      case 'slotted-element-open':
        renderResult.push(() => {
          renderInfo.slotStack.push(op.name);
        });
        break;

      case 'slotted-element-close':
        renderResult.push(() => {
          renderInfo.slotStack.pop();
        });
        break;

      default:
        throw new Error(`Internal error: unknown opcode type "${op.type}"`);
    }
  }

  renderResult.push(() => {
    if (partIndex !== result.values.length) {
      throw new Error(
        `Unexpected final partIndex: ${partIndex} !== ${result.values.length} while processing template:\n\n    ${result.strings.join('${...}')}`
      );
    }
  });

  return renderResult;
}

function renderPropertyPart(instance, op, value) {
  value = value === nothing ? undefined : value;
  const reflectedName = reflectedAttributeName(op.tagName, op.name);
  if (instance !== undefined) {
    instance.setProperty(op.name, value);
  }
  return reflectedName !== undefined
    ? `${reflectedName}="${escapeHtml(
        typeof value === 'string' ? value : String(value)
      )}"`
    : undefined;
}

function renderBooleanAttributePart(instance, op, value) {
  if (value && value !== nothing) {
    if (instance !== undefined) {
      instance.setAttribute(op.name, '');
    } else {
      return op.name;
    }
  }
  return undefined;
}

function renderAttributePart(instance, op, value) {
  if (value !== nothing) {
    value =
      typeof value === 'string'
        ? value
        : value == null || value === noChange
        ? ''
        : String(value);
    if (instance !== undefined) {
      instance.setAttribute(op.name, value);
    } else {
      return `${op.name}="${escapeHtml(value)}"`;
    }
  }
  return undefined;
}

/**
 * Returns true if the node is a <script> tag that the browser will execute.
 */
function isJavaScriptScriptTag(node) {
  if (!/script/i.test(node.tagName)) {
    return false;
  }
  let safeTypeSeen = false;
  for (const attr of node.attrs) {
    if (attr.name !== 'type') continue;
    switch (attr.value) {
      case null:
      case undefined:
      case '':
      case 'module':
      case 'text/javascript':
      case 'application/javascript':
      case 'application/ecmascript':
      case 'application/x-ecmascript':
      case 'application/x-javascript':
      case 'text/ecmascript':
      case 'text/javascript1.0':
      case 'text/javascript1.1':
      case 'text/javascript1.2':
      case 'text/javascript1.3':
      case 'text/javascript1.4':
      case 'text/javascript1.5':
      case 'text/jscript':
      case 'text/livescript':
      case 'text/x-ecmascript':
      case 'text/x-javascript':
        return true;
      default:
        safeTypeSeen = true;
    }
  }
  return !safeTypeSeen;
}
