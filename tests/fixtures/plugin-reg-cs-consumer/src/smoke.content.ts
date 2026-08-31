import {defineContentScript} from "adnbn";

export default defineContentScript({
    matches: ["https://example.com/*"],
    declarative: true,
    runAt: "document_idle",
    main() {
        const smokeGlobal = globalThis as typeof globalThis & {
            __adnbnPluginRegCsSmoke?: boolean;
        };

        smokeGlobal.__adnbnPluginRegCsSmoke = true;
    },
});
