import {Browser, definePlugin} from "adnbn";

export default definePlugin(() => ({
    name: "@adnbn/plugin-reg-cs",
    background: true,
    manifest: ({config, manifest}) => {
        if (config.browser === Browser.Firefox) {
            return;
        }

        if (config.manifestVersion === 3) {
            manifest.addPermission("storage").addPermission("scripting");
        }
    },
}));
