import type {BrowserHarness, BrowserHarnessOptions} from "@addon-core/browser/testing";
import {createManifestFixture, createTabFixture} from "@addon-core/browser/testing";

import type {ReadyTab} from "../../plugin/background/content";
import {PendingTabs} from "../../plugin/background/PendingTabs";
import {setupBrowserHarness} from "../helpers/browser";

let restoreGlobals: VoidFunction | undefined;

const tab = (id: number, overrides: Partial<chrome.tabs.Tab> = {}): ReadyTab => {
    return createTabFixture({id, title: "Tab " + id, url: "https://example.com/page", ...overrides}) as ReadyTab;
};

const setup = (options: BrowserHarnessOptions = {}): BrowserHarness => {
    const context = setupBrowserHarness(options);
    restoreGlobals = context.restore;

    return context.browser;
};

afterEach(() => {
    restoreGlobals?.();
    restoreGlobals = undefined;
});

describe("pending tabs", () => {
    it("keeps a frozen tab pending and injects it once after it becomes available", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(1, {frozen: true})],
        });

        const pending = new PendingTabs();

        await pending.add(tab(1, {frozen: true}), 0);
        await pending.add(tab(1, {frozen: true}), 0);

        expect(await pending.resume(1)).toBe(1);
        expect(await pending.has()).toBe(true);
        expect(harness.scripting.executeScript.calls).toHaveLength(0);

        harness.tabs.set([tab(1, {frozen: false})]);

        expect(await pending.resume(1)).toBe(0);
        expect(await pending.has()).toBe(false);

        expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
            [{files: ["content.js"], target: {tabId: 1}}],
        ]);
    });

    it("drops stale state when the tab navigated while it was pending", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(2, {frozen: true})],
        });

        const pending = new PendingTabs();

        await pending.add(tab(2, {frozen: true}), 0);
        harness.tabs.set([tab(2, {frozen: false, url: "https://other.example/page"})]);

        expect(await pending.resume(2)).toBe(0);
        expect(await pending.has()).toBe(false);
        expect(harness.scripting.executeScript.calls).toHaveLength(0);
    });

    it("restores session state with a new PendingTabs instance", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(3, {frozen: true})],
        });

        await new PendingTabs().add(tab(3, {frozen: true}), 0);
        harness.tabs.set([tab(3, {frozen: false})]);

        expect(await new PendingTabs().restore()).toBe(0);

        expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
            [{files: ["content.js"], target: {tabId: 3}}],
        ]);
    });

    it("removes pending work when getTab reports that the tab no longer exists", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(4)],
        });

        const pending = new PendingTabs();

        await pending.add(tab(4, {frozen: true}), 0);
        harness.tabs.get.failNext(new Error("missing tab"));

        expect(await pending.resume(4)).toBe(0);
        expect(await pending.has()).toBe(false);
        expect(harness.scripting.executeScript.calls).toHaveLength(0);
    });

    it("deduplicates concurrent resume events for one tab", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(7)],
        });

        const pending = new PendingTabs();

        await pending.add(tab(7, {frozen: true}), 0);

        await Promise.all([pending.resume(7), pending.resume(7)]);

        expect(await pending.has()).toBe(false);

        expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
            [{files: ["content.js"], target: {tabId: 7}}],
        ]);
    });

    it("removes claimed work when host access is no longer available", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            permissions: {origins: []},
            tabs: [tab(6)],
        });

        const pending = new PendingTabs();

        await pending.add(tab(6, {frozen: true}), 0);

        expect(await pending.resume(6)).toBe(0);
        expect(await pending.has()).toBe(false);
        expect(harness.scripting.executeScript.calls).toHaveLength(0);
    });

    it("continues restore when one resume rejects", async () => {
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(8), tab(9)],
        });

        const pending = new PendingTabs();

        await pending.add(tab(8, {frozen: true}), 0);
        await pending.add(tab(9, {frozen: true}), 0);

        const resume = pending.resume.bind(pending);

        jest.spyOn(pending, "resume").mockImplementation(tabId => {
            return tabId === 8 ? Promise.reject(new Error("resume failed")) : resume(tabId);
        });

        expect(await pending.restore()).toBe(1);

        expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
            [{files: ["content.js"], target: {tabId: 9}}],
        ]);

        expect(consoleError).toHaveBeenCalledWith("[@adnbn/plugin-reg-cs] storage failed", {
            error: expect.any(Error),
        });
    });
});
