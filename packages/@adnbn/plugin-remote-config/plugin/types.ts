// biome-ignore lint/suspicious/noEmptyInterface: Keep this empty to allow declaration merging in consumer projects
export interface RemoteConfig {}

/**
 * Options for configuring @adnbn/plugin-remote-config.
 * These values are embedded at build time and read by the runtime service.
 */
export interface RemoteConfigOptions {
    /**
     * Remote endpoint URL to fetch the JSON configuration from, or the name of an
     * environment variable that resolves to this URL.
     *
     * Notes:
     * - If the value looks like a URL, it is used as-is.
     * - Otherwise, the value is treated as an env key and resolved via the build env.
     *
     * Example values: "https://example.com/config.json", "REMOTE_CONFIG_URL".
     */
    url?: string;

    /**
     * Cache time-to-live (in minutes) for the fetched configuration.
     * Determines how long the stored config is considered fresh before refetching.
     *
     * Example: 60 (1 hour).
     * Common default in docs: 1440 (1 day).
     */
    ttl: number;

    /**
     * Default (fallback) configuration used when a remote fetch fails or before
     * the first successful fetch. Only properties provided here will be available
     * until the remote configuration is loaded.
     */
    config: Partial<RemoteConfig>;
}

export type ValueOrGetter<T> = {
    [K in keyof T]: T[K] | (() => T[K]);
};
