import {beforeEach, describe, expect, it, rs} from "@rstest/core";

type InstalledDetails = {
    reason: string;
};

type InstalledListener = (details: InstalledDetails) => Promise<void>;
type PermissionsAddedListener = () => Promise<void>;

type BackgroundDefinition = {
    permissions: string[];
    main: (context: {permissions: string[]}) => Promise<void>;
};

type Manifest = chrome.runtime.Manifest;
type Tab = chrome.tabs.Tab;

const mocks = rs.hoisted(() => {
    const state = {
        installedListener: undefined as InstalledListener | undefined,
        manifest: {} as Manifest,
        permissionsAddedListener: undefined as PermissionsAddedListener | undefined,
    };

    const offPermissionsAdded = rs.fn();
    const scriptFile = rs.fn(async (_files: string[]) => undefined);
    const cssFile = rs.fn(async (_files: string[]) => undefined);

    return {
        state,
        containsPermissions: rs.fn(async (_permissions: chrome.permissions.Permissions) => false),
        cssFile,
        defineBackground: rs.fn((definition: BackgroundDefinition) => definition),
        getManifest: rs.fn(() => state.manifest),
        injectCssFactory: rs.fn((_options: Record<string, unknown>) => ({file: cssFile})),
        injectScriptFactory: rs.fn((_options: Record<string, unknown>) => ({file: scriptFile})),
        offPermissionsAdded,
        onInstalled: rs.fn((listener: InstalledListener) => {
            state.installedListener = listener;
        }),
        onPermissionsAdded: rs.fn((listener: PermissionsAddedListener) => {
            state.permissionsAddedListener = listener;
            return offPermissionsAdded;
        }),
        queryTabs: rs.fn(async (_query: chrome.tabs.QueryInfo) => [] as Tab[]),
        scriptFile,
    };
});

rs.mock("adnbn", () => ({
    defineBackground: mocks.defineBackground,
}));

rs.mock("@addon-core/browser", () => ({
    containsPermissions: mocks.containsPermissions,
    getManifest: mocks.getManifest,
    onInstalled: mocks.onInstalled,
    onPermissionsAdded: mocks.onPermissionsAdded,
    queryTabs: mocks.queryTabs,
}));

rs.mock("@addon-core/inject-css", () => ({
    default: mocks.injectCssFactory,
}));

rs.mock("@addon-core/inject-script", () => ({
    default: mocks.injectScriptFactory,
}));

import background from "../plugin/background";

const definition = background as unknown as BackgroundDefinition;
const permissions = ["tabs", "scripting"];

const tabs = (...items: Array<Partial<Tab>>): Tab[] => items as Tab[];

const install = async (reason = "install"): Promise<void> => {
    await definition.main({permissions});

    expect(mocks.state.installedListener).toBeDefined();
    await mocks.state.installedListener!({reason});
};

beforeEach(() => {
    mocks.state.installedListener = undefined;
    mocks.state.manifest = {} as Manifest;
    mocks.state.permissionsAddedListener = undefined;

    mocks.containsPermissions.mockReset().mockResolvedValue(false);
    mocks.cssFile.mockReset().mockResolvedValue(undefined);
    mocks.getManifest.mockReset().mockImplementation(() => mocks.state.manifest);
    mocks.injectCssFactory.mockClear();
    mocks.injectScriptFactory.mockClear();
    mocks.offPermissionsAdded.mockClear();
    mocks.onInstalled.mockReset().mockImplementation(listener => {
        mocks.state.installedListener = listener;
    });
    mocks.onPermissionsAdded.mockReset().mockImplementation(listener => {
        mocks.state.permissionsAddedListener = listener;
        return mocks.offPermissionsAdded;
    });
    mocks.queryTabs.mockReset().mockResolvedValue([]);
    mocks.scriptFile.mockReset().mockResolvedValue(undefined);
});

