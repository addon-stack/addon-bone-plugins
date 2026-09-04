# @adnbn/plugin-reg-cs

Make your extension ready on first install, even when matching pages are already open.

[![npm version](https://img.shields.io/npm/v/%40adnbn%2Fplugin-reg-cs.svg?logo=npm&style=for-the-badge)](https://www.npmjs.com/package/@adnbn/plugin-reg-cs)
[![npm downloads](https://img.shields.io/npm/dm/%40adnbn%2Fplugin-reg-cs.svg?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@adnbn/plugin-reg-cs)
[![CI](https://img.shields.io/github/actions/workflow/status/addon-stack/addon-bone-plugins/ci.yml?style=for-the-badge)](https://github.com/addon-stack/addon-bone-plugins/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE.md)

## Purpose

`@adnbn/plugin-reg-cs` closes the install-time gap for declarative content scripts. On supported non-Firefox builds,
it performs one safe catch-up pass for eligible pages that finished loading before the extension was installed. Future
page loads continue to use the browser's native `content_scripts` behavior.

Use it when the first-run experience should work without asking the user to reload tabs that are already open.

## Installation

```sh
pnpm add @adnbn/plugin-reg-cs
```

## Quick start

```ts
import {defineConfig} from "adnbn";
import registerContentScript from "@adnbn/plugin-reg-cs";

export default defineConfig({
    plugins: [registerContentScript()],
});
```

The plugin has no runtime options. Keep defining content scripts through the normal Addon Bone entrypoints and manifest
contract.

## Permissions

The plugin adds the API permissions it needs through its Addon Bone background entrypoint. It does not request optional
permissions at runtime. The suggested justifications below describe this plugin's behavior; extend them if the consumer
extension uses the same permissions for other features.

### `tabs`

Added in Manifest V2 and V3. The plugin uses it during the initial installation to find matching tabs and exclude pages
that are still loading, discarded, or frozen. It does not subscribe to future navigation or read browser history.

Suggested store justification:

```text
The tabs permission is used only when the extension is first installed to find already-open, fully loaded tabs that
match its declared content scripts. The extension does not use this permission to read browsing history or monitor
future navigation.
```

### `scripting`

Added in Manifest V3. It allows the plugin to apply the extension's already-declared CSS and JavaScript files to
eligible tabs that were open before installation. Manifest V2 uses its native tab injection APIs instead.

Suggested store justification:

```text
The scripting permission is used only when the extension is first installed to apply its packaged, declarative
content scripts to matching pages that are already open. It does not execute remote code or inject outside the host
access and content-script files declared by the extension.
```

### Host access

The plugin does not add domains or request host access itself. Host access comes from the consumer extension's own
`content_scripts.matches` declarations. Addon Bone emits those patterns as `host_permissions` in Manifest V3 and as
regular permissions in Manifest V2. A declaration is skipped when its required host access is unavailable.

Baseline host-access justification:

```text
Host access is required to run the extension's declared content scripts and provide its on-page functionality on
matching sites. Access is limited to the URL patterns declared by the extension.
```

Adapt this baseline when Chrome Web Store or another browser marketplace asks for the extension's specific user-facing
purpose or data usage.

## How it works

On the initial install, the plugin:

1. reads `content_scripts` from the built manifest;
2. checks host access independently for every declaration;
3. finds matching, fully loaded, non-discarded, and non-frozen tabs, whether active or in the background;
4. applies the declaration's match, exclude, and glob rules;
5. injects the complete CSS file list before attempting the complete JavaScript file list.

Declarations run in manifest order. Eligible tabs within one declaration run independently, so one failed tab does
not stop the others. A CSS failure is logged but does not prevent the JavaScript attempt.

Firefox already catches up declarative content scripts during installation. The plugin uses Addon Bone's synchronous
build target and exits on Firefox to avoid duplicate execution.

## Behavior and limits

- Catch-up runs only for a fresh installation, not for an update or extension reload.
- The plugin never activates, reloads, unfreezes, or restores a discarded tab.
- Skipped tabs are not persisted or processed later.
- `all_frames` uses the browser's native all-frame target. Top-level URL matching is exact; child-frame matching is
  best effort without the `webNavigation` permission.
- `run_at` cannot replay a lifecycle point that has already passed, so it is not forwarded during catch-up.

Development, testing, and release infrastructure lives in the
[Addon Bone Plugins monorepo](https://github.com/addon-stack/addon-bone-plugins).
