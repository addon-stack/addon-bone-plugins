import React, {PropsWithChildren, useEffect, useMemo, useState} from 'react';

import {RemoteConfigContext} from './context';

import {getConfigOptions} from "../utils";
import {getRemoteConfig} from "../api";

import {RemoteConfigContract} from '../types';

export interface RemoteConfigProviderProps {
    config?: RemoteConfigContract;
}

const RemoteConfigProvider = ({children, config: propConfig}: PropsWithChildren<RemoteConfigProviderProps>) => {
    const [config, setConfig] = useState<RemoteConfigContract>(getConfigOptions().config);

    useEffect(() => {
        getRemoteConfig().then((result) => setConfig(result));
    }, []);

    const finalConfig: RemoteConfigContract = useMemo(() => ({...config, ...propConfig}), [propConfig, config]);

    return (
        <RemoteConfigContext.Provider value={{config: finalConfig}}>
            {children}
        </RemoteConfigContext.Provider>
    );
};

export default RemoteConfigProvider;
