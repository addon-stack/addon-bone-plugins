import React, {PropsWithChildren, useEffect, useState} from "react";

import getOptions from "../options";

import {RemoteConfigContext} from "./context";

import {getRemoteConfig} from "../api";

import {RemoteConfig} from "../types";

export interface RemoteConfigProviderProps {
    config?: Partial<RemoteConfig>;
}

const RemoteConfigProvider = ({children, config: propConfig}: PropsWithChildren<RemoteConfigProviderProps>) => {
    const [config, setConfig] = useState<RemoteConfig>(getOptions().config);

    useEffect(() => {
        getRemoteConfig()
            .then(result => setConfig(result))
            .catch(err => console.error(err));
    }, []);

    return (
        <RemoteConfigContext.Provider value={{config: {...config, ...propConfig}}}>
            {children}
        </RemoteConfigContext.Provider>
    );
};

export default RemoteConfigProvider;
