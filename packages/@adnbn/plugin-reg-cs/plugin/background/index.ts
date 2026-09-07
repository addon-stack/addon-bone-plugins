import {Browser, defineBackground} from "adnbn";

import {isManifestVersion3, onInstalled, onTabRemoved, onTabReplaced, onTabUpdated} from "@addon-core/browser";

import {installContentScripts} from "./install";
import {PendingTabs} from "./PendingTabs";

export default defineBackground({
    excludeBrowser: [Browser.Firefox],
    main: () => {
        const installSafely = async (pending?: PendingTabs): Promise<void> => {
            try {
                await installContentScripts(pending);

                if (pending) {
                    await pending.restore();
                }
            } catch (error) {
                console.error("[@adnbn/plugin-reg-cs] install failed", {error});
            }
        };

        if (!isManifestVersion3()) {
            onInstalled(async details => {
                if (details.reason === "install") {
                    await installSafely();
                }
            });

            return;
        }

        const pending = new PendingTabs();
        let installing = false;
        let installation = Promise.resolve();
        let stopWatching: VoidFunction | undefined;

        const stopWatchingIfIdle = async (remaining?: number): Promise<void> => {
            if (installing) {
                return;
            }

            let hasPending: boolean;

            try {
                hasPending = remaining === undefined ? await pending.has() : remaining > 0;
            } catch (error) {
                console.error("[@adnbn/plugin-reg-cs] storage failed", {error});

                return;
            }

            // `installing` may change while the storage read above is pending.
            if (!installing && !hasPending) {
                stopWatching?.();
            }
        };

        const updatePending = async (operation: () => Promise<number | undefined>): Promise<void> => {
            try {
                const remaining = await operation();

                if (remaining !== undefined) {
                    await stopWatchingIfIdle(remaining);
                }
            } catch (error) {
                console.error("[@adnbn/plugin-reg-cs] storage failed", {error});
            }
        };

        const startWatching = (): void => {
            if (stopWatching) {
                return;
            }

            const unsubscribe = [
                onTabUpdated((tabId, changeInfo) =>
                    updatePending(async () => {
                        const changedDocument =
                            changeInfo.discarded === true ||
                            changeInfo.status === "loading" ||
                            changeInfo.url !== undefined;

                        if (changedDocument) {
                            return pending.remove(tabId);
                        }

                        if (changeInfo.frozen === false) {
                            await installation;

                            return pending.resume(tabId);
                        }

                        return undefined;
                    })
                ),
                onTabRemoved(tabId =>
                    updatePending(async () => {
                        await installation;

                        return pending.remove(tabId);
                    })
                ),
                onTabReplaced((_addedTabId, removedTabId) =>
                    updatePending(async () => {
                        await installation;

                        return pending.remove(removedTabId);
                    })
                ),
            ];

            stopWatching = () => {
                unsubscribe.forEach(stop => stop());
                stopWatching = undefined;
            };
        };

        onInstalled(async details => {
            if (details.reason !== "install") {
                return;
            }

            startWatching();
            installing = true;

            installation = installSafely(pending);

            try {
                await installation;
            } finally {
                installing = false;
                await stopWatchingIfIdle();
            }
        });

        // Register synchronously so Chrome can wake the service worker for a pending tab. Fresh-install cleanup relies
        // on Chrome delivering `onInstalled` before this asynchronous session read completes; the second `installing`
        // check above closes the race during that read. The real-browser smoke verifies the frozen-tab flow across a
        // service-worker restart.
        startWatching();

        void pending
            .restore()
            .then(remaining => stopWatchingIfIdle(remaining))
            .catch(error => console.error("[@adnbn/plugin-reg-cs] storage failed", {error}));
    },
});
