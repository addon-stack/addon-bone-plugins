import {definePlugin, getEnv} from "adnbn";

import {DefinePlugin} from "@rspack/core";

import {normalizeOptions} from "./options";
import type {RemoteConfig, RemoteConfigOptions, ValueOrGetter} from "./types";

export type {RemoteConfig, RemoteConfigOptions};

export default definePlugin((options: Partial<ValueOrGetter<RemoteConfigOptions>> = {}) => {
    const builds = new WeakMap<object, RemoteConfigOptions>();

    const resolve = (build: object): RemoteConfigOptions => {
        const cached = builds.get(build);

        if (cached) {
            return cached;
        }

        const values = Object.fromEntries(
            Object.entries(options).map(([key, value]) => [key, typeof value === "function" ? value() : value])
        );

        const urlValue = options.url === undefined ? "REMOTE_CONFIG_URL" : values.url;

        if (urlValue !== undefined && typeof urlValue !== "string") {
            throw new TypeError("Remote config URL must be a string or an environment variable name");
        }

        // Environment values resolve once per build, shared by the manifest and DefinePlugin.
        const url = urlValue && !/^[a-z][a-z\d+.-]*:/i.test(urlValue) ? getEnv(urlValue) : urlValue;
        const resolved = normalizeOptions({...values, url});
        const snapshot = JSON.parse(JSON.stringify(resolved)) as RemoteConfigOptions;
        builds.set(build, snapshot);

        return snapshot;
    };

    return {
        name: "@adnbn/plugin-remote-config",
        service: true,
        bundler: ({config}) => ({
            plugins: [new DefinePlugin({__REMOTE_CONFIG_OPTIONS__: JSON.stringify(resolve(config))})],
        }),
        manifest: ({manifest, config}) => {
            const {url} = resolve(config);

            if (url) {
                const parsed = new URL(url);
                manifest.addHostPermission(`${parsed.protocol}//${parsed.hostname}/*`);
            }
        },
    };
});
