# @adnbn/plugin-remote-config

Keep your extension configured through a remote JSON endpoint, with a persistent cache that remains useful when
updates fail.

[![npm version](https://img.shields.io/npm/v/%40adnbn%2Fplugin-remote-config.svg?logo=npm&style=for-the-badge)](https://www.npmjs.com/package/@adnbn/plugin-remote-config)
[![npm downloads](https://img.shields.io/npm/dm/%40adnbn%2Fplugin-remote-config.svg?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@adnbn/plugin-remote-config)
[![CI](https://img.shields.io/github/actions/workflow/status/addon-stack/addon-bone-plugins/ci.yml?style=for-the-badge)](https://github.com/addon-stack/addon-bone-plugins/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE.md)

## Purpose

Fetch configuration through an Addon Bone background service and read it from background scripts, content scripts,
extension pages, or React components. Successful responses are merged with your defaults. Failed updates retain the
last working configuration, including after a browser or service-worker restart when persistence is available.

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
        config: {featureFlag: false},
    })],
});
```

Read the current configuration from any extension layer:

```ts
import {getRemoteConfig} from "@adnbn/plugin-remote-config/api";

const config = await getRemoteConfig<{featureFlag: boolean}>();
```

## Permissions

The plugin service declares `storage` on Chrome and Firefox, in both Manifest V2 and V3. The manifest hook adds host
access for the resolved HTTP(S) configuration endpoint. It adds no `tabs`, `scripting`, `cookies`, `alarms`, or
`unlimitedStorage` permission and does not request optional permissions at runtime.

### `storage`

The service saves the remote JSON response, its source URL, last successful update time, and retry deadline in
`storage.local`, with namespace `@adnbn/plugin-remote-config` and key `cache`. The native storage key is
`@adnbn/plugin-remote-config:cache`. Data is not encrypted or synchronized. The saved response is merged with the
current build's defaults when read. One storage write updates the accepted response and its metadata together.

Suggested store justification:

```text
The storage permission is used to cache the extension's remote configuration and update metadata locally. This lets
configured features keep working when the configuration endpoint is unavailable and avoids repeated failed requests.
The cache is not synchronized between devices.
```

### Automatically added host access

The plugin adds the endpoint's scheme and hostname as a match pattern, for example `https://example.com/*`. Addon Bone
emits it in `host_permissions` for MV3 and in `permissions` for MV2. Query parameters and URL credentials do not belong
in permission patterns. Browser network host access applies to the host, rather than only the JSON file's path.

Suggested store justification:

```text
Host access to the configuration server is used by the extension's background service to retrieve JSON configuration
for its configured features. The response supplies data and settings, not executable extension code.
```

Adapt the justification to describe your extension's actual features. Requests retain the existing
`credentials: "include"` behavior; applicable cookies may accompany them according to browser rules.

### Consumer-owned host access

The plugin adds access to its own endpoint. Other hosts used by the consumer remain the consumer's responsibility,
including any additional origins required by redirects. A custom CSP must permit the request through `connect-src`
or its applicable fallback. With no resolved endpoint, no host permission is added; the service still declares
`storage`, while reads return defaults without storage or network access.

## How it works

1. The `startup` hook resolves options and environment values once when the builder starts. The manifest and runtime
   share these values, including during watch rebuilds.
2. The background service reads the persisted configuration for the same endpoint URL.
3. A fresh cached response is merged with defaults and returned without a request.
4. Once TTL expires, the next read attempts an update. Concurrent reads share that attempt.
5. A successful JSON object replaces the previous remote response and is merged shallowly with defaults.
6. A failed request returns the last working configuration; defaults are used when no working response is available.
7. Failed attempts wait for the configured retry delay before another read can retry. No periodic polling is started.

TTL controls freshness, not whether a cached configuration is usable. Failed updates do not advance the success time.
The timeout covers both the request and reading its JSON body. A storage read failure still allows a network request;
a write failure retains a successful result in memory, with persistence available again on a later successful write.

### Partial responses

Every successful response uses `{...defaults, ...response}`. Previous remote values do not participate in that merge.
An empty object is a valid successful response and restores the defaults. Nested objects and arrays are replaced
whole; explicit `false`, `0`, empty strings, and `null` are retained.

For example, defaults `{enabled: false, label: "default"}` and a previous response `{enabled: true, label: "old"}`
produce `{enabled: false, label: "new"}` after a successful response `{label: "new"}`. A failed request retains the
previous working result instead.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `url` | `"REMOTE_CONFIG_URL"` | HTTP(S) URL or environment variable name; an empty string disables the endpoint. |
| `config` | `{}` | Default JSON object, shallowly merged with each accepted response. |
| `ttl` | `1440` | Freshness in minutes. Zero refreshes on each read, subject to failed-request retry delay. |
| `timeout` | `10000` | Request and JSON-body timeout in milliseconds; must be positive and within browser timer limits. |
| `retryDelay` | `60000` | Delay after a failed attempt, in milliseconds. Zero permits the next read to retry immediately. |

Each option also accepts a build-time getter. Numeric options must be finite; TTL and retry delay must be
non-negative. Environment variables that are not defined leave the endpoint disabled. URL changes invalidate the
previous source's cache and retry deadline. Defaults are read from the current build.

## React

```tsx
import {useRemoteConfig} from "@adnbn/plugin-remote-config/hooks";

function Feature() {
    const enabled = useRemoteConfig<{featureFlag: boolean}, boolean>(config => config.featureFlag);

    return <span>{enabled ? "Enabled" : "Disabled"}</span>;
}
```

The hook starts with defaults and requests the current configuration when mounted. It supports an optional selector
and ignores results after unmounting. It does not subscribe to later service updates or poll the endpoint.

## TypeScript

Augment the public interface once in a declaration file included by your consumer:

```ts
import "@adnbn/plugin-remote-config";

declare module "@adnbn/plugin-remote-config" {
    interface RemoteConfig {
        featureFlag: boolean;
    }
}
```

Both `getRemoteConfig()` and `useRemoteConfig()` then use the augmented interface. `getRemoteConfigOptions()` remains
available from `/api` to read build-time options. `/service` remains the background service entrypoint.

## Guarantees and limitations

- Requests and persisted state are owned by one background service. Direct callers receive independent result objects.
- The response must be a JSON object. TypeScript types do not validate application-specific field values at runtime.
- Cached data can remain stale indefinitely while updates fail. There is no maximum offline lifetime.
- If storage is unavailable, only the current service instance can retain successful values. A restart then requires
  working storage, a successful request, or defaults.
- Retry deadlines are persisted on a best-effort basis. Storage failures or manual cache clearing can allow another
  attempt after a service restart.
- **Breaking storage change:** older encrypted and non-namespaced caches are not read or migrated. When upgrading
  from those versions, defaults are used until the first successful remote request. Only the ordinary namespaced
  `cache` record is used.
- Standalone source checking uses a development-only service registry declaration. Consumers receive their real
  service registry from Addon Bone; the development declaration is excluded from the npm tarball.

Development, testing, and release infrastructure lives in the
[Addon Bone Plugins monorepo](https://github.com/addon-stack/addon-bone-plugins).
