import {isManifestVersion3} from "@addon-core/browser";
import injectCss, {type InjectCssTarget, type NonEmptyReadonlyArray} from "@addon-core/inject-css";
import injectScript from "@addon-core/inject-script";

import type {ContentScript, ReadyTab} from "./content";

const isNonEmpty = <Value>(values: readonly Value[] | undefined): values is NonEmptyReadonlyArray<Value> => {
    return values !== undefined && values.length > 0;
};

const describeError = (error: unknown): string => {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}`;
    }

    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
};

const logFailure = (
    phase: "css" | "js",
    contentScript: ContentScript,
    tab: ReadyTab,
    error: unknown
): void => {
    const context = [
        `declarationIndex=${contentScript.index}`,
        `tabId=${tab.id}`,
        `title=${JSON.stringify(tab.title ?? "")}`,
    ].join("; ");

    console.error(`[@adnbn/plugin-reg-cs] ${phase} failed: ${describeError(error)}; ${context}`, error);
};

export const injectContentScript = async (contentScript: ContentScript, tab: ReadyTab): Promise<void> => {
    const manifestVersion3 = isManifestVersion3();
    const target: InjectCssTarget = contentScript.all_frames ? {allFrames: true, tabId: tab.id} : {tabId: tab.id};
    const matchAboutBlank = !manifestVersion3 && contentScript.match_about_blank ? true : undefined;

    if (isNonEmpty(contentScript.css)) {
        try {
            await injectCss({
                target,
                ...(contentScript.css_origin ? {origin: contentScript.css_origin} : {}),
                ...(matchAboutBlank ? {matchAboutBlank} : {}),
            }).file(contentScript.css);
        } catch (error) {
            logFailure("css", contentScript, tab, error);
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
            logFailure("js", contentScript, tab, error);
        }
    }
};
