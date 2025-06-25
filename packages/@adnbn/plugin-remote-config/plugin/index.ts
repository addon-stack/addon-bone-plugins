import {DefinePlugin} from "@rspack/core";
import {definePlugin} from "adnbn";

import {RemoteConfig} from "./types";

export {RemoteConfig};

export interface RemoteConfigOptions {
    url?: string | (() => string);
    ttl?: number | (() => number);
    config?: RemoteConfig | (() => RemoteConfig);
}

export default definePlugin(({url = "REMOTE_CONFIG_URL", config, ttl}: RemoteConfigOptions) => ({
    name: "@adnbn/remote-config-plugin",
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
}));
