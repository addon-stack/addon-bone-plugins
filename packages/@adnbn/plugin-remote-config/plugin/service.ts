import {defineService} from "adnbn";

import {getRemoteConfigOptions} from "./api";
import type {CacheRecord} from "./cache";
import {readCache, writeCache} from "./cache";
import {isConfig} from "./options";
import type {RemoteConfig, RemoteConfigOptions} from "./types";

class RemoteConfigService {
    private pending?: Promise<RemoteConfig>;
    private record?: CacheRecord;
    private loaded = false;
    private readable = false;
    private retryAt = 0;

    constructor(private readonly options: RemoteConfigOptions) {}

    public get(): Promise<RemoteConfig> {
        this.pending ??= this.load().finally(() => {
            this.pending = undefined;
        });

        // Direct background callers get independent objects, as callers crossing the service transport already do.
        return this.pending.then(config => structuredClone(config));
    }

    private current(): RemoteConfig {
        return {...this.options.config, ...this.record?.config};
    }

    private async load(): Promise<RemoteConfig> {
        const {url, ttl} = this.options;

        if (!url) {
            return this.options.config;
        }

        if (!this.loaded) {
            this.loaded = true;

            try {
                this.record = await readCache(url);
                this.readable = true;
                const retryAt = this.record?.retryAt ?? 0;
                const latestRetry = Date.now() + (this.options.retryDelay ?? 60_000);
                this.retryAt = retryAt <= latestRetry ? retryAt : 0;
            } catch (error) {
                console.error("[@adnbn/plugin-remote-config] cache read failed", error);
            }
        }

        const now = Date.now();
        const updatedAt = this.record?.updatedAt;

        const fresh = this.record?.config && updatedAt !== undefined && updatedAt <= now &&
            now - updatedAt < ttl * 60_000;

        if (fresh || now < this.retryAt) {
            return this.current();
        }

        let config: RemoteConfig;

        try {
            config = await this.fetch(url);
        } catch (error) {
            console.error("[@adnbn/plugin-remote-config] refresh failed", error);
            this.retryAt = Date.now() + (this.options.retryDelay ?? 60_000);

            if (this.readable) {
                this.record = {...this.record, url, retryAt: this.retryAt};
                await this.persist();
            }

            return this.current();
        }

        this.retryAt = 0;
        this.record = {url, config, updatedAt: Date.now()};
        await this.persist();

        return this.current();
    }

    private async persist(): Promise<void> {
        if (!this.record) {
            return;
        }

        try {
            await writeCache(this.record);
            this.readable = true;
        } catch (error) {
            console.error("[@adnbn/plugin-remote-config] cache write failed", error);
        }
    }

    private async fetch(url: string): Promise<RemoteConfig> {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;

        const timeout = new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
                reject(new Error("Remote config request timed out"));
                controller.abort();
            }, this.options.timeout ?? 10_000);
        });

        const request = async () => {
            const response = await fetch(url, {credentials: "include", signal: controller.signal});

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
