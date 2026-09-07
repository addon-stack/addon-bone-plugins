import {spawn, spawnSync} from "node:child_process";
import {readFileSync, rmSync} from "node:fs";
import {mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
    assert, chromeBinary, chromeTargets, chromeVersion, evaluateChrome, firefoxBinary, firefoxEvaluate,
    flattenContexts, getFreePort, RpcClient, stopProcess, waitFor,
} from "./browser.mjs";
import {startSite, stopSite} from "./plugin-reg-cs-site.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const consumerSmoke = path.join(repoRoot, "tools/smoke/plugin-reg-cs-consumer.mjs");

const buildPackedConsumer = () => {
    const result = spawnSync(process.execPath, [consumerSmoke], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {...process.env, CI: "true", KEEP_SMOKE_TEMP: "1"},
        stdio: "pipe",
    });

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    if (result.status !== 0) {
        throw new Error(`Unable to prepare packed browser smoke consumer:\n${output}`);
    }

    const temporaryRoot = /Consumer smoke workspace kept at (.+)/.exec(output)?.[1]?.trim();

    if (!temporaryRoot) {
        throw new Error(`Consumer smoke did not report its temporary workspace:\n${output}`);
    }

    return temporaryRoot;
};

const stateExpression = `
    (doc => ({
        css: doc.documentElement.dataset.adnbnPluginRegCsCss,
        frame: doc.documentElement.dataset.adnbnPluginRegCsFrame,
        runs: doc.documentElement.dataset.adnbnPluginRegCsRuns,
    }))
`;

const assertDocumentStates = (states, browserName) => {
    assert(states.top?.css === "ready", `${browserName} top document did not observe CSS before JavaScript`);
    assert(states.child?.css === "ready", `${browserName} child document did not observe CSS before JavaScript`);
    assert(states.top?.frame === "top", `${browserName} top document has the wrong frame marker`);
    assert(states.child?.frame === "child", `${browserName} child document has the wrong frame marker`);
    assert(states.top?.runs === "1", `${browserName} top document ran ${states.top?.runs ?? "zero"} times`);
    assert(states.child?.runs === "1", `${browserName} child document ran ${states.child?.runs ?? "zero"} times`);
};

const readChromeDocumentStates = async (browser, sessionId) => {
    return evaluateChrome(
        browser,
        sessionId,
        `(() => {
            const child = document.querySelector('iframe')?.contentDocument;
            if (!child) return undefined;
            const states = {top: ${stateExpression}(document), child: ${stateExpression}(child)};
            return states.top.runs && states.child.runs ? states : undefined;
        })()`
    );
};

const pendingTabsExpression = `
    new Promise(resolve => chrome.storage.session.get(
        "@adnbn/plugin-reg-cs:tabs",
        values => resolve(values["@adnbn/plugin-reg-cs:tabs"]),
    ))
`;

