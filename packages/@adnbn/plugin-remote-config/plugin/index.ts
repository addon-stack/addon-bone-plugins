import {definePlugin, getEnv} from "adnbn";

import {DefinePlugin} from "@rspack/core";

import {normalizeOptions} from "./options";
import type {RemoteConfig, RemoteConfigOptions, ValueOrGetter} from "./types";

export type {RemoteConfig, RemoteConfigOptions};

export default definePlugin((options: Partial<ValueOrGetter<RemoteConfigOptions>> = {}) => {
    let resolved: RemoteConfigOptions;

    return {
        name: "@adnbn/plugin-remote-config",
        service: true,
        startup: () => {
            const values = Object.fromEntries(
                Object.entries(options).map(([key, value]) => [key, typeof value === "function" ? value() : value])
            );

            const urlValue = options.url === undefined ? "REMOTE_CONFIG_URL" : values.url;

            if (urlValue !== undefined && typeof urlValue !== "string") {
                throw new TypeError("Remote config URL must be a string or an environment variable name");
            }

            const url = urlValue && !/^[a-z][a-z\d+.-]*:/i.test(urlValue) ? getEnv(urlValue) : urlValue;
            const normalized = normalizeOptions({...values, url});

            resolved = JSON.parse(JSON.stringify(normalized)) as RemoteConfigOptions;
        },
        bundler: () => ({
            plugins: [new DefinePlugin({__REMOTE_CONFIG_OPTIONS__: JSON.stringify(resolved)})],
        }),
        manifest: ({manifest}) => {
            const {url} = resolved;

            if (url) {
                const parsed = new URL(url);
                manifest.addHostPermission(`${parsed.protocol}//${parsed.hostname}/*`);
            }
        },
    };
});
