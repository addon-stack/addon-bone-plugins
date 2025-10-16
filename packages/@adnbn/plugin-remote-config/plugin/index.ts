import {DefinePlugin} from "@rspack/core";
import {definePlugin} from "adnbn";

import {RemoteConfig, RemoteConfigOptions, ValueOrGetter} from "./types";

export {RemoteConfig};

export default definePlugin((options: Partial<ValueOrGetter<RemoteConfigOptions>> = {}) => {
    return {
        name: "@adnbn/plugin-remote-config",
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
