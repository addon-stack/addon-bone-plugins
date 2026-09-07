import type {BrowserHarness, BrowserHarnessOptions} from "@addon-core/browser/testing";
import {
    createBrowserHarness,
    createInjectionResultFixture,
    installBrowserGlobals,
} from "@addon-core/browser/testing";

import {createStorageHarness, installStorageHarness, type StorageHarness} from "../../../../../tests/helpers/storage";

export interface PluginBrowserHarness {
    readonly browser: BrowserHarness;
    readonly storage: StorageHarness | undefined;
    restore(): void;
}

export const setupBrowserHarness = (
    options: BrowserHarnessOptions = {},
    withStorage = true
): PluginBrowserHarness => {
    const browser = createBrowserHarness({permissions: {origins: ["<all_urls>"]}, ...options});

    const restoreBrowserGlobals = installBrowserGlobals(browser, {
        context: "serviceWorker",
        globals: {navigator: {locks: navigator.locks}},
        profile: "chrome",
    });

    const storage = withStorage ? createStorageHarness() : undefined;
    const restoreStorage = storage ? installStorageHarness(storage) : undefined;

    browser.scripting.insertCSS.setResult(undefined);
    browser.scripting.executeScript.setResult([createInjectionResultFixture()]);
    browser.tabs.insertCSS.setResult(undefined);
    browser.tabs.executeScript.setResult([]);

    return {
        browser,
        storage,
        restore: () => {
            restoreStorage?.();
            restoreBrowserGlobals();
        },
    };
};
