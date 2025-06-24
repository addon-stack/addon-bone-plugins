import {isBackground} from '@adnbn/browser';
import {getService as getServiceProxy} from 'adnbn';
import {getService as getServiceOrigin} from 'adnbn/service';

import {RemoteConfig} from './types';

export const getRemoteConfig = async <T extends RemoteConfig = RemoteConfig>(): Promise<T> => {
    if (isBackground()) {
        return await getServiceOrigin('@adnbn/remote-config-plugin/service').get();
    }
    return await getServiceProxy('@adnbn/remote-config-plugin/service').get();
};
