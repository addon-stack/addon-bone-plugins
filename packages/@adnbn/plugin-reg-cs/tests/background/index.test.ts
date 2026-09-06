jest.mock("adnbn", () => ({
    Browser: {Firefox: "firefox"},
    defineBackground: (definition: unknown) => definition,
    getBrowser: jest.fn(),
}));

import type {BrowserHarness, BrowserHarnessOptions} from "@addon-core/browser/testing";
import {
    createInstalledDetailsFixture,
    createManifestFixture,
    createTabFixture,
} from "@addon-core/browser/testing";

import background from "../../plugin/background";
import {PendingTabs} from "../../plugin/background/PendingTabs";
import {setupBrowserHarness} from "../helpers/browser";

interface BackgroundDefinition {
    main(): void;
    permissions?: string[];
}

const definition = background as unknown as BackgroundDefinition;
const framework = jest.requireMock<{getBrowser: jest.Mock}>("adnbn");
let restoreGlobals: VoidFunction | undefined;

const tab = (id: number, overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab => {
    return createTabFixture({id, title: "Tab " + id, url: "https://example.com/page", ...overrides});
};

const setup = (options: BrowserHarnessOptions = {}, withStorage = true): BrowserHarness => {
    const context = setupBrowserHarness(options, withStorage);
    restoreGlobals = context.restore;

    return context.browser;
};

const flush = async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 0));
};

beforeEach(() => {
    framework.getBrowser.mockReset().mockReturnValue("chromium");
});

afterEach(() => {
    restoreGlobals?.();
    restoreGlobals = undefined;
});

