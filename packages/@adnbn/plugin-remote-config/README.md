# @adnbn/plugin-remote-config

[![npm version](https://img.shields.io/npm/v/@adnbn/plugin-remote-config.svg)](https://www.npmjs.com/package/@adnbn/plugin-remote-config)
[![npm downloads](https://img.shields.io/npm/dm/@adnbn/plugin-remote-config.svg)](https://www.npmjs.com/package/@adnbn/plugin-remote-config)

Remote configuration plugin for [Addon Bone](https://github.com/addonbone).

## Features

- Fetch JSON configuration from a remote endpoint with transparent caching.
- Configurable cache time-to-live (TTL) in minutes.
- Fallback to default configuration on failure.
- Access configuration in background scripts, content scripts, or service workers.
- React context provider and hook for easy consumption in React apps.

## Installation

Using npm:

```bash
 npm install @adnbn/plugin-remote-config
```

Using Yarn:

```bash
 yarn add @adnbn/plugin-remote-config
```

## Usage

### Plugin Configuration

In your Addon Bone config (e.g., `adnbn.config.ts`), register the plugin:

```ts
import {defineConfig} from "adnbn";
import remoteConfig from "@adnbn/plugin-remote-config";

export default defineConfig({
    plugins: [
        remoteConfig({
            url: "https://example.com/config.json", // or an env var name
            ttl: 60, // cache TTL in minutes (default: 1440)
            config: {
                // default/fallback config
                featureFlag: false,
                apiEndpoint: "https://api.example.com",
            },
        }),
    ],
});
```

### Accessing Configuration

#### In a content script, background, or any other extension layer

```ts
import {getRemoteConfig} from "@adnbn/plugin-remote-config/api";

async function initialize() {
    try {
        const config = await getRemoteConfig<{apiEndpoint: string; featureFlag: boolean}>();
        console.log("Remote config:", config);
    } catch (error) {
        console.error("Failed to load remote config:", error);
    }
}
```

#### In React

Wrap your application with the `RemoteConfigProvider`, then use the `useRemoteConfig` hook:

```tsx
import React, {FC} from "react";
import ReactDOM from "react-dom";
import {RemoteConfigProvider} from "@adnbn/plugin-remote-config/react";
import App from "./App";

const Popup: FC = () => {
    return (
        <RemoteConfigProvider>
            <App />
        </RemoteConfigProvider>
    );
};

export default Popup;
```

```tsx
import {useRemoteConfig} from "@adnbn/plugin-remote-config/react";

function FeatureComponent() {
    const {featureFlag, apiEndpoint} = useRemoteConfig();

    return (
        <div>
            {featureFlag ? <p>New feature enabled!</p> : <p>Feature disabled.</p>}
            <p>API Endpoint: {apiEndpoint}</p>
        </div>
    );
}
```

## Options

The plugin accepts the following options:

- `url?: string` — Remote endpoint URL or an environment variable key resolving to a URL.
- `ttl?: number` — Cache time-to-live in minutes. Defaults to `1440` (1 day).
- `config: RemoteConfig` — Default configuration object used as fallback.

## TypeScript Configuration

To enable proper TypeScript support and type safety for your configuration, you need to extend the `RemoteConfig` interface in your project.

### Creating Type Definitions

Create a declaration file in your project (e.g., `types/config.d.ts` or `config.d.ts`) and extend the `RemoteConfig` interface:

```typescript
import "@adnbn/plugin-remote-config";

declare module "@adnbn/plugin-remote-config" {
    interface RemoteConfig {
        featureFlag: boolean;
        apiEndpoint: string;
        theme: "light" | "dark";
        maxRetries: number;
        endpoints: {
            auth: string;
            api: string;
        };
    }
}
```

### Benefits of Type Definitions

Once you've defined your configuration types, you'll get:

- **IntelliSense support** - Auto-completion for configuration properties
- **Type checking** - Compile-time validation of configuration usage
- **Refactoring safety** - Automatic updates when renaming properties

### Usage with Types

After defining your types, you can use the configuration with full type safety:

```typescript
// No need for generic type parameter anymore
const config = await getRemoteConfig();
console.log(config.featureFlag); // ✅ TypeScript knows this is boolean
console.log(config.apiEndpoint); // ✅ TypeScript knows this is string
console.log(config.theme); // ✅ TypeScript knows this is 'light' | 'dark'
```

```tsx
// In React components
function MyComponent() {
    const config = useRemoteConfig();

    return (
        <div className={config.theme === "dark" ? "dark-theme" : "light-theme"}>
            {config.featureFlag && <NewFeature />}
        </div>
    );
}
```

### Configuration Validation

Make sure your default configuration in `adnbn.config.ts` matches your type definitions:

```typescript
export default defineConfig({
    plugins: [
        remoteConfig({
            url: "https://example.com/config.json",
            ttl: 60,
            config: {
                featureFlag: false,
                apiEndpoint: "https://api.example.com",
                theme: "light",
                maxRetries: 3,
                endpoints: {
                    auth: "https://auth.example.com",
                    api: "https://api.example.com",
                },
            } satisfies RemoteConfig, // ✅ Type validation
        }),
    ],
});
```

## License

MIT © Addon Bone
