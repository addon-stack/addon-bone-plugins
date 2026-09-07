import {defineBackground} from "adnbn";
import {getRemoteConfig} from "@adnbn/plugin-remote-config/api";

export default defineBackground({
    main() {
        Object.assign(globalThis, {remoteConfigSmokeRead: getRemoteConfig});
    },
});
