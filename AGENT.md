# lit-edge

**Server-side renderer for Lit web components targeting WinterTC-compatible runtimes.**

This project implements SSR for Lit components that runs on edge workers (Cloudflare Workers, Fastly Compute) and modern runtimes (Node.js 18+, Deno, Bun) using only Web Platform APIs. It's inspired by `@lit-labs/ssr` but built without Node.js dependencies.

## Quick Start: Where Should You Go?

Choose based on what you're here to do:

### 🏗️ **Implementing a Feature**
1. Read [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md) - Learn efficient navigation strategies
2. Read [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md) - Fast lookups for common patterns
3. Consult [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - Deep technical details as needed
4. Check [`docs/insight/`](docs/insight/) - Lit internals research (when you need deep understanding)

### 🐛 **Fixing a Bug**
1. Read the failing test
2. Check [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md) - Understand expected behavior
3. Read specific [`docs/insight/*.md`](docs/insight/) - If you need Lit internals knowledge

### 📊 **Understanding Performance**
1. Read [`docs/PHASE_1_COMPLETE.md`](docs/PHASE_1_COMPLETE.md) - Performance baselines and targets
2. Read [`test/performance/README.md`](test/performance/README.md) - How to run benchmarks

### 🏛️ **Understanding Architecture**
1. Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - Comprehensive architecture documentation
2. Review implementation phases and decision points

### 🧪 **Understanding Testing**
1. Read [`docs/STRATEGY_TESTING.md`](docs/STRATEGY_TESTING.md) - Testing strategy and patterns
2. Read [`docs/PHASE_0_ALIGNMENT.md`](docs/PHASE_0_ALIGNMENT.md) - Test alignment verification

## Goals

- **WinterTC-compatible:** Cloudflare Workers (no nodejs_compat), Fastly Compute, Node.js 18+, Deno, Bun
- **Web Platform APIs only:** ReadableStream, fetch(), TextEncoder (no Node.js APIs)
- **Modern JavaScript:** ES2026 features, ESM modules exclusively
- **Minimal dependencies:** Prefer Web Platform APIs, bundle only essential packages

## Non-Goals

- Full feature parity with `@lit-labs/ssr` (subset of features)
- VM-based isolation (use platform-provided isolation)
- Runtime module resolution (pre-bundled components)
- Legacy Node.js versions (< 18) or Node.js-specific APIs

## Documentation Map

### For Agents (AI/LLM)

**Start here:** [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md)
- Efficient navigation strategies
- Documentation tiers (Essential → Phase Status → Deep Knowledge)
- Common task workflows
- How to minimize token usage

**Quick lookups:** [`docs/QUICK_REFERENCE.md`](docs/QUICK_REFERENCE.md)
- Template system basics
- SSR opcode types
- Hydration markers
- WinterTC API allowlist
- Common patterns
- Implementation checklists

**Architecture details:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Rendering pipeline
- Module structure
- Core components
- Public API details
- Implementation phases
- Decision points

**Lit internals:** [`docs/insight/`](docs/insight/)
- Deep research on Lit SSR system
- Edge runtime compatibility
- Node.js dependency replacement
- Use only when deep understanding needed (high token cost)

### Project Status

**Current Phase:** Phase 3 Complete ✅

- ✅ **Phase 0:** Baseline integration tests (122 tests passing) — [`docs/PHASE_0_ALIGNMENT.md`](docs/PHASE_0_ALIGNMENT.md)
- ✅ **Phase 1:** Baseline performance tests (26 benchmarks, targets defined) — [`docs/PHASE_1_COMPLETE.md`](docs/PHASE_1_COMPLETE.md)
- ✅ **Phase 2:** Core rendering implementation (122/122 baseline tests passing) — [`docs/PHASE_2_COMPLETE.md`](docs/PHASE_2_COMPLETE.md)
- ✅ **Phase 3:** Hydration support (native digest + marker module, 51 new tests) — [`docs/PHASE_3_COMPLETE.md`](docs/PHASE_3_COMPLETE.md)
- ⏳ **Phase 4:** Component support — formalise LitElement rendering, remove dom-shim dep
- ⏳ **Phase 5:** Directive support — formalise all directives, add error for unsupported ones
- ⏳ **Phase 6:** Optimisation & polish

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full implementation roadmap.

## Key Constraints

**WinterTC APIs Only:**
- ✅ ReadableStream, TextEncoder, fetch(), URL
- ❌ stream.Readable, fs, path, vm, Buffer

**Target Runtimes:**
- Cloudflare Workers (no nodejs_compat needed)
- Fastly Compute
- Node.js 18+ LTS
- Deno, Bun

**Component Loading:**
- Pre-bundled at build time (no runtime resolution)
- Import bundle before rendering

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for detailed constraints and [`docs/insight/edge-runtimes.md`](docs/insight/edge-runtimes.md) for WinterTC compatibility details.

## External References

**Lit:**
- [Lit Documentation](https://lit.dev/docs/)
- [@lit-labs/ssr Source](https://github.com/lit/lit/tree/main/packages/labs/ssr)
- [@lit-labs/ssr-client Source](https://github.com/lit/lit/tree/main/packages/labs/ssr-client)

**WinterTC & Edge Runtimes:**
- [WinterTC Specification](https://min-common-api.proposal.wintertc.org/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Fastly Compute JavaScript](https://www.fastly.com/documentation/guides/compute/javascript/)

For comprehensive internal documentation, start with [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md).
