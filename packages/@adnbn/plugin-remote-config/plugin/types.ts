export interface RemoteConfig {}

export interface RemoteConfigOptions {
    url?: string;
    ttl: number;
    config: Partial<RemoteConfig>;
}

export type ValueOrGetter<T> = {
    [K in keyof T]: T[K] | (() => T[K]);
};