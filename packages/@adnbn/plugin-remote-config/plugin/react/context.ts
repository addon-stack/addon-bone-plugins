import {createContext, useContext} from "react";

import {RemoteConfigContract} from "../types";

export interface RemoteConfigContextContract {
    config: RemoteConfigContract;
}

export const DefaultRemoteConfig: RemoteConfigContextContract = {
    config: {}
};

export const RemoteConfigContext = createContext<RemoteConfigContextContract>(DefaultRemoteConfig);

RemoteConfigContext.displayName = "RemoteConfigContext";

export const useRemoteConfig = <T extends RemoteConfigContract = RemoteConfigContract>() => useContext(RemoteConfigContext).config as T;
