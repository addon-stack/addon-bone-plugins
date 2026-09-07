import {createBrowserHarness, installBrowserGlobals} from "@addon-core/browser/testing";

import {createStorageHarness, installStorageHarness} from "../../../../../tests/helpers/storage";

export const setupBrowserHarness = () => {
    const browser = createBrowserHarness();

    const restoreBrowser = installBrowserGlobals(browser, {
        context: "serviceWorker",
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
