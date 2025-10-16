import {DefinePlugin} from "@rspack/core";
import {definePlugin, getEnv} from "adnbn";
import isURL from "is-url";
import type {RemoteConfig, RemoteConfigOptions, ValueOrGetter} from "./types";

export type {RemoteConfig, RemoteConfigOptions};

export default definePlugin((options: Partial<ValueOrGetter<RemoteConfigOptions>> = {}) => {
    const {url = "REMOTE_CONFIG_URL", config, ttl} = options;

    return {
        name: "@adnbn/plugin-remote-config",
        service: true,
        bundler: () => {
            return {
                plugins: [
                    new DefinePlugin({
                        __REMOTE_CONFIG_OPTIONS__: JSON.stringify({
                            url: typeof url === "function" ? url() : url,
                            ttl: typeof ttl === "function" ? ttl() : ttl,
                            config: typeof config === "function" ? config() : config,
                        }),
                    }),
                ],
            };
        },
        manifest: ({manifest}) => {
            const urlValue = (typeof url === "function" ? url() : url) || "";

            const currentUrl = isURL(urlValue) ? urlValue : getEnv(urlValue);

            if (currentUrl) {
                manifest.addHostPermission(currentUrl);
            }
        },
    };
});
