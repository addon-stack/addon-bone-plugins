# @adnbn/plugin-reg-cs

Make your extension ready on first install, even when matching pages are already open.

[![npm version](https://img.shields.io/npm/v/%40adnbn%2Fplugin-reg-cs.svg?logo=npm&style=for-the-badge)](https://www.npmjs.com/package/@adnbn/plugin-reg-cs)
[![npm downloads](https://img.shields.io/npm/dm/%40adnbn%2Fplugin-reg-cs.svg?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@adnbn/plugin-reg-cs)
[![CI](https://img.shields.io/github/actions/workflow/status/addon-stack/addon-bone-plugins/ci.yml?style=for-the-badge)](https://github.com/addon-stack/addon-bone-plugins/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE.md)

## Purpose

`@adnbn/plugin-reg-cs` closes the install-time gap for declarative content scripts. On supported non-Firefox builds,
it performs a safe catch-up pass for eligible pages that finished loading before the extension was installed. If a
matching Chrome tab is frozen during installation, the plugin remembers it for the current browser session and catches
it up after Chrome unfreezes it. Future page loads continue to use the browser's native `content_scripts` behavior.

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

The plugin's manifest hook adds only the browser- and manifest-specific permissions described below. It does not add
the `tabs` permission: the consumer's existing content-script host access is sufficient to find and inspect matching
tabs. It does not request optional permissions at runtime. The suggested justifications describe this plugin's
behavior; extend them if the consumer extension uses the same permissions for other features.

### `scripting`

Added in Manifest V3 on supported non-Firefox builds. It allows the plugin to apply the extension's already-declared
CSS and JavaScript files to eligible tabs that were open before installation, including frozen tabs after Chrome
unfreezes them. Manifest V2 uses its native tab injection APIs instead.

Suggested store justification:

```text
The scripting permission is used during install-time catch-up to apply the extension's packaged, declarative content
scripts to matching pages that were already open, including frozen pages after the browser unfreezes them. It does not
execute remote code or inject outside the host access and content-script files declared by the extension.
```

### `storage`

Added only in Manifest V3 on supported non-Firefox builds. The plugin stores pending frozen tabs in `storage.session`
so the queue survives service-worker restarts without surviving the browser session. Each entry contains only a tab
ID, the URL used to prevent stale injection, and the indexes of matching content-script declarations. The data is not
written to local or synchronized storage and is removed as soon as the tab is processed or becomes ineligible.

Suggested store justification:

```text
The storage permission is used only for session-scoped install catch-up. If a matching tab is frozen when the
extension is installed, the extension temporarily stores its tab ID, URL, and declared content-script indexes so it
can finish the injection after the browser unfreezes that tab. The data is deleted when catch-up finishes and is not
used to store or synchronize browsing history.
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
3. finds matching, fully loaded, non-discarded tabs, whether active or in the background;
4. applies the declaration's match, exclude, and glob rules;
5. injects immediately into unfrozen tabs and saves frozen tabs in a session-scoped pending queue;
6. when a pending tab unfreezes, rechecks its current URL, manifest declaration, and host access before injection;
7. removes the temporary tab listeners as soon as the pending queue is empty.

Declarations run in manifest order. Eligible tabs within one declaration run independently, so one failed tab does
not stop the others. Within one tab, the complete CSS file list is awaited before the complete JavaScript file list is
attempted. A CSS failure is logged but does not prevent the JavaScript attempt.

Firefox already catches up declarative content scripts during installation. The plugin uses Addon Bone's synchronous
build target and exits on Firefox to avoid duplicate execution.

## Behavior and limits

- Catch-up runs only for a fresh installation, not for an update or extension reload.
- The plugin never activates, reloads, unfreezes, or restores a discarded tab.
- Manifest V2 Chromium builds perform immediate catch-up only and do not use `storage.session` or deferred listeners.
- A matching frozen tab is retained only in `storage.session`. Navigating, loading, discarding, or closing it removes
  its pending entry; the browser's native declarative content-script behavior handles a new document load.
- If a frozen tab changes documents during the brief scan between two content-script declarations, a later declaration
  may be queued for that new document after its native content script has already run. This requires a thaw and
  navigation during the install pass and can duplicate that declaration once.
- Pending work is claimed before the plugin's programmatic injection to avoid duplicate attempts from repeated tab
  events. If a browser process terminates in that narrow interval, the claimed attempt cannot be replayed.
- `all_frames` uses the browser's native all-frame target. Top-level URL matching is exact; child-frame matching is
  best effort without the `webNavigation` permission.
- `run_at` cannot replay a lifecycle point that has already passed, so it is not forwarded during catch-up.

Development, testing, and release infrastructure lives in the
[Addon Bone Plugins monorepo](https://github.com/addon-stack/addon-bone-plugins).
