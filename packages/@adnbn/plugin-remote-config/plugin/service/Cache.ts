import {storageLocal, type StorageProvider} from "@addon-core/storage";

import {isConfig} from "../options";
import {PluginName, type RemoteConfig} from "../types";

interface CacheRecord {
    url: string;
    config?: RemoteConfig;
    updatedAt?: number;
    retryAt?: number;
}

interface StorageContract {
    cache: unknown;
}

export default class Cache {
    private local?: StorageProvider<StorageContract>;
    private record?: CacheRecord;
    private loaded = false;
    private readable = false;
    private retryAt = 0;

    constructor(
        public readonly url: string,
        private readonly ttl: number,
        private readonly retryDelay: number
    ) {}

    public get config(): RemoteConfig | undefined {
        return this.record?.config;
    }

    private get storage(): StorageProvider<StorageContract> {
        return this.local ??= storageLocal<StorageContract>({namespace: PluginName});
    }

    public async load(): Promise<void> {
        if (this.loaded) {
            return;
        }

        this.loaded = true;

        try {
            this.record = await this.read();
            this.readable = true;
            const retryAt = this.record?.retryAt ?? 0;
            this.retryAt = retryAt <= Date.now() + this.retryDelay ? retryAt : 0;
        } catch (error) {
            console.error(`[${PluginName}] cache read failed`, error);
        }
    }

    public shouldRefresh(): boolean {
        const now = Date.now();
        const updatedAt = this.record?.updatedAt;

        const fresh = this.record?.config && updatedAt !== undefined && updatedAt <= now &&
            now - updatedAt < this.ttl * 60_000;

        return !fresh && now >= this.retryAt;
    }

    public async update(config: RemoteConfig): Promise<void> {
        this.retryAt = 0;
        this.record = {url: this.url, config, updatedAt: Date.now()};
        await this.persist();
    }

    public async deferRetry(): Promise<void> {
        if (this.retryDelay === 0) {
            return;
        }

        this.retryAt = Date.now() + this.retryDelay;

        if (this.readable) {
            this.record = {...this.record, url: this.url, retryAt: this.retryAt};
            await this.persist();
        }
    }

    private async read(): Promise<CacheRecord | undefined> {
        const value = await this.storage.get("cache");

        if (!isConfig(value) || value.url !== this.url) {
            return undefined;
        }

        return {
            url: this.url,
            config: isConfig(value.config) ? value.config : undefined,
            updatedAt: typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
                ? value.updatedAt : undefined,
            retryAt: typeof value.retryAt === "number" && Number.isFinite(value.retryAt)
                ? value.retryAt : undefined,
        };
    }

    private async persist(): Promise<void> {
        if (!this.record) {
            return;
        }

        try {
            await this.storage.set("cache", this.record);
            this.readable = true;
        } catch (error) {
            console.error(`[${PluginName}] cache write failed`, error);
        }
    }
}