describe("background listeners", () => {
    it("does not declare permissions in the background entrypoint", () => {
        expect(definition.permissions).toBeUndefined();
    });

    it("registers tab listeners synchronously and removes them when storage is empty", async () => {
        const harness = setup();

        definition.main();

        expect(harness.runtime.events.onInstalled.listenerCount()).toBe(1);
        expect(harness.tabs.events.onUpdated.listenerCount()).toBe(1);
        expect(harness.tabs.events.onRemoved.listenerCount()).toBe(1);
        expect(harness.tabs.events.onReplaced.listenerCount()).toBe(1);

        await flush();

        expect(harness.runtime.events.onInstalled.listenerCount()).toBe(1);
        expect(harness.tabs.events.onUpdated.listenerCount()).toBe(0);
        expect(harness.tabs.events.onRemoved.listenerCount()).toBe(0);
        expect(harness.tabs.events.onReplaced.listenerCount()).toBe(0);
    });

    it("keeps listeners only while a frozen install tab is pending", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(1, {frozen: true})],
        });

        definition.main();
        await harness.runtime.events.onInstalled.emit(createInstalledDetailsFixture({reason: "install"}));

        expect(harness.tabs.events.onUpdated.listenerCount()).toBe(1);
        expect(harness.tabs.events.onRemoved.listenerCount()).toBe(1);
        expect(harness.tabs.events.onReplaced.listenerCount()).toBe(1);
        expect(harness.scripting.executeScript.calls).toHaveLength(0);

        const unfrozen = tab(1, {frozen: false});
        harness.tabs.set([unfrozen]);
        await harness.tabs.events.onUpdated.emit(1, {frozen: false}, unfrozen);

        expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
            [{files: ["content.js"], target: {tabId: 1}}],
        ]);

        expect(harness.tabs.events.onUpdated.listenerCount()).toBe(0);
        expect(harness.tabs.events.onRemoved.listenerCount()).toBe(0);
        expect(harness.tabs.events.onReplaced.listenerCount()).toBe(0);
    });

    it("removes listeners immediately when the install pass creates no pending work", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(2)],
        });

        definition.main();
        await harness.runtime.events.onInstalled.emit(createInstalledDetailsFixture({reason: "install"}));

        expect(harness.scripting.executeScript.calls).toHaveLength(1);
        expect(harness.tabs.events.onUpdated.listenerCount()).toBe(0);
        expect(harness.tabs.events.onRemoved.listenerCount()).toBe(0);
        expect(harness.tabs.events.onReplaced.listenerCount()).toBe(0);
    });

    it("runs MV2 catch-up without storage.session or tab listeners", async () => {
        const harness = setup(
            {
                manifest: createManifestFixture({
                    content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
                    manifest_version: 2,
                }),
                tabs: [tab(3)],
            },
            false
        );

        definition.main();

        expect(chrome.storage).toBeUndefined();
        expect(harness.runtime.events.onInstalled.listenerCount()).toBe(1);
        expect(harness.tabs.events.onUpdated.listenerCount()).toBe(0);
        expect(harness.tabs.events.onRemoved.listenerCount()).toBe(0);
        expect(harness.tabs.events.onReplaced.listenerCount()).toBe(0);

        await harness.runtime.events.onInstalled.emit(createInstalledDetailsFixture({reason: "install"}));

        expect(harness.tabs.executeScript.calls.map(call => call.args)).toEqual([[3, {file: "content.js"}]]);
    });

    it("removes pending work when its tab starts loading", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(4, {frozen: true})],
        });

        definition.main();
        await harness.runtime.events.onInstalled.emit(createInstalledDetailsFixture({reason: "install"}));
        await harness.tabs.events.onUpdated.emit(4, {status: "loading"}, tab(4, {status: "loading"}));

        expect(harness.scripting.executeScript.calls).toHaveLength(0);
        expect(harness.tabs.events.onUpdated.listenerCount()).toBe(0);
    });

    it("removes pending work when its tab closes", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(5, {frozen: true})],
        });

        definition.main();
        await harness.runtime.events.onInstalled.emit(createInstalledDetailsFixture({reason: "install"}));
        await harness.tabs.events.onRemoved.emit(5, {isWindowClosing: false, windowId: 1});

        expect(harness.scripting.executeScript.calls).toHaveLength(0);
        expect(harness.tabs.events.onRemoved.listenerCount()).toBe(0);
    });

    it("drops pending work instead of transferring it to a replacement document", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(6, {frozen: true})],
        });

        definition.main();
        await harness.runtime.events.onInstalled.emit(createInstalledDetailsFixture({reason: "install"}));
        harness.tabs.set([tab(7)]);
        await harness.tabs.events.onReplaced.emit(7, 6);

        expect(harness.scripting.executeScript.calls).toHaveLength(0);
        expect(harness.tabs.events.onReplaced.listenerCount()).toBe(0);
    });

    it("contains restore failures during installation", async () => {
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.spyOn(PendingTabs.prototype, "restore").mockRejectedValue(new Error("storage unavailable"));
        const harness = setup();

        definition.main();

        await expect(
            harness.runtime.events.onInstalled.emit(createInstalledDetailsFixture({reason: "install"}))
        ).resolves.toBeUndefined();

        expect(consoleError).toHaveBeenCalledWith("[@adnbn/plugin-reg-cs] install failed", {
            error: expect.any(Error),
        });
    });

    it("contains storage failures from tab events", async () => {
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.spyOn(PendingTabs.prototype, "remove").mockRejectedValue(new Error("storage unavailable"));
        const harness = setup();

        definition.main();

        await expect(
            harness.tabs.events.onUpdated.emit(8, {status: "loading"}, tab(8, {status: "loading"}))
        ).resolves.toBeUndefined();

        expect(consoleError).toHaveBeenCalledWith("[@adnbn/plugin-reg-cs] storage failed", {
            error: expect.any(Error),
        });
    });

    it("registers no runtime listeners for Firefox", () => {
        framework.getBrowser.mockReturnValue("firefox");
        const harness = setup();

        definition.main();

        expect(harness.runtime.events.onInstalled.listenerCount()).toBe(0);
        expect(harness.tabs.events.onUpdated.listenerCount()).toBe(0);
    });
});