const runChromeSmoke = async (extensionDir, siteUrl) => {
    assert(chromeBinary, "Chrome is not installed; set ADNBN_CHROME_BIN to run the MV3 runtime smoke");

    const profile = await mkdtemp(path.join(tmpdir(), "plugin-reg-cs-chrome-"));
    const port = await getFreePort();
    let process;
    let browser;
    let output = "";

    try {
        process = spawn(
            chromeBinary,
            [
                "--headless=new",
                "--no-sandbox",
                "--no-first-run",
                "--no-default-browser-check",
                "--enable-unsafe-extension-debugging",
                `--remote-debugging-port=${port}`,
                `--user-data-dir=${profile}`,
                siteUrl,
            ],
            {stdio: ["ignore", "ignore", "pipe"]}
        );

        process.stderr?.on("data", chunk => (output += chunk));

        const version = await waitFor(() => chromeVersion(port), "Chrome DevTools endpoint");
        browser = await RpcClient.connect(version.webSocketDebuggerUrl);

        const target = await waitFor(async () => {
            return (await chromeTargets(port)).find(
                candidate => candidate.type === "page" && candidate.url === siteUrl
            );
        }, "Chrome smoke page");

        const attached = await browser.send("Target.attachToTarget", {flatten: true, targetId: target.id});
        const sessionId = attached.sessionId;

        await browser.send("Runtime.enable", {}, sessionId);
        await browser.send("Page.enable", {}, sessionId);

        await waitFor(async () => {
            return (await evaluateChrome(
                browser,
                sessionId,
                [
                    "document.readyState === 'complete'",
                    "document.querySelector('iframe')?.contentDocument?.readyState === 'complete'",
                ].join(" && ")
            ))
                ? true
                : undefined;
        }, "Chrome page and iframe load");

        const beforeInstall = await evaluateChrome(
            browser,
            sessionId,
            "document.documentElement.dataset.adnbnPluginRegCsRuns"
        );

        assert(beforeInstall === undefined, "Chrome smoke page was modified before the extension was installed");

        const frozenUrl = `${siteUrl}?frozen=1`;
        const frozenTarget = await browser.send("Target.createTarget", {background: true, url: frozenUrl});

        const frozenAttached = await browser.send("Target.attachToTarget", {
            flatten: true,
            targetId: frozenTarget.targetId,
        });

        const frozenSessionId = frozenAttached.sessionId;

        await browser.send("Runtime.enable", {}, frozenSessionId);
        await browser.send("Page.enable", {}, frozenSessionId);

        await waitFor(async () => {
            return (await evaluateChrome(
                browser,
                frozenSessionId,
                [
                    "document.readyState === 'complete'",
                    "document.querySelector('iframe')?.contentDocument?.readyState === 'complete'",
                ].join(" && ")
            ))
                ? true
                : undefined;
        }, "Chrome frozen page and iframe load");

        await browser.send("Page.setWebLifecycleState", {state: "frozen"}, frozenSessionId);

        // Reproduce manual installation from another tab in the same window.
        const extensionsPage = await browser.send("Target.createTarget", {url: "chrome://extensions/"});
        await browser.send("Target.activateTarget", {targetId: extensionsPage.targetId});

        await waitFor(async () => {
            return (await evaluateChrome(browser, sessionId, "document.visibilityState")) === "hidden"
                ? true
                : undefined;
        }, "Chrome smoke page to become a background tab");

        const installed = await browser.send("Extensions.loadUnpacked", {path: extensionDir});
        assert(typeof installed.id === "string", "Chrome did not return an extension id");

        const states = await waitFor(
            () => readChromeDocumentStates(browser, sessionId),
            "Chrome plugin activation in top and child documents"
        );

        assertDocumentStates(states, "Chrome MV3");

        const workerTarget = await waitFor(async () => {
            return (await chromeTargets(port)).find(
                candidate =>
                    candidate.type === "service_worker" &&
                    candidate.url.startsWith(`chrome-extension://${installed.id}/`)
            );
        }, "Chrome extension service worker");

        const workerAttached = await browser.send("Target.attachToTarget", {
            flatten: true,
            targetId: workerTarget.id,
        });

        await browser.send("Runtime.enable", {}, workerAttached.sessionId);

        const pendingTabs = await waitFor(async () => {
            const value = await evaluateChrome(browser, workerAttached.sessionId, pendingTabsExpression);

            return Object.keys(value ?? {}).length > 0 ? value : undefined;
        }, "Chrome frozen tab to enter session storage");

        const pendingEntries = Object.values(pendingTabs);

        assert(pendingEntries.length === 1, `Chrome stored ${pendingEntries.length} pending tabs instead of one`);
        assert(pendingEntries[0].url === frozenUrl, "Chrome stored the wrong frozen-tab URL");

        assert(
            JSON.stringify(pendingEntries[0].scripts) === "[0]",
            `Chrome stored the wrong content-script indexes: ${JSON.stringify(pendingEntries[0].scripts)}`
        );

        await browser.send("ServiceWorker.enable", {}, sessionId);
        await browser.send("ServiceWorker.stopAllWorkers", {}, sessionId);

        await waitFor(async () => {
            const hasWorker = (await chromeTargets(port)).some(
                candidate =>
                    candidate.type === "service_worker" &&
                    candidate.url.startsWith(`chrome-extension://${installed.id}/`)
            );

            return hasWorker ? undefined : true;
        }, "Chrome extension service worker to stop");

        await browser.send("Target.activateTarget", {targetId: frozenTarget.targetId});

        const restartedWorkerTarget = await waitFor(async () => {
            return (await chromeTargets(port)).find(
                candidate =>
                    candidate.type === "service_worker" &&
                    candidate.url.startsWith(`chrome-extension://${installed.id}/`)
            );
        }, "Chrome extension service worker to restart");

        const restartedWorkerAttached = await browser.send("Target.attachToTarget", {
            flatten: true,
            targetId: restartedWorkerTarget.id,
        });

        await browser.send("Runtime.enable", {}, restartedWorkerAttached.sessionId);

        const resumedStates = await waitFor(
            () => readChromeDocumentStates(browser, frozenSessionId),
            "Chrome deferred injection after tab activation"
        );

        assertDocumentStates(resumedStates, "Chrome MV3 resumed frozen tab");

        await waitFor(async () => {
            const value = await evaluateChrome(browser, restartedWorkerAttached.sessionId, pendingTabsExpression);

            return value === undefined ? true : undefined;
        }, "Chrome frozen-tab queue to clear");

        assert(
            (await evaluateChrome(browser, sessionId, "document.visibilityState")) === "hidden",
            "Chrome plugin activation must not select the background tab"
        );

        assert(browser.errors.length === 0, `Chrome runtime errors: ${JSON.stringify(browser.errors)}`);
    } catch (error) {
        throw new Error(`${error instanceof Error ? error.message : String(error)}\nChrome output:\n${output}`, {
            cause: error,
        });
    } finally {
        if (browser) {
            try {
                await browser.send("Browser.close", {}, undefined, 2_000);
            } catch {
                // The browser may close the socket before acknowledging Browser.close.
            }

            await browser.close();
        }

        await stopProcess(process);
        rmSync(profile, {force: true, recursive: true});
    }
};

