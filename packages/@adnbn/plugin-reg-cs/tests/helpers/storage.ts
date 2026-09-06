type StorageValues = Record<string, unknown>;

export interface StorageAreaHarness {
    readonly api: chrome.storage.StorageArea;
    values(): StorageValues;
}

export interface StorageHarness {
    readonly api: typeof chrome.storage;
    readonly local: StorageAreaHarness;
    readonly managed: StorageAreaHarness;
    readonly session: StorageAreaHarness;
    readonly sync: StorageAreaHarness;
}

type StorageCallback<Result = void> = ((result: Result) => void) | undefined;

const hasOwn = (value: object, key: PropertyKey): boolean => Object.hasOwn(value, key);

const createStorageArea = (): StorageAreaHarness => {
    let data: StorageValues = {};

    const getValues = (keys?: string | string[] | StorageValues | null): StorageValues => {
        if (keys === undefined || keys === null) {
            return structuredClone(data);
        }

        if (typeof keys === "string") {
            return hasOwn(data, keys) ? {[keys]: structuredClone(data[keys])} : {};
        }

        if (Array.isArray(keys)) {
            return Object.fromEntries(
                keys.filter(key => hasOwn(data, key)).map(key => [key, structuredClone(data[key])])
            );
        }

        return Object.fromEntries(
            Object.entries(keys).map(([key, fallback]) => [
                key,
                hasOwn(data, key) ? structuredClone(data[key]) : structuredClone(fallback),
            ])
        );
    };

    const finish = <Result>(result: Result, callback: StorageCallback<Result>): Promise<Result> | void => {
        if (callback) {
            callback(result);

            return;
        }

        return Promise.resolve(result);
    };

    const area = {
        clear(callback?: StorageCallback) {
            data = {};

            return finish(undefined, callback);
        },
        get(
            keys?: string | string[] | StorageValues | null | StorageCallback<StorageValues>,
            callback?: StorageCallback<StorageValues>
        ) {
            if (typeof keys === "function") {
                return finish(getValues(), keys);
            }

            return finish(getValues(keys), callback);
        },
        getBytesInUse(_keys?: string | string[] | null | StorageCallback<number>, callback?: StorageCallback<number>) {
            const actualCallback = typeof _keys === "function" ? _keys : callback;

            return finish(0, actualCallback);
        },
        getKeys(callback?: StorageCallback<string[]>) {
            return finish(Object.keys(data), callback);
        },
        remove(keys: string | string[], callback?: StorageCallback) {
            const next = {...data};

            for (const key of Array.isArray(keys) ? keys : [keys]) {
                delete next[key];
            }

            data = next;

            return finish(undefined, callback);
        },
        set(items: StorageValues, callback?: StorageCallback) {
            data = {...data, ...structuredClone(items)};

            return finish(undefined, callback);
        },
        setAccessLevel(_options: unknown, callback?: StorageCallback) {
            return finish(undefined, callback);
        },
    } as unknown as chrome.storage.StorageArea & Record<string, unknown>;

    area.QUOTA_BYTES = Number.MAX_SAFE_INTEGER;
    area.MAX_ITEMS = Number.MAX_SAFE_INTEGER;
    area.MAX_WRITE_OPERATIONS_PER_HOUR = Number.MAX_SAFE_INTEGER;
    area.MAX_WRITE_OPERATIONS_PER_MINUTE = Number.MAX_SAFE_INTEGER;
    area.MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE = Number.MAX_SAFE_INTEGER;
    area.QUOTA_BYTES_PER_ITEM = Number.MAX_SAFE_INTEGER;

    return {
        api: area,
        values: () => structuredClone(data),
    };
};

const createEvent = () => {
    const listeners = new Set<(...args: never[]) => void>();

    return {
        addListener: (listener: (...args: never[]) => void) => listeners.add(listener),
        hasListener: (listener: (...args: never[]) => void) => listeners.has(listener),
        hasListeners: () => listeners.size > 0,
        removeListener: (listener: (...args: never[]) => void) => listeners.delete(listener),
    };
};

export const createStorageHarness = (): StorageHarness => {
    const local = createStorageArea();
    const managed = createStorageArea();
    const session = createStorageArea();
    const sync = createStorageArea();

    return {
        api: {
            AccessLevel: {
                TRUSTED_AND_UNTRUSTED_CONTEXTS: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
                TRUSTED_CONTEXTS: "TRUSTED_CONTEXTS",
            },
            local: local.api as chrome.storage.LocalStorageArea,
            managed: managed.api,
            onChanged: createEvent(),
            session: session.api as chrome.storage.SessionStorageArea,
            sync: sync.api as chrome.storage.SyncStorageArea,
        } as unknown as typeof chrome.storage,
        local,
        managed,
        session,
        sync,
    };
};

export const installStorageHarness = (storage: StorageHarness): VoidFunction => {
    const descriptor = Object.getOwnPropertyDescriptor(chrome, "storage");

    Object.defineProperty(chrome, "storage", {
        configurable: true,
        value: storage.api,
    });

    return () => {
        if (descriptor) {
            Object.defineProperty(chrome, "storage", descriptor);
        } else {
            Reflect.deleteProperty(chrome, "storage");
        }
    };
};
