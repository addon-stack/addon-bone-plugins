import {getService as getServiceProxy} from "adnbn";
import {getService as getServiceOrigin} from "adnbn/service";

import {isBackground} from "@adnbn/browser";

import {RemoteConfig} from "./types";

export const getRemoteConfig = async <T extends RemoteConfig = RemoteConfig>(): Promise<T> => {
    const service = isBackground() ? getServiceOrigin : getServiceProxy;

    return await service("@adnbn/plugin-remote-config/service").get();
};
