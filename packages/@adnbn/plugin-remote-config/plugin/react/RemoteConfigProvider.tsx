import React, {PropsWithChildren, useEffect, useMemo, useState} from 'react';

import {RemoteConfigContext} from './context';

import {getConfigOptions} from "../utils";
import {getRemoteConfig} from "../api";

import {RemoteConfig} from '../types';

export interface RemoteConfigProviderProps {
    config?: Partial<RemoteConfig>;
}

const RemoteConfigProvider = ({children, config: propConfig}: PropsWithChildren<RemoteConfigProviderProps>) => {
    const [config, setConfig] = useState<RemoteConfig>(getConfigOptions().config);

    useEffect(() => {
        getRemoteConfig().then((result) => setConfig(result));
    }, []);

    const finalConfig: RemoteConfig = useMemo(() => ({...config, ...propConfig}), [propConfig, config]);

    return (
        <RemoteConfigContext.Provider value={{config: finalConfig}}>
            {children}
        </RemoteConfigContext.Provider>
    );
};

export default RemoteConfigProvider;
