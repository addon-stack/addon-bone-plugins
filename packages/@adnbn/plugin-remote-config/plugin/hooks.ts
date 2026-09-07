import {useEffect, useState} from "react";

import {getRemoteConfig, getRemoteConfigOptions} from "./api";
import type {RemoteConfig} from "./types";

export function useRemoteConfig<T extends RemoteConfig = RemoteConfig>(): T;
export function useRemoteConfig<T extends RemoteConfig = RemoteConfig, S = any>(selector: (config: T) => S): S;

export function useRemoteConfig<T extends RemoteConfig = RemoteConfig, S = any>(selector?: (config: T) => S): T | S {
    const [config, setConfig] = useState<T>(() => getRemoteConfigOptions().config as T);

    useEffect(() => {
        let active = true;

        getRemoteConfig()
            .then(config => {
                if (active) {
                    setConfig(config as T);
                }
            })
            .catch(console.error);

        return () => {
            active = false;
        };
    }, []);

    return selector ? selector(config) : config;
}
