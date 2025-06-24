import {DefinePlugin} from '@rspack/core';
import {definePlugin} from 'adnbn';

import {RemoteConfigContract} from './types';

export {RemoteConfigContract};

export type RemoteConfigOptions = {
    url?: string | (() => string)
    ttl?: number | (() => number)
    config?: RemoteConfigContract | (() => RemoteConfigContract)
}

export default definePlugin(({url = 'REMOTE_CONFIG_URL', config = {}, ttl = 60}: RemoteConfigOptions) => ({
    name: '@adnbn/remote-config-plugin',
    service: true,
    bundler: () => {

        return {
            plugins: [
                new DefinePlugin({
                    __REMOTE_CONFIG_OPTIONS__: JSON.stringify({
                        url: typeof url === 'function' ? url() : url,
                        ttl: typeof ttl === 'function' ? ttl() : ttl,
                        config: typeof config === 'function' ? config() : config,
                    })
                })
            ]
        };
    }
}));
