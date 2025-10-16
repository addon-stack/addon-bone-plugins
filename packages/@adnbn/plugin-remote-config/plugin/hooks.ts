import {useEffect, useState} from "react";
import {getRemoteConfig, getRemoteConfigOptions} from "./api";
import type {RemoteConfig} from "./types";

export function useRemoteConfig<T extends RemoteConfig = RemoteConfig>(): T;
export function useRemoteConfig<T extends RemoteConfig = RemoteConfig, S = any>(selector: (config: T) => S): S;
export function useRemoteConfig<T extends RemoteConfig = RemoteConfig, S = any>(selector?: (config: T) => S): T | S {
    const [config, setConfig] = useState<T>(getRemoteConfigOptions().config as T);

    useEffect(() => {
        getRemoteConfig()
            .then(config => setConfig(config as T))
            .catch(console.error);
    }, []);

    return selector ? selector(config) : config;
}
