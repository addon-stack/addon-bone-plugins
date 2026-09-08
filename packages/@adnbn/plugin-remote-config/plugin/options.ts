import type {RemoteConfigOptions, ResolvedRemoteConfigOptions} from "./types";

export const isConfig = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === null || Object.getPrototypeOf(prototype) === null;
};

export const normalizeOptions = (options: RemoteConfigOptions): ResolvedRemoteConfigOptions => {
    const {url, config = {}, ttl = 1440, timeout = 10_000, retryDelay = 60_000, credentials = "omit"} = options;

    if (!isConfig(config)) {
        throw new TypeError("Remote config defaults must be a JSON object");
    }

    for (const [name, value] of Object.entries({ttl, timeout, retryDelay})) {
        if (!Number.isFinite(value) || value < 0 || (name === "timeout" && value === 0)) {
            const range = name === "timeout" ? "positive" : "non-negative";
            throw new TypeError(`Remote config ${name} must be a finite ${range} number`);
        }
    }

    if (timeout > 2_147_483_647) {
        throw new RangeError("Remote config timeout exceeds the browser timer limit");
    }

    if (!["omit", "same-origin", "include"].includes(credentials)) {
        throw new TypeError("Remote config credentials must be omit, same-origin, or include");
    }

    if (url !== undefined && url !== "") {
        const parsed = new URL(url);

        if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
            throw new TypeError("Remote config URL must use HTTP(S) without embedded credentials");
        }
    }

    return {config, ttl, url: url || undefined, timeout, retryDelay, credentials};
};
