import {containsPermissions, queryTabs} from "@addon-core/browser";

import {type ContentScript, getContentScripts, isReadyTab, matchesContentScript} from "./content";
import {injectContentScript} from "./inject";
import type {PendingTabs} from "./PendingTabs";

const installContentScript = async (
    contentScript: ContentScript,
    pending: PendingTabs | undefined,
    deferredTabs: Set<number>
): Promise<void> => {
    if (!contentScript.matches?.length) {
        return;
    }

    try {
        if (!(await containsPermissions({origins: [...contentScript.matches]}))) {
            return;
        }
    } catch (error) {
        console.error("[@adnbn/plugin-reg-cs] permission failed", {
            declarationIndex: contentScript.index,
            error,
        });

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
        console.error("[@adnbn/plugin-reg-cs] query failed", {
            declarationIndex: contentScript.index,
            error,
        });

        return;
    }

    const matchingTabs = tabs.filter(isReadyTab).filter(tab => matchesContentScript(contentScript, tab.url));

    await Promise.allSettled(
        matchingTabs.map(async tab => {
            if (tab.frozen || deferredTabs.has(tab.id)) {
                if (!pending) {
                    return;
                }

                deferredTabs.add(tab.id);

                try {
                    await pending.add(tab, contentScript.index);
                } catch (error) {
                    console.error("[@adnbn/plugin-reg-cs] storage failed", {
                        declarationIndex: contentScript.index,
                        error,
                        tabId: tab.id,
                        title: tab.title,
                    });
                }

                return;
            }

            await injectContentScript(contentScript, tab);
        })
    );
};

export const installContentScripts = async (pending?: PendingTabs): Promise<void> => {
    const deferredTabs = new Set<number>();

    for (const contentScript of getContentScripts()) {
        await installContentScript(contentScript, pending, deferredTabs);
    }
};