const runFirefoxSmoke = async (extensionDir, siteUrl) => {
    assert(firefoxBinary, "Firefox is not installed; set ADNBN_FIREFOX_BIN to run the MV2 runtime smoke");

    const profile = await mkdtemp(path.join(tmpdir(), "plugin-reg-cs-firefox-"));
    const port = await getFreePort();
    let process;
    let browser;
    let output = "";

    try {
        process = spawn(
            firefoxBinary,
            ["--headless", "--no-remote", "--profile", profile, "--remote-debugging-port", String(port), siteUrl],
            {stdio: ["ignore", "ignore", "pipe"]}
        );

        process.stderr?.on("data", chunk => (output += chunk));

        browser = await waitFor(
            () => RpcClient.connect(`ws://127.0.0.1:${port}/session`, 1_000),
            "Firefox WebDriver BiDi endpoint"
        );

        await browser.send("session.new", {capabilities: {alwaysMatch: {acceptInsecureCerts: true}}});
        await browser.send("session.subscribe", {events: ["log.entryAdded"]});

        const loadedContexts = await waitFor(async () => {
            const tree = await browser.send("browsingContext.getTree", {maxDepth: 2});
            const contexts = flattenContexts(tree.contexts ?? []);
            const top = contexts.find(context => context.url === siteUrl);
            const child = contexts.find(context => context.url.endsWith("/child.html"));

            if (!top || !child) {
                return undefined;
            }

            const ready = await Promise.all(
                [top, child].map(context => firefoxEvaluate(browser, context.context, "document.readyState"))
            );

            return ready.every(state => state === "complete") ? {child, top} : undefined;
        }, "Firefox page and iframe load");

        const beforeInstall = await firefoxEvaluate(
            browser,
            loadedContexts.top.context,
            "document.documentElement.dataset.adnbnPluginRegCsRuns"
        );

        assert(beforeInstall === undefined, "Firefox smoke page was modified before the extension was installed");

        const installed = await browser.send("webExtension.install", {
            extensionData: {path: extensionDir, type: "path"},
        });

        assert(typeof installed.extension === "string", "Firefox did not return an extension id");

        const states = await waitFor(async () => {
            const [topValue, childValue] = await Promise.all(
                [loadedContexts.top, loadedContexts.child].map(context =>
                    firefoxEvaluate(browser, context.context, `JSON.stringify(${stateExpression}(document))`)
                )
            );

            if (!topValue || !childValue) {
                return undefined;
            }

            const state = {child: JSON.parse(childValue), top: JSON.parse(topValue)};

            return state.top.runs && state.child.runs ? state : undefined;
        }, "Firefox plugin activation in top and child documents");

        assertDocumentStates(states, "Firefox MV2");
        assert(browser.errors.length === 0, `Firefox runtime errors: ${JSON.stringify(browser.errors)}`);
    } catch (error) {
        throw new Error(`${error instanceof Error ? error.message : String(error)}\nFirefox output:\n${output}`, {
            cause: error,
        });
    } finally {
        if (browser) {
            try {
                await browser.send("session.end", {}, undefined, 2_000);
            } catch {
                // Firefox may close the socket while ending the session.
            }

            await browser.close();
        }

        await stopProcess(process);
        rmSync(profile, {force: true, recursive: true});
    }
};

let temporaryRoot;
let site;

try {
    temporaryRoot = buildPackedConsumer();
    site = await startSite();

    const consumerDir = path.join(temporaryRoot, "consumer");
    const chromeExtension = path.join(consumerDir, "dist/smoke-chrome-mv3");
    const firefoxExtension = path.join(consumerDir, "dist/smoke-firefox-mv2");
    const chromeManifest = JSON.parse(readFileSync(path.join(chromeExtension, "manifest.json"), "utf8"));
    const firefoxManifest = JSON.parse(readFileSync(path.join(firefoxExtension, "manifest.json"), "utf8"));

    assert(chromeManifest.manifest_version === 3, "Chrome browser smoke did not receive an MV3 build");
    assert(firefoxManifest.manifest_version === 2, "Firefox browser smoke did not receive an MV2 build");

    await runChromeSmoke(chromeExtension, site.url);
    await runFirefoxSmoke(firefoxExtension, site.url);

    console.log(
        "Verified Chrome MV3 background and frozen-tab injection plus Firefox MV2 native activation " +
            "without duplicate top/child execution."
    );
} finally {
    if (site) {
        await stopSite(site.server);
    }

    if (temporaryRoot) {
        rmSync(temporaryRoot, {force: true, recursive: true});
    }
}
