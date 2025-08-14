import {defineService} from "adnbn";
import {SecureStorage, Storage} from "adnbn/storage";

import formatISO from "date-fns/formatISO";
import isFuture from "date-fns/isFuture";
import parseISO from "date-fns/parseISO";
import addMinutes from "date-fns/addMinutes";

import {awaiter} from "./utils";

import getOptions from "./options";

import {RemoteConfig} from "./types";

type StorageContract = {
    updatedAt: string;
    isOrigin: boolean;
};

type SecureStorageContract = {
    config: RemoteConfig;
    url?: string;
};

class RemoteConfigService {
    private readonly settingsStorage = new Storage<StorageContract>({
        area: "local",
        namespace: "remote-config",
    });

    private readonly configStorage = new SecureStorage<SecureStorageContract>({
        area: "local",
        namespace: "remote-config",
    });

    private processing: boolean = false;

    constructor(
        private defaultConfig: RemoteConfig,
        private ttl: number,
        private url?: string
    ) {}

    /**
     * @returns {Promise<import('@adnbn/plugin-remote-config').RemoteConfig>}
     */
    public async get(): Promise<RemoteConfig> {
        try {
            await awaiter(() => this.processing);
        } catch (e) {
            console.error("Remote Config Service - await error:", e);
        }

        this.processing = true;

        try {
            return await this.load();
        } catch (e) {
            console.error("Remote Config Storage - load error:", e);

            await this.setIsOrigin(false);

            return this.defaultConfig;
        } finally {
            this.processing = false;
        }
    }

    private async load(): Promise<RemoteConfig> {
        const storageConfig = await this.configStorage.get("config");
        const storedUrl = await this.configStorage.get("url");

        const updatedAt = await this.settingsStorage.get("updatedAt");
        const isOrigin = await this.settingsStorage.get("isOrigin");

        const isUrlSame = !this.url || storedUrl === this.url;

        if (
            storageConfig &&
            isOrigin &&
            updatedAt &&
            isUrlSame &&
            isFuture(addMinutes(parseISO(updatedAt), this.ttl))
        ) {
            return storageConfig;
        }

        const apiConfig = await this.fetch();

        if (apiConfig) {
            await this.setIsOrigin(true);
            await this.setUpdatedAt();

            await this.configStorage.set("config", apiConfig);

            if (this.url) {
                await this.configStorage.set("url", this.url);
            }

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
        if (!date) {
            date = new Date();
        }

        await this.settingsStorage.set("updatedAt", formatISO(date));
    }
}

export default defineService({
    permissions: ["storage"],
    init: () => {
        const {config, ttl, url} = getOptions();

        return new RemoteConfigService(config, ttl, url);
    },
});
