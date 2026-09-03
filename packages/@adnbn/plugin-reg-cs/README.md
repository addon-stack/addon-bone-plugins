# @adnbn/plugin-reg-cs

[![npm version](https://img.shields.io/npm/v/@adnbn/plugin-reg-cs.svg?logo=npm)](https://www.npmjs.com/package/@adnbn/plugin-reg-cs)
[![npm downloads](https://img.shields.io/npm/dm/@adnbn/plugin-reg-cs.svg)](https://www.npmjs.com/package/@adnbn/plugin-reg-cs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![CI](https://github.com/addon-stack/addon-bone-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/addon-stack/addon-bone-plugins/actions/workflows/ci.yml)

An Addon Bone plugin that activates declarative content scripts in loaded tabs that were already open when the
extension was first installed. Normal browser navigation continues to use the manifest's native `content_scripts`
behavior.

## Installation

```sh
pnpm add @adnbn/plugin-reg-cs
```

## Usage

```ts
import registerContentScript from "@adnbn/plugin-reg-cs";
import {defineConfig} from "adnbn";

export default defineConfig({
    plugins: [registerContentScript()],
});
```

The plugin intentionally has no runtime options. On a fresh installation it:

1. reads the native `content_scripts` declarations from the built manifest;
2. checks host permissions independently for each declaration;
3. finds completely loaded, non-discarded, non-frozen tabs matching that declaration, whether active or in the background;
4. applies `exclude_matches`, `include_globs`, and `exclude_globs` to the tab URL;
5. injects the declaration's CSS and JavaScript.

Firefox already activates declarative content scripts in existing tabs during installation, so the plugin detects that
build target synchronously through Addon Bone's `getBrowser()` and exits to avoid running every content script twice.

Chromium catch-up skips discarded, frozen, and still-loading tabs. Frozen tabs retain their contents in memory but
cannot execute tasks; discarded tabs have already had their contents unloaded from memory. The plugin does not
activate, reload, or unfreeze tabs to inject into them. Skipped tabs are not persisted or processed later. A future
opt-in mode may add deferred activation without changing this default behavior. See the
[Chrome tab lifecycle properties](https://developer.chrome.com/docs/extensions/reference/api/tabs#type-Tab).

The plugin never requests permissions and does not wait for optional host permissions granted after installation.

## Execution guarantees

Manifest declarations are processed sequentially in their declared order. For every matching tab, CSS is awaited
before JavaScript is attempted. The full CSS or JavaScript file array is passed to the corresponding injection package,
which preserves its order. A CSS failure is logged but does not block the JavaScript attempt. Independent eligible tabs
from the same declaration run concurrently, and one failed tab does not stop the others.

`all_frames` uses the browser's native all-frames injection target. Matching is exact for the top-level tab URL and
best-effort for its child frames; the plugin does not request `webNavigation` or enumerate frames.

`run_at` cannot replay a lifecycle point that passed before installation, so it is not forwarded during this catch-up
injection. Future page loads still follow the native manifest declaration.

## Runtime requirements

Development and consumer builds require Node.js 24 or newer. URL matching uses `webext-patterns@3`, whose
`RegExp.escape` dependency sets the minimum browser runtime to Chromium 136, Firefox 134, and Safari 18.2.

The background entrypoint declares only `tabs` and `scripting`; Addon Bone translates the API permissions for the
selected manifest version. The extension still needs the host access implied by its own content-script declarations.

## Package format

The implementation is published as raw TypeScript under `plugin/`, together with generated declarations under
`dist-types/`. Addon Bone owns all consumer-side production transpilation and bundling. This package has no JavaScript
build target and intentionally does not use Vite, Vitest, Rsbuild, or Rspack. Jest and its SWC transform are test-only.

Development and release infrastructure lives in the
[Addon Bone Plugins monorepo](https://github.com/addon-stack/addon-bone-plugins).
