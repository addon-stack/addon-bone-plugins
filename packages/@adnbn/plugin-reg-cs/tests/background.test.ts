// Only the Addon Bone build-time boundary is replaced. Browser wrappers and injection packages stay real.
jest.mock("adnbn", () => ({
    Browser: {Firefox: "firefox"},
    defineBackground: (definition: unknown) => definition,
    getBrowser: jest.fn(),
}));

import type {BrowserHarness, BrowserHarnessOptions} from "@addon-core/browser/testing";
import {
    createBrowserHarness,
    createInjectionResultFixture,
    createInstalledDetailsFixture,
    createManifestFixture,
    createTabFixture,
    installBrowserGlobals,
} from "@addon-core/browser/testing";

import background from "../plugin/background";

interface BackgroundDefinition {
    main(): Promise<void>;
    permissions: string[];
}

const definition = background as unknown as BackgroundDefinition;
const framework = jest.requireMock<{getBrowser: jest.Mock}>("adnbn");
let restoreGlobals: (() => void) | undefined;

const setup = (options: BrowserHarnessOptions = {}): BrowserHarness => {
    const harness = createBrowserHarness({permissions: {origins: ["<all_urls>"]}, ...options});
    restoreGlobals = installBrowserGlobals(harness, {context: "serviceWorker", profile: "chrome"});

    // Model successful native calls, not execution of CSS/JS in a real document.
    harness.scripting.insertCSS.setResult(undefined);
    harness.scripting.executeScript.setResult([createInjectionResultFixture()]);
    harness.tabs.insertCSS.setResult(undefined);
    harness.tabs.executeScript.setResult([]);

    return harness;
};

