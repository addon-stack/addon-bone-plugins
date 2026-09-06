import {getManifest} from "@addon-core/browser";

import {globToRegex, testPatterns} from "webext-patterns";

type ManifestContentScript = NonNullable<chrome.runtime.Manifest["content_scripts"]>[number];

export type ContentScript = ManifestContentScript & {
    css_origin?: chrome.scripting.StyleOrigin;
    index: number;
    world?: chrome.scripting.ExecutionWorld;
};

export type ReadyTab = chrome.tabs.Tab & {id: number; url: string};

export const getContentScripts = (): ContentScript[] => {
    return (getManifest().content_scripts ?? []).map((contentScript, index) => ({...contentScript, index}));
};

export const isReadyTab = (tab: chrome.tabs.Tab): tab is ReadyTab => {
    return tab.id !== undefined && typeof tab.url === "string" && tab.status === "complete" && !tab.discarded;
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

export const matchesContentScript = (contentScript: ContentScript, url: string): boolean => {
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
