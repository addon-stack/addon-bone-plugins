import type {Get, PartialDeep, Paths} from "type-fest";

/** @internal */
export const PluginName = "@adnbn/plugin-remote-config";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Consumer projects augment this interface.
export interface RemoteConfig {}

// Keep type-fest's paths within dot-prop's supported dot syntax. Use selectors for literal special keys.
type SelectablePath<Path> = Path extends string
    ? Path extends `${string}${"[" | "]" | "\\"}${string}` ? never
        : `.${Path}.` extends `${string}.${"__proto__" | "prototype" | "constructor"}.${string}` ? never
            : unknown extends Get<RemoteConfig, Path> ? never : Path
    : never;

/** Dot paths through the consumer's augmented configuration, capped at ten recursive steps. */
// Keep the deeper paths covered by the consumer fixture; bound expansion for recursive schemas.
export type RemoteConfigPath = SelectablePath<Paths<RemoteConfig, {maxRecursionDepth: 10}>>;

/** The selected value, including undefined for optional branches and unbounded array indices. */
export type RemoteConfigValue<Path extends RemoteConfigPath> = Get<RemoteConfig, Path>;

/**
 * Options for configuring @adnbn/plugin-remote-config.
 * Build-time inputs resolved by the plugin before being embedded in the extension.
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
    ttl?: number;

    /**
     * Optional, deeply partial defaults for the consumer's RemoteConfig schema.
     * Objects are merged deeply with each successful response; arrays are replaced.
     * Used before the first successful fetch, including the initial React render. Defaults to {}.
     */
    config?: PartialDeep<RemoteConfig>;

    /** Maximum request and JSON-body duration in milliseconds. Defaults to 10000. */
    timeout?: number;

    /** Minimum delay between failed refresh attempts in milliseconds. Defaults to 60000; zero disables the delay. */
    retryDelay?: number;

    /** Fetch credentials policy. Defaults to omit; use include for cookie-authenticated endpoints. */
    credentials?: "omit" | "same-origin" | "include";
}

/** Runtime options with defaults applied and the environment variable resolved. */
export interface ResolvedRemoteConfigOptions extends Required<Omit<RemoteConfigOptions, "url">> {
    /** Absolute HTTP(S) endpoint URL, or undefined when the endpoint is disabled. */
    url?: string;
}

export type ValueOrGetter<T> = {
    [K in keyof T]: T[K] | (() => T[K]);
};
