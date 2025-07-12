import {DefinePlugin} from "@rspack/core";
import {definePlugin} from "adnbn";

import {RemoteConfig} from "./types";

export {RemoteConfig};

export interface RemoteConfigOptions {
    url?: string | (() => string);
    ttl?: number | (() => number);
    config?: RemoteConfig | (() => RemoteConfig);
}

export default definePlugin((options: RemoteConfigOptions = {}) => {
    return {
        name: "@adnbn/remote-config-plugin",
        service: true,
        bundler: () => {
            const {url = "REMOTE_CONFIG_URL", config, ttl} = options;

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
    };
});
