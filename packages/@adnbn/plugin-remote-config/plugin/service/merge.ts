import {isConfig} from "../options";

/** Merge only own JSON fields, creating new objects and replacing arrays and explicit scalar values. */
export const mergeConfig = (defaults: object, response: Record<string, unknown> = {}): Record<string, unknown> => {
    const result = {...defaults} as Record<string, unknown>;

    for (const [key, value] of Object.entries(response)) {
        const fallback = Object.hasOwn(result, key) ? result[key] : undefined;
        const merged = isConfig(fallback) && isConfig(value) ? mergeConfig(fallback, value) : value;

        // Define data properties so JSON keys such as __proto__ cannot invoke prototype setters.
        Object.defineProperty(result, key, {value: merged, enumerable: true, configurable: true, writable: true});
    }

    return result;
};
