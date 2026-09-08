# @adnbn/plugin-remote-config

Keep your extension configured through a remote JSON endpoint, with a persistent cache that remains useful when
updates fail.

[![npm version](https://img.shields.io/npm/v/%40adnbn%2Fplugin-remote-config.svg?logo=npm&style=for-the-badge)](https://www.npmjs.com/package/@adnbn/plugin-remote-config)
[![npm downloads](https://img.shields.io/npm/dm/%40adnbn%2Fplugin-remote-config.svg?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@adnbn/plugin-remote-config)
[![CI](https://img.shields.io/github/actions/workflow/status/addon-stack/addon-bone-plugins/ci.yml?style=for-the-badge)](https://github.com/addon-stack/addon-bone-plugins/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE.md)

## Purpose

Read remote JSON from background scripts, content scripts, extension pages, or React components. The background
service merges responses with defaults and keeps the last working configuration when updates fail.

## Installation

```sh
pnpm add @adnbn/plugin-remote-config
```

## Quick start

```ts
import {defineConfig} from "adnbn";
import remoteConfig from "@adnbn/plugin-remote-config";

export default defineConfig({
    plugins: [remoteConfig({
        url: "https://example.com/config.json",
    })],
});
```

Read the configuration from any extension layer:

```ts
import {getRemoteConfig} from "@adnbn/plugin-remote-config/api";

const config = await getRemoteConfig();
```

## Permissions

On Chrome and Firefox MV2/MV3, the plugin adds `storage` and host access for the resolved endpoint. It adds no other
permissions or optional permission requests. With no endpoint, only `storage` is declared and reads return defaults.

### `storage`

Caches the response, URL, and refresh metadata in ordinary `storage.local` under `@adnbn/plugin-remote-config:cache`.
The cache is neither encrypted nor synchronized.

Suggested store justification:

```text
The storage permission caches remote configuration and refresh metadata locally so configured features keep working
when the server is unavailable. This data is not synchronized between devices.
```

### Endpoint host access

An endpoint such as `https://example.com/config.json` adds `https://example.com/*`: `host_permissions` in MV3 and
`permissions` in MV2. Access covers the host, not just the JSON path.

Suggested store justification:

```text
Host access lets the extension's background service retrieve JSON settings from its configuration server to configure
its features. The response contains data, not executable code.
```

### Consumer-owned access

Other hosts, including redirect destinations, require consumer-owned access. Custom CSP must permit the request.
Adapt the store justifications if your extension uses these permissions for additional features.

## How it works

- Options and environment values are resolved once at builder startup.
- Reads use the same-URL cache until TTL expires; the next read refreshes it. Concurrent reads share one request.
- Successful responses merge deeply with the original defaults, never with previous remote values. Missing fields
  keep defaults; arrays replace whole; `false`, `0`, `""`, and `null` are preserved. An empty object restores defaults.
- Failed refreshes retain the last working response, or defaults if none exists. Without either, reads return `{}`.
  Retries respect `retryDelay`.
  There is no background polling or maximum stale-cache age.

For example, defaults `{banner: {enabled: false, text: "default"}}` plus `{banner: {text: "new"}}` produce
`{banner: {enabled: false, text: "new"}}`.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `url` | `"REMOTE_CONFIG_URL"` | HTTP(S) URL or environment variable name. `""` disables the endpoint. |
| `config` | `{}` | Optional, deeply partial defaults matching your `RemoteConfig` schema. |
| `ttl` | `1440` | Cache freshness in minutes. Zero refreshes on every read, subject to retry delay. |
| `timeout` | `10000` | Request and JSON-body timeout in milliseconds. Must be positive and within timer limits. |
| `retryDelay` | `60000` | Delay after a failed refresh, in milliseconds. Zero disables it. |
| `credentials` | `"omit"` | `"omit"`, `"same-origin"`, or `"include"`; use `"include"` for cookie authentication. |

Each option accepts a build-time getter. Numbers must be finite; TTL and retry delay cannot be negative.
`remoteConfig()` uses `REMOTE_CONFIG_URL` without requiring defaults. Omitting `config`, passing `undefined`, or
returning `undefined` from its getter uses `{}`; explicit `null` or an array is not a valid defaults object.
A missing environment variable warns at startup and disables fetching. An empty URL or a URL getter returning
`undefined` disables it silently. Changing the URL invalidates the previous cache.

## TypeScript and selection

Augment the public interface in a declaration file included by your project:

```ts
import "@adnbn/plugin-remote-config";

declare module "@adnbn/plugin-remote-config" {
    interface RemoteConfig {
        featureFlag: boolean;
    }
}
```

`getRemoteConfig` accepts no argument, a typed dot path, or a selector. It also awaits async selectors:

```ts
const config = await getRemoteConfig(); // RemoteConfig
const enabled = await getRemoteConfig("featureFlag"); // boolean
const label = await getRemoteConfig(config => config.featureFlag ? "on" : "off");
```

Defaults may omit required root and nested fields; supplied values must match the schema. For fields with no default
that may be absent before loading or when requests fail, prefer optional properties (`field?: ...`). Arrays and tuples, when
supplied, retain their element types. Paths support numeric array indices
(`banners.0.title`) and up to ten recursive steps; broad, deep schemas can increase type-checking time. Optional or
nullable branches and unbounded array indices can yield `undefined`.
Dictionary lookups also include `undefined`. Result types follow your interface and the standard type-fest `Get`
behavior, independently of defaults. An absent value returns `undefined` at runtime even if declared required.

Use selectors for keys containing dots, brackets, or backslashes, reserved keys (`__proto__`, `prototype`,
`constructor`), and values typed as `unknown` or `any`. Selection is local and always reads the full service result.
`getRemoteConfigOptions()` exposes resolved build-time options; `/service` is the framework's background entrypoint.

## React

React is an optional peer, used only by `/react`. The hook accepts the same paths and selectors:

```tsx
import {useRemoteConfig} from "@adnbn/plugin-remote-config/react";

function Feature() {
    const enabled = useRemoteConfig("featureFlag");

    return <span>{enabled ? "Enabled" : "Disabled"}</span>;
}
```

The hook starts with defaults or `{}`, fetches on mount, and ignores results after unmounting. Missing dot paths
initially return `undefined`. Changing the selection uses
current state without refetching. Selectors must be synchronous; the hook neither polls nor subscribes to updates.

## Limits and upgrading

- TypeScript checks supplied defaults, not server data or the presence of required fields at runtime. Selectors
  receive an object but can throw when directly accessing an absent nested branch; use optional chaining as needed.
  Responses must be JSON objects with values matching your schema;
  explicit `null` replaces a default, and replacement array elements must contain their required fields.
- Results are independent copies. Network and storage failures are handled separately; failed persistence leaves an
  in-memory cache, but configuration and retry metadata may be lost after a service-worker restart.
- **Upgrading from 0.3.x:** use `/react` instead of `/hooks` and augment `RemoteConfig` instead
  of overriding it with a generic. Old caches are not migrated. Credentials now default to `"omit"`.

For development, testing, and releases, see the
[monorepo contributing guide](https://github.com/addon-stack/addon-bone-plugins/blob/main/CONTRIBUTING.md).
