import {isBackground} from '@adnbn/browser';
import {getService as getServiceProxy} from 'adnbn';
import {getService as getServiceOrigin} from 'adnbn/service';

import {RemoteConfigContract} from './types';

export const getRemoteConfig = async <T extends RemoteConfigContract = RemoteConfigContract>(): Promise<T> => {
    if (isBackground()) {
        return await getServiceOrigin('@adnbn/remote-config-plugin/service').get();
    }
    return await getServiceProxy('@adnbn/remote-config-plugin/service').get();
};
