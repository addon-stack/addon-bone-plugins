import {SecureStorage, Storage} from "@addon-core/storage";
import {defineService} from "adnbn";
import AwaitLock from "await-lock";
import addMinutes from "date-fns/addMinutes";
import formatISO from "date-fns/formatISO";
import isFuture from "date-fns/isFuture";
import parseISO from "date-fns/parseISO";
import {getRemoteConfigOptions} from "./api";
import type {RemoteConfig} from "./types";

type StorageContract = {
    updatedAt: string;
    isOrigin: boolean;
};

type SecureStorageContract = {
    config: RemoteConfig;
    url?: string;
};

class RemoteConfigService {
    private readonly settingsStorage = Storage.Local<StorageContract>({key: "remote-config"});

    private readonly configStorage = SecureStorage.Local<SecureStorageContract>({key: "remote-config"});

    private readonly lock = new AwaitLock();

    constructor(
        private defaultConfig: RemoteConfig,
        private ttl: number,
        private url?: string
    ) {}

    /**
     * @returns {Promise<import('@adnbn/plugin-remote-config').RemoteConfig>}
     */
    public async get(): Promise<RemoteConfig> {
        await this.lock.acquireAsync();

        try {
            return await this.load();
        } catch (e) {
            console.error("Remote Config Storage - load error:", e);

            await this.setIsOrigin(false);

            return this.defaultConfig;
        } finally {
            this.lock.release();
        }
    }

    private async load(): Promise<RemoteConfig> {
        const {config, url} = await this.configStorage.getAll();
        const {isOrigin, updatedAt} = await this.settingsStorage.getAll();

        const isUrlSame = !this.url || url === this.url;

        if (config && isOrigin && updatedAt && isUrlSame && isFuture(addMinutes(parseISO(updatedAt), this.ttl))) {
            return config;
        }

        const apiConfig = await this.fetch();

        if (apiConfig) {
            await this.setIsOrigin(true);
            await this.setUpdatedAt();
            await this.setConfig(apiConfig);
            await this.setUrl(this.url);

            return apiConfig;
        }

        throw new Error("No available config from storage or api");
    }

    private async fetch(): Promise<RemoteConfig> {
        if (!this.url) {
            throw new Error("No url provided for remote config");
        }

        const response = await fetch(this.url, {credentials: "include"});

        const {ok, status, statusText} = response;

        if (!ok) {
            throw new Error(`Response error status: ${status} - ${statusText}`);
        }

        const config: RemoteConfig | undefined = await response.json();

        if (!config) {
            throw new Error("Config not found");
        }

        return config;
    }

    private async setIsOrigin(value: boolean): Promise<void> {
        await this.settingsStorage.set("isOrigin", value);
    }

    private async setUpdatedAt(date?: Date): Promise<void> {
        await this.settingsStorage.set("updatedAt", formatISO(date || new Date()));
    }

    private async setConfig(config: RemoteConfig): Promise<void> {
        await this.configStorage.set("config", config);
    }

    private async setUrl(url?: string): Promise<void> {
        url && (await this.configStorage.set("url", url));
    }
}

export default defineService({
    permissions: ["storage"],
    init: () => {
        const {config, ttl, url} = getRemoteConfigOptions();

        return new RemoteConfigService(config, ttl, url);
    },
});