const tab = (id: number, overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab => {
    return createTabFixture({id, title: `Tab ${id}`, url: "https://example.com/page", ...overrides});
};

const install = async (
    harness: BrowserHarness,
    reason: chrome.runtime.InstalledDetails["reason"] = "install"
): Promise<void> => {
    await definition.main();
    await harness.runtime.events.onInstalled.emit(createInstalledDetailsFixture({reason}));
};

beforeEach(() => {
    framework.getBrowser.mockReset().mockReturnValue("chromium");
});

afterEach(() => {
    restoreGlobals?.();
    restoreGlobals = undefined;
});

describe("background registration", () => {
    it("declares only the APIs required for immediate injection", () => {
        expect(definition.permissions).toEqual(["tabs", "scripting"]);
        expect(definition.main).toEqual(expect.any(Function));
    });

    it.each(["update", "chrome_update", "shared_module_update"] as const)("ignores the %s event", async reason => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(1)],
        });

        await install(harness, reason);

        expect(harness.runtime.getManifest.calls).toHaveLength(0);
        expect(harness.permissions.contains.calls).toHaveLength(0);
        expect(harness.tabs.query.calls).toHaveLength(0);
        expect(harness.scripting.executeScript.calls).toHaveLength(0);
    });

    it("does nothing when the manifest has no content scripts", async () => {
        const harness = setup();

        await install(harness);

        expect(harness.permissions.contains.calls).toHaveLength(0);
        expect(harness.tabs.query.calls).toHaveLength(0);
        expect(harness.scripting.insertCSS.calls).toHaveLength(0);
        expect(harness.scripting.executeScript.calls).toHaveLength(0);
    });

    it("uses the Firefox build target to skip catch-up even with Chrome API globals", async () => {
        framework.getBrowser.mockReturnValue("firefox");

        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [tab(1)],
        });

        await install(harness);

        expect(framework.getBrowser).toHaveBeenCalledTimes(1);
        expect(harness.runtime.getManifest.calls).toHaveLength(0);
        expect(harness.permissions.contains.calls).toHaveLength(0);
        expect(harness.tabs.query.calls).toHaveLength(0);
        expect(harness.scripting.executeScript.calls).toHaveLength(0);
    });

    it("injects active and background tabs without waking frozen, discarded, or incomplete tabs", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{css: ["content.css"], js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
            tabs: [
                tab(1, {active: false}),
                tab(2, {active: false, status: "loading"}),
                tab(3, {active: false, discarded: true}),
                tab(4, {active: false, frozen: true}),
                tab(5, {url: undefined}),
                tab(6, {url: "https://example.com:8443/page"}),
                tab(7, {url: "https://other.example/page"}),
            ],
        });

        await install(harness);

        expect(harness.tabs.query.calls.map(call => call.args)).toEqual([
            [{discarded: false, status: "complete", url: ["https://example.com/*"]}],
        ]);

        expect(harness.scripting.insertCSS.calls.map(call => call.args)).toEqual([
            [{files: ["content.css"], target: {tabId: 1}}],
            [{files: ["content.css"], target: {tabId: 6}}],
        ]);

        expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
            [{files: ["content.js"], target: {tabId: 1}}],
            [{files: ["content.js"], target: {tabId: 6}}],
        ]);

        expect(harness.tabs.update.calls).toHaveLength(0);
        expect(harness.tabs.reload.calls).toHaveLength(0);
        expect(harness.tabs.values.find(value => value.id === 1)?.active).toBe(false);
        expect(harness.tabs.values.find(value => value.id === 3)?.discarded).toBe(true);
        expect(harness.tabs.values.find(value => value.id === 4)?.frozen).toBe(true);
    });

    it("defensively ignores query results without an ID or URL", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
            }),
        });

        // The stateful tab collection supplies IDs; override only this malformed-response scenario.
        harness.tabs.query.setResult([tab(1, {id: undefined}), tab(2, {url: undefined})]);

        await install(harness);

        expect(harness.scripting.executeScript.calls).toHaveLength(0);
    });

    it("matches localhost on an arbitrary port", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [{js: ["content.js"], matches: ["http://127.0.0.1/*"]}],
            }),
            tabs: [tab(1, {active: false, url: "http://127.0.0.1:62778/top.html"})],
        });

        await install(harness);

        expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
            [{files: ["content.js"], target: {tabId: 1}}],
        ]);
    });

    it("applies matches, exclude_matches, include_globs, and exclude_globs", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [
                    {
                        exclude_globs: ["*blocked=yes*"],
                        exclude_matches: ["https://example.com/allowed/private/*"],
                        include_globs: ["*example.com/allowed/*"],
                        js: ["content.js"],
                        matches: ["https://example.com/*"],
                    },
                ],
            }),
            tabs: [
                tab(10, {url: "https://example.com/allowed/page#fragment"}),
                tab(11, {url: "https://example.com/allowed/private/page"}),
                tab(12, {url: "https://example.com/other/page"}),
                tab(13, {url: "https://example.com/allowed/page?blocked=yes"}),
                tab(14, {url: "https://other.example/allowed/page"}),
            ],
        });

        await install(harness);

        expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
            [{files: ["content.js"], target: {tabId: 10}}],
        ]);
    });

    it("checks host permissions per declaration and preserves declaration and whole-file-array order", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [
                    {
                        css: ["first-a.css", "first-b.css"],
                        js: ["first-a.js", "first-b.js"],
                        matches: ["https://example.com/*"],
                    },
                    {css: ["second.css"], js: ["second.js"], matches: ["https://example.com/*"]},
                ],
            }),
            tabs: [tab(20)],
        });

        await install(harness);

        expect(harness.permissions.contains.calls.map(call => call.args)).toEqual([
            [{origins: ["https://example.com/*"]}],
            [{origins: ["https://example.com/*"]}],
        ]);

        expect(
            harness.calls.filter(call => call.api.startsWith("scripting.")).map(call => [call.api, call.args])
        ).toEqual([
            ["scripting.insertCSS", [{files: ["first-a.css", "first-b.css"], target: {tabId: 20}}]],
            ["scripting.executeScript", [{files: ["first-a.js", "first-b.js"], target: {tabId: 20}}]],
            ["scripting.insertCSS", [{files: ["second.css"], target: {tabId: 20}}]],
            ["scripting.executeScript", [{files: ["second.js"], target: {tabId: 20}}]],
        ]);
    });

    it("awaits CSS before JS and the next declaration while allowing another tab to finish", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [
                    {css: ["first.css"], js: ["first.js"], matches: ["https://example.com/*"]},
                    {js: ["second.js"], matches: ["https://example.com/*"]},
                ],
            }),
            tabs: [tab(1), tab(2)],
        });

        const cssCompletion = Promise.withResolvers<void>();
        const otherTabFinished = Promise.withResolvers<void>();

        const insertCssImplementation = ((injection: chrome.scripting.CSSInjection, callback?: () => void) => {
            const result = injection.target.tabId === 1 ? cssCompletion.promise : Promise.resolve();

            if (!callback) {
                return result;
            }

            void result.then(callback);
        }) as typeof chrome.scripting.insertCSS;

        const executeScriptImplementation = ((
            injection: Parameters<typeof chrome.scripting.executeScript>[0],
            callback?: NonNullable<Parameters<typeof chrome.scripting.executeScript>[1]>
        ) => {
            if (injection.target.tabId === 2) {
                otherTabFinished.resolve();
            }

            const results: never[] = [];

            if (!callback) {
                return Promise.resolve(results);
            }

            callback(results);
        }) as typeof chrome.scripting.executeScript;

        harness.scripting.insertCSS.setImplementation(insertCssImplementation);
        harness.scripting.executeScript.setImplementation(executeScriptImplementation);

        const dispatch = install(harness);

        const timeout = setTimeout(
            () => otherTabFinished.reject(new Error("The independent tab did not finish")),
            1000
        );

        try {
            await otherTabFinished.promise;

            expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
                [{files: ["first.js"], target: {tabId: 2}}],
            ]);

            expect(harness.permissions.contains.calls).toHaveLength(1);
            cssCompletion.resolve();
            await dispatch;

            expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
                [{files: ["first.js"], target: {tabId: 2}}],
                [{files: ["first.js"], target: {tabId: 1}}],
                [{files: ["second.js"], target: {tabId: 1}}],
                [{files: ["second.js"], target: {tabId: 2}}],
            ]);
        } finally {
            clearTimeout(timeout);
            cssCompletion.resolve();
            await dispatch;
        }
    });

    it("skips denied declarations, accepts broader grants, and does not wait for later permissions", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [
                    {js: ["denied.js"], matches: ["https://denied.test/*"]},
                    {js: ["allowed.js"], matches: ["https://shop.example.com/*"]},
                ],
            }),
            permissions: {origins: ["https://*.example.com/*"]},
            tabs: [tab(30, {url: "https://shop.example.com/page"}), tab(31, {url: "https://denied.test/page"})],
        });

        await install(harness);
        await harness.permissions.grant({origins: ["https://denied.test/*"]});

        expect(harness.tabs.query.calls.map(call => call.args)).toEqual([
            [{discarded: false, status: "complete", url: ["https://shop.example.com/*"]}],
        ]);

        expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
            [{files: ["allowed.js"], target: {tabId: 30}}],
        ]);

        expect(harness.permissions.request.calls).toHaveLength(0);
    });

    it("skips declarations without matches or files", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [
                    {js: ["content.js"], matches: []},
                    {css: [], js: [], matches: ["https://example.com/*"]},
                ],
            }),
            tabs: [tab(1)],
        });

        await install(harness);

        expect(harness.permissions.contains.calls).toHaveLength(1);
        expect(harness.scripting.insertCSS.calls).toHaveLength(0);
        expect(harness.scripting.executeScript.calls).toHaveLength(0);
    });

    it("passes allFrames, CSS origin, and execution world to real MV3 adapters", async () => {
        const contentScript = {
            all_frames: true,
            css: ["content.css"],
            css_origin: "USER",
            js: ["content.js"],
            match_about_blank: true,
            matches: ["https://example.com/*"],
            world: "MAIN",
        };

        const harness = setup({
            manifest: createManifestFixture({content_scripts: [contentScript]}),
            tabs: [tab(40)],
        });

        await install(harness);

        expect(harness.scripting.insertCSS.calls.map(call => call.args)).toEqual([
            [{files: ["content.css"], origin: "USER", target: {allFrames: true, tabId: 40}}],
        ]);

        expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
            [{files: ["content.js"], target: {allFrames: true, tabId: 40}, world: "MAIN"}],
        ]);

        expect(harness.tabs.insertCSS.calls).toHaveLength(0);
        expect(harness.tabs.executeScript.calls).toHaveLength(0);
    });

    it("uses real MV2 adapters with sequential files and matchAboutBlank", async () => {
        const harness = setup({
            manifest: createManifestFixture({
                manifest_version: 2,
                content_scripts: [
                    {
                        all_frames: true,
                        css: ["a.css", "b.css"],
                        js: ["a.js", "b.js"],
                        match_about_blank: true,
                        matches: ["https://example.com/*"],
                    },
                ],
            }),
            tabs: [tab(41)],
        });

        await install(harness);

        expect(harness.tabs.insertCSS.calls.map(call => call.args)).toEqual([
            [41, {allFrames: true, file: "a.css", matchAboutBlank: true}],
            [41, {allFrames: true, file: "b.css", matchAboutBlank: true}],
        ]);

        expect(harness.tabs.executeScript.calls.map(call => call.args)).toEqual([
            [41, {allFrames: true, file: "a.js", matchAboutBlank: true}],
            [41, {allFrames: true, file: "b.js", matchAboutBlank: true}],
        ]);

        expect(
            harness.calls.filter(call => /tabs\.(insertCSS|executeScript)/.test(call.api)).map(call => call.api)
        ).toEqual(["tabs.insertCSS", "tabs.insertCSS", "tabs.executeScript", "tabs.executeScript"]);

        expect(harness.scripting.insertCSS.calls).toHaveLength(0);
        expect(harness.scripting.executeScript.calls).toHaveLength(0);
    });

    it.each(["css", "js"] as const)(
        "isolates a %s injection failure without skipping JS or other tabs",
        async phase => {
            const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

            const harness = setup({
                manifest: createManifestFixture({
                    content_scripts: [{css: ["content.css"], js: ["content.js"], matches: ["https://example.com/*"]}],
                }),
                tabs: [tab(50), tab(51)],
            });

            const method = phase === "css" ? harness.scripting.insertCSS : harness.scripting.executeScript;
            method.failNext(new Error(`${phase} failed`));

            await expect(install(harness)).resolves.toBeUndefined();

            expect(harness.scripting.insertCSS.calls).toHaveLength(2);
            expect(harness.scripting.executeScript.calls).toHaveLength(2);
            expect(consoleError).toHaveBeenCalledTimes(1);

            expect(consoleError).toHaveBeenCalledWith(`[@adnbn/plugin-reg-cs] ${phase} failed`, {
                declarationIndex: 0,
                error: expect.any(Error),
                tabId: 50,
                title: "Tab 50",
            });
        }
    );

    it.each(["permission", "query"] as const)("isolates a %s failure from later declarations", async phase => {
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

        const harness = setup({
            manifest: createManifestFixture({
                content_scripts: [
                    {js: ["first.js"], matches: ["https://first.example/*"]},
                    {js: ["second.js"], matches: ["https://second.example/*"]},
                ],
            }),
            tabs: [tab(60, {url: "https://second.example/page"})],
        });

        const method = phase === "permission" ? harness.permissions.contains : harness.tabs.query;
        method.failNext(new Error(`${phase} failed`));

        await expect(install(harness)).resolves.toBeUndefined();

        expect(harness.scripting.executeScript.calls.map(call => call.args)).toEqual([
            [{files: ["second.js"], target: {tabId: 60}}],
        ]);

        expect(consoleError).toHaveBeenCalledTimes(1);

        expect(consoleError).toHaveBeenCalledWith(`[@adnbn/plugin-reg-cs] ${phase} failed`, {
            declarationIndex: 0,
            error: expect.any(Error),
        });
    });
});
