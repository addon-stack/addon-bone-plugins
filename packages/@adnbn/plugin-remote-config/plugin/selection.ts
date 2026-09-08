import {getProperty, parsePath} from "dot-prop";

import type {RemoteConfig, RemoteConfigPath, RemoteConfigValue} from "./types";

type ConfigSelection = RemoteConfigPath | ((config: RemoteConfig) => unknown) | undefined;

type SelectedConfig<Selection extends ConfigSelection> =
    Selection extends (config: RemoteConfig) => infer Value ? Value
        : Selection extends RemoteConfigPath ? RemoteConfigValue<Selection>
            : RemoteConfig;

/** Shared local selection; functions never cross the service transport. */
export function selectConfig(config: RemoteConfig): RemoteConfig;

export function selectConfig<Selection extends ConfigSelection>(
    config: RemoteConfig,
    selection: Selection
): SelectedConfig<Selection>;

export function selectConfig(
    config: RemoteConfig,
    selection?: ConfigSelection
): unknown {
    if (typeof selection === "function") {
        return selection(config);
    }

    if (selection === undefined) {
        return config;
    }

    const path = parsePath(selection);
    let value: unknown = config;

    for (const key of path) {
        // dot-prop also reads inherited fields; configuration paths must only access own JSON data.
        if (value === null || typeof value !== "object" || !Object.hasOwn(value, key)) {
            return undefined;
        }

        value = getProperty(value, [key]);
    }

    return path.length ? value : undefined;
}