describe("background registration", () => {
    it("declares the permissions required by dynamic content-script injection", () => {
        expect(definition.permissions).toEqual(["tabs", "scripting"]);
        expect(definition.main).toEqual(expect.any(Function));
    });

    it("does not inject when the manifest has no content scripts", async () => {
        mocks.containsPermissions.mockResolvedValue(true);

        await install();

        expect(mocks.containsPermissions).toHaveBeenCalledWith({
            permissions,
            origins: undefined,
        });
        expect(mocks.onPermissionsAdded).not.toHaveBeenCalled();
        expect(mocks.queryTabs).not.toHaveBeenCalled();
        expect(mocks.injectScriptFactory).not.toHaveBeenCalled();
        expect(mocks.injectCssFactory).not.toHaveBeenCalled();
    });

    it("injects the declared JavaScript and CSS when host permissions are already granted", async () => {
        mocks.state.manifest = {
            content_scripts: [
                {
                    all_frames: true,
                    css: ["content.css"],
                    js: ["content.js"],
                    match_about_blank: true,
                    matches: ["https://example.com/*"],
                    run_at: "document_idle",
                    world: "MAIN",
                },
            ],
        } as Manifest;
        mocks.containsPermissions.mockResolvedValue(true);
        mocks.queryTabs.mockResolvedValue(tabs({id: 42, title: "Example"}));

        await install();

        expect(mocks.containsPermissions).toHaveBeenCalledWith({
            permissions,
            origins: ["https://example.com/*"],
        });
        expect(mocks.queryTabs).toHaveBeenCalledWith({url: ["https://example.com/*"]});
        expect(mocks.injectScriptFactory).toHaveBeenCalledWith({
            tabId: 42,
            frameId: true,
            matchAboutBlank: true,
            runAt: "document_idle",
            world: "MAIN",
        });
        expect(mocks.injectCssFactory).toHaveBeenCalledWith({
            tabId: 42,
            frameId: true,
            matchAboutBlank: true,
            runAt: "document_idle",
        });
        expect(mocks.scriptFile).toHaveBeenCalledWith(["content.js"]);
        expect(mocks.cssFile).toHaveBeenCalledWith(["content.css"]);
        expect(mocks.onPermissionsAdded).not.toHaveBeenCalled();
    });

    it("filters tabs without an id and tabs that are frozen or discarded", async () => {
        mocks.state.manifest = {
            content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
        } as Manifest;
        mocks.containsPermissions.mockResolvedValue(true);
        mocks.queryTabs.mockResolvedValue(
            tabs(
                {title: "No id"},
                {frozen: true, id: 1, title: "Frozen"},
                {discarded: true, id: 2, title: "Discarded"},
                {discarded: false, frozen: false, id: 3, title: "Injectable"}
            )
        );

        await install();

        expect(mocks.injectScriptFactory).toHaveBeenCalledTimes(1);
        expect(mocks.injectScriptFactory).toHaveBeenCalledWith(
            expect.objectContaining({
                tabId: 3,
            })
        );
        expect(mocks.scriptFile).toHaveBeenCalledTimes(1);
    });

    it("waits for permissions, registers once they are granted, and removes its listener", async () => {
        mocks.state.manifest = {
            content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
        } as Manifest;
        mocks.containsPermissions.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        mocks.queryTabs.mockResolvedValue(tabs({id: 7, title: "Allowed later"}));

        await install();

        expect(mocks.onPermissionsAdded).toHaveBeenCalledTimes(1);
        expect(mocks.state.permissionsAddedListener).toBeDefined();
        expect(mocks.injectScriptFactory).not.toHaveBeenCalled();
        expect(mocks.offPermissionsAdded).not.toHaveBeenCalled();

        await mocks.state.permissionsAddedListener!();

        expect(mocks.injectScriptFactory).not.toHaveBeenCalled();
        expect(mocks.offPermissionsAdded).not.toHaveBeenCalled();

        await mocks.state.permissionsAddedListener!();

        expect(mocks.injectScriptFactory).toHaveBeenCalledTimes(1);
        expect(mocks.scriptFile).toHaveBeenCalledWith(["content.js"]);
        expect(mocks.offPermissionsAdded).toHaveBeenCalledTimes(1);
    });

    it("runs only for a fresh extension install", async () => {
        mocks.state.manifest = {
            content_scripts: [{js: ["content.js"], matches: ["https://example.com/*"]}],
        } as Manifest;

        await install("update");

        expect(mocks.containsPermissions).not.toHaveBeenCalled();
        expect(mocks.onPermissionsAdded).not.toHaveBeenCalled();
        expect(mocks.queryTabs).not.toHaveBeenCalled();
        expect(mocks.injectScriptFactory).not.toHaveBeenCalled();
    });

    it("isolates injection failures, logs them, and continues with the remaining tabs", async () => {
        const scriptError = new Error("script failed");
        const cssError = new Error("css failed");
        const consoleError = rs.spyOn(console, "error").mockImplementation(() => undefined);

        mocks.state.manifest = {
            content_scripts: [
                {
                    css: ["content.css"],
                    js: ["content.js"],
                    matches: ["https://example.com/*"],
                },
            ],
        } as Manifest;
        mocks.containsPermissions.mockResolvedValue(true);
        mocks.queryTabs.mockResolvedValue(tabs({id: 10, title: "Broken"}, {id: 11, title: "Still processed"}));
        mocks.scriptFile.mockRejectedValueOnce(scriptError).mockResolvedValueOnce(undefined);
        mocks.cssFile.mockRejectedValueOnce(cssError).mockResolvedValueOnce(undefined);

        try {
            await expect(install()).resolves.toBeUndefined();

            expect(mocks.scriptFile).toHaveBeenCalledTimes(2);
            expect(mocks.cssFile).toHaveBeenCalledTimes(2);
            expect(consoleError).toHaveBeenCalledWith('ExecuteScript error on tab "Broken":', scriptError);
            expect(consoleError).toHaveBeenCalledWith('InsertCSS error on tab "Broken":', cssError);
        } finally {
            consoleError.mockRestore();
        }
    });

    it("isolates a content-script query failure from the other declarations", async () => {
        mocks.state.manifest = {
            content_scripts: [
                {js: ["first.js"], matches: ["https://first.example/*"]},
                {js: ["second.js"], matches: ["https://second.example/*"]},
            ],
        } as Manifest;
        mocks.containsPermissions.mockResolvedValue(true);
        mocks.queryTabs
            .mockRejectedValueOnce(new Error("query failed"))
            .mockResolvedValueOnce(tabs({id: 12, title: "Second declaration"}));

        await expect(install()).resolves.toBeUndefined();

        expect(mocks.queryTabs).toHaveBeenCalledTimes(2);
        expect(mocks.scriptFile).toHaveBeenCalledTimes(1);
        expect(mocks.scriptFile).toHaveBeenCalledWith(["second.js"]);
    });
});
