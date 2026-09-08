import {defineService} from "adnbn";

import {getRemoteConfigOptions} from "../api";
import {isConfig} from "../options";
import {PluginName, type RemoteConfig, type ResolvedRemoteConfigOptions} from "../types";
import Cache from "./Cache";

class RemoteConfigService {
    private pending?: Promise<RemoteConfig>;
    private readonly cache?: Cache;

    constructor(private readonly options: ResolvedRemoteConfigOptions) {
        if (options.url) {
            this.cache = new Cache(options.url, options.ttl, options.retryDelay);
        }
    }

    /**
     * Preserve the public type reference in Addon Bone's generated service registry.
     * @returns {Promise<import('@adnbn/plugin-remote-config').RemoteConfig>}
     */
    public get(): Promise<RemoteConfig> {
        this.pending ??= this.load().finally(() => {
            this.pending = undefined;
        });

        // Direct background callers get independent objects, as callers crossing the service transport already do.
        return this.pending.then(config => structuredClone(config));
    }

    private current(): RemoteConfig {
        return {...this.options.config, ...this.cache?.config};
    }

    private async load(): Promise<RemoteConfig> {
        const cache = this.cache;

        if (!cache) {
            return this.options.config;
        }

        await cache.load();

        if (!cache.shouldRefresh()) {
            return this.current();
        }

        let config: RemoteConfig;

        try {
            config = await this.fetch(cache.url);
        } catch (error) {
            console.error(`[${PluginName}] refresh failed`, error);
            await cache.deferRetry();

            return this.current();
        }

        await cache.update(config);

        return this.current();
    }

    private async fetch(url: string): Promise<RemoteConfig> {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;

        const timeout = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
                reject(new Error("Remote config request timed out"));
                controller.abort();
            }, this.options.timeout);
        });

        const request = async () => {
            const response = await fetch(url, {credentials: this.options.credentials, signal: controller.signal});

            if (!response.ok) {
                throw new Error(`Response error status: ${response.status} - ${response.statusText}`);
            }

            const config: unknown = await response.json();

            if (!isConfig(config)) {
                throw new TypeError("Remote config response must be a JSON object");
            }

            return config;
        };

        try {
            return await Promise.race([request(), timeout]);
        } finally {
            clearTimeout(timer);
        }
    }
}

export default defineService({
    permissions: ["storage"],
    init: () => new RemoteConfigService(getRemoteConfigOptions()),
});
