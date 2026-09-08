import {useEffect, useState} from "react";

import {getRemoteConfig, getRemoteConfigOptions} from "../api";
import {selectConfig} from "../selection";
import type {RemoteConfig, RemoteConfigPath, RemoteConfigValue} from "../types";

export function useRemoteConfig(): RemoteConfig;
export function useRemoteConfig<Path extends RemoteConfigPath>(path: Path): RemoteConfigValue<Path>;

/** Selectors run during render and must return synchronously. */
export function useRemoteConfig<Value>(
    selector: (config: RemoteConfig) => Value & Exclude<Value, PromiseLike<unknown>>
): Value;

export function useRemoteConfig(selection?: RemoteConfigPath | ((config: RemoteConfig) => unknown)): unknown {
    const [config, setConfig] = useState<RemoteConfig>(() => getRemoteConfigOptions().config);

    useEffect(() => {
        let active = true;

        getRemoteConfig()
            .then(config => {
                if (active) {
                    setConfig(config);
                }
            })
            .catch(console.error);

        return () => {
            active = false;
        };
    }, []);

    return selectConfig(config, selection);
}
