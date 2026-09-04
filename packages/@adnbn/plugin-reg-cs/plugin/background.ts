import {Browser, defineBackground, getBrowser} from "adnbn";

import {containsPermissions, getManifest, isManifestVersion3, onInstalled, queryTabs} from "@addon-core/browser";
import injectCss, {type InjectCssTarget, type NonEmptyReadonlyArray} from "@addon-core/inject-css";
import injectScript from "@addon-core/inject-script";

import {globToRegex, testPatterns} from "webext-patterns";

type ManifestContentScript = NonNullable<chrome.runtime.Manifest["content_scripts"]>[number];

type ContentScript = ManifestContentScript & {
    css_origin?: chrome.scripting.StyleOrigin;
    world?: chrome.scripting.ExecutionWorld;
};

type InjectableTab = chrome.tabs.Tab & {id: number; url: string};

const logFailure = (phase: "permission" | "query" | "css" | "js", error: unknown, details = {}): void => {
    console.error(`[@adnbn/plugin-reg-cs] ${phase} failed`, {...details, error});
};

const isNonEmpty = <Value>(values: readonly Value[] | undefined): values is NonEmptyReadonlyArray<Value> => {
    return values !== undefined && values.length > 0;
};

const isInjectableTab = (tab: chrome.tabs.Tab): tab is InjectableTab => {
    return (
        tab.id !== undefined &&
        typeof tab.url === "string" &&
        tab.status === "complete" &&
        !tab.discarded &&
        !tab.frozen
    );
};

const withoutFragment = (url: string): string | undefined => {
    try {
        const parsed = new URL(url);
        parsed.hash = "";
        parsed.port = "";

        return parsed.href;
    } catch {
        return undefined;
    }
};

const matchesContentScript = (contentScript: ContentScript, url: string): boolean => {
    const matchUrl = withoutFragment(url);

    if (!matchUrl || !contentScript.matches?.length || !testPatterns(matchUrl, contentScript.matches)) {
        return false;
    }

    if (contentScript.exclude_matches?.length && testPatterns(matchUrl, contentScript.exclude_matches)) {
        return false;
    }

    if (contentScript.include_globs?.length && !globToRegex(...contentScript.include_globs).test(url)) {
        return false;
    }

    if (contentScript.exclude_globs?.length && globToRegex(...contentScript.exclude_globs).test(url)) {
        return false;
    }

    return true;
};

const injectContentScript = async (
    contentScript: ContentScript,
    declarationIndex: number,
    tab: InjectableTab,
    manifestVersion3: boolean
): Promise<void> => {
    const target: InjectCssTarget = contentScript.all_frames ? {allFrames: true, tabId: tab.id} : {tabId: tab.id};
    const details = {declarationIndex, tabId: tab.id, title: tab.title};
    const matchAboutBlank = !manifestVersion3 && contentScript.match_about_blank ? true : undefined;

    if (isNonEmpty(contentScript.css)) {
        try {
            await injectCss({
                target,
                ...(contentScript.css_origin ? {origin: contentScript.css_origin} : {}),
                ...(matchAboutBlank ? {matchAboutBlank} : {}),
            }).file(contentScript.css);
        } catch (error) {
            logFailure("css", error, details);
        }
    }

    if (isNonEmpty(contentScript.js)) {
        try {
            await injectScript({
                target,
                ...(manifestVersion3 && contentScript.world ? {world: contentScript.world} : {}),
                ...(matchAboutBlank ? {matchAboutBlank} : {}),
            }).file(contentScript.js);
        } catch (error) {
            logFailure("js", error, details);
        }
    }
};

const activateDeclaration = async (
    contentScript: ContentScript,
    declarationIndex: number,
    manifestVersion3: boolean
): Promise<void> => {
    if (!contentScript.matches?.length) {
        return;
    }

    try {
        if (!(await containsPermissions({origins: [...contentScript.matches]}))) {
            return;
        }
    } catch (error) {
        logFailure("permission", error, {declarationIndex});

        return;
    }

    let tabs: chrome.tabs.Tab[];

    try {
        tabs = await queryTabs({
            discarded: false,
            status: "complete",
            url: [...contentScript.matches],
        });
    } catch (error) {
        logFailure("query", error, {declarationIndex});

        return;
    }

    const injectableTabs = tabs.filter(isInjectableTab).filter(tab => matchesContentScript(contentScript, tab.url));

    await Promise.allSettled(
        injectableTabs.map(tab => injectContentScript(contentScript, declarationIndex, tab, manifestVersion3))
    );
};

const activateContentScripts = async (): Promise<void> => {
    if (getBrowser() === Browser.Firefox) {
        return;
    }

    const contentScripts = (getManifest().content_scripts ?? []) as ContentScript[];
    const manifestVersion3 = isManifestVersion3();

    for (const [declarationIndex, contentScript] of contentScripts.entries()) {
        await activateDeclaration(contentScript, declarationIndex, manifestVersion3);
    }
};

export default defineBackground({
    permissions: ["tabs", "scripting"],
    main: async () => {
        onInstalled(async details => {
            if (details.reason === "install") {
                await activateContentScripts();
            }
        });
    },
});
