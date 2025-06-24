import {createContext, useContext} from "react";

import {RemoteConfig} from "../types";

export interface RemoteConfigContract {
    config: RemoteConfig;
}

export const DefaultRemoteConfig: RemoteConfigContract = {
    config: {} as RemoteConfig
};

export const RemoteConfigContext = createContext<RemoteConfigContract>(DefaultRemoteConfig);

RemoteConfigContext.displayName = "RemoteConfigContext";

export function useRemoteConfig<T = RemoteConfig>(): T;
export function useRemoteConfig<T = RemoteConfig, S = any>(selector: (config: T) => S): S;
export function useRemoteConfig<T = RemoteConfig, S = any>(selector?: (config: T) => S): T | S {
    const config = useContext(RemoteConfigContext).config as T;

    return selector ? selector(config) : config;
}
