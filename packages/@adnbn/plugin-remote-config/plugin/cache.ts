import {storageLocal, storageSecure} from "@addon-core/storage";

import {isConfig} from "./options";
import type {RemoteConfig} from "./types";

export interface CacheRecord {
    url: string;
    config?: RemoteConfig;
    updatedAt?: number;
    retryAt?: number;
}

const storage = () => storageLocal<{"remote-config": unknown; "secure:remote-config": unknown}>();

export const readCache = async (url: string): Promise<CacheRecord | undefined> => {
    const value = await storage().get("remote-config");

    if (isConfig(value) && typeof value.url === "string") {
        if (value.url !== url) {
            return undefined;
        }

        return {
            url,
            config: isConfig(value.config) ? value.config : undefined,
            updatedAt: typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
                ? value.updatedAt : undefined,
            retryAt: typeof value.retryAt === "number" && Number.isFinite(value.retryAt) ? value.retryAt : undefined,
        };
    }

    // Legacy encrypted data is read only. New configuration and metadata are always written to ordinary local storage.
    const legacy = await storageSecure<{"remote-config": unknown}>({area: "local"}).get("remote-config");

    if (!isConfig(legacy) || legacy.url !== url || !isConfig(legacy.config)) {
        return undefined;
    }

    const timestamp = isConfig(value) && typeof value.updatedAt === "string" ? Date.parse(value.updatedAt) : NaN;

    const record = {url, config: legacy.config, updatedAt: Number.isFinite(timestamp) ? timestamp : undefined};

    try {
        await writeCache(record);
    } catch (error) {
        console.error("[@adnbn/plugin-remote-config] legacy cache migration failed", error);
    }

    return record;
};

export const writeCache = async (record: CacheRecord): Promise<void> => {
    const local = storage();
    // One native set stores configuration and its metadata together. Preserve legacy data if this write fails.
    await local.set("remote-config", record);
    await local.remove("secure:remote-config");
};
