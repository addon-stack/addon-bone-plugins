import {containsPermissions, getTab} from "@addon-core/browser";
import {type StorageProvider, storageSession} from "@addon-core/storage";

import {getContentScripts, isReadyTab, matchesContentScript, type ReadyTab} from "./content";
import {injectContentScript} from "./inject";

interface PendingTab {
    scripts: number[];
    url: string;
}

interface PendingState {
    tabs: Record<string, PendingTab>;
}

interface ClaimedTab {
    pending: PendingTab | undefined;
    remaining: number;
}

const key = (tabId: number): string => String(tabId);

const size = (tabs: Record<string, PendingTab> | undefined): number => Object.keys(tabs ?? {}).length;

export class PendingTabs {
    private readonly inFlight = new Map<number, Promise<number>>();
    private readonly storage: StorageProvider<PendingState>;

    public constructor() {
        this.storage = storageSession<PendingState>({namespace: "@adnbn/plugin-reg-cs"});
    }

    public async add(tab: ReadyTab, declarationIndex: number): Promise<number> {
        let remaining = 0;

        await this.storage.update("tabs", tabs => {
            const current = tabs ?? {};
            const tabKey = key(tab.id);
            const previous = current[tabKey];
            const scripts = previous?.url === tab.url ? previous.scripts : [];

            const next = {
                ...current,
                [tabKey]: {
                    scripts: [...new Set([...scripts, declarationIndex])].sort((a, b) => a - b),
                    url: tab.url,
                },
            };

            remaining = size(next);

            return next;
        });

        return remaining;
    }

    public async has(): Promise<boolean> {
        return size(await this.storage.get("tabs")) > 0;
    }

    public resume(tabId: number): Promise<number> {
        const running = this.inFlight.get(tabId);

        if (running) {
            return running;
        }

        const task = this.resumeTab(tabId).finally(() => {
            if (this.inFlight.get(tabId) === task) {
                this.inFlight.delete(tabId);
            }
        });

        this.inFlight.set(tabId, task);

        return task;
    }

    public async remove(tabId: number): Promise<number> {
        let remaining = 0;

        await this.storage.update("tabs", tabs => {
            if (!tabs?.[key(tabId)]) {
                remaining = size(tabs);

                return tabs;
            }

            const next = {...tabs};
            delete next[key(tabId)];
            remaining = size(next);

            return remaining > 0 ? next : undefined;
        });

        return remaining;
    }

    public async restore(): Promise<number> {
        const tabs = await this.read();
        const results = await Promise.allSettled(Object.keys(tabs).map(tabId => this.resume(Number(tabId))));

        for (const result of results) {
            if (result.status === "rejected") {
                console.error("[@adnbn/plugin-reg-cs] storage failed", {error: result.reason});
            }
        }

        return size(await this.storage.get("tabs"));
    }

    private async claim(tabId: number): Promise<ClaimedTab> {
        let pending: PendingTab | undefined;
        let remaining = 0;

        await this.storage.update("tabs", tabs => {
            pending = tabs?.[key(tabId)];

            if (!pending) {
                remaining = size(tabs);

                return tabs;
            }

            const next = {...tabs};
            delete next[key(tabId)];
            remaining = size(next);

            return remaining > 0 ? next : undefined;
        });

        return {pending, remaining};
    }

    private async read(): Promise<Record<string, PendingTab>> {
        return (await this.storage.get("tabs")) ?? {};
    }

    private async resumeTab(tabId: number): Promise<number> {
        const pendingTabs = await this.read();
        const pending = pendingTabs[key(tabId)];

        if (!pending) {
            return size(pendingTabs);
        }

        let tab: chrome.tabs.Tab;

        try {
            tab = await getTab(tabId);
        } catch {
            return this.remove(tabId);
        }

        if (!isReadyTab(tab) || tab.url !== pending.url) {
            return this.remove(tabId);
        }

        if (tab.frozen) {
            return size(pendingTabs);
        }

        const claimed = await this.claim(tabId);

        if (!claimed.pending) {
            return claimed.remaining;
        }

        const contentScripts = getContentScripts();

        for (const declarationIndex of claimed.pending.scripts) {
            const contentScript = contentScripts[declarationIndex];

            if (!contentScript?.matches?.length || !matchesContentScript(contentScript, tab.url)) {
                continue;
            }

            try {
                if (!(await containsPermissions({origins: [...contentScript.matches]}))) {
                    continue;
                }
            } catch (error) {
                console.error("[@adnbn/plugin-reg-cs] permission failed", {declarationIndex, error});

                continue;
            }

            await injectContentScript(contentScript, tab);
        }

        return claimed.remaining;
    }
}
