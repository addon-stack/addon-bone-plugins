import {createBrowserHarness, installBrowserGlobals} from "@addon-core/browser/testing";

import {createStorageHarness, installStorageHarness} from "../../../../../tests/helpers/storage";

export const setupBrowserHarness = (context: "serviceWorker" | "contentScript" = "serviceWorker") => {
    const browser = createBrowserHarness();

    const restoreBrowser = installBrowserGlobals(browser, {
        context,
        globals: {navigator: {locks: navigator.locks}},
        profile: "chrome",
    });

    const storage = createStorageHarness();
    const restoreStorage = installStorageHarness(storage);

    return {
        browser,
        storage,
        restore() {
            restoreStorage();
            restoreBrowser();
        },
    };
};
