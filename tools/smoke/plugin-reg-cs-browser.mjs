import {spawn, spawnSync} from "node:child_process";
import {existsSync, readFileSync, rmSync} from "node:fs";
import {mkdtemp} from "node:fs/promises";
import {createServer as createNetServer} from "node:net";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {startSite, stopSite} from "./plugin-reg-cs-site.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const consumerSmoke = path.join(repoRoot, "tools/smoke/plugin-reg-cs-consumer.mjs");

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const waitFor = async (callback, label, timeout = 20_000) => {
    const deadline = Date.now() + timeout;
    let lastError;

    while (Date.now() < deadline) {
        try {
            const value = await callback();

            if (value !== undefined) {
                return value;
            }
        } catch (error) {
            lastError = error;
        }

        await delay(100);
    }

    const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
    throw new Error(`Timed out waiting for ${label}${detail}`);
};

const getFreePort = () => {
    return new Promise((resolve, reject) => {
        const server = createNetServer();

        server.once("error", reject);

        server.listen(0, "127.0.0.1", () => {
            const address = server.address();

            if (!address || typeof address === "string") {
                server.close();
                reject(new Error("Unable to reserve a browser debugging port"));

                return;
            }

            server.close(error => (error ? reject(error) : resolve(address.port)));
        });
    });
};

const stopProcess = async process => {
    if (!process || process.exitCode !== null || process.killed) {
        return;
    }

    const waitForExit = timeout =>
        new Promise(resolve => {
            const timer = setTimeout(() => resolve(false), timeout);

            process.once("exit", () => {
                clearTimeout(timer);
                resolve(true);
            });
        });

    process.kill("SIGTERM");

    if (!(await waitForExit(5_000)) && process.exitCode === null) {
        process.kill("SIGKILL");
        await waitForExit(5_000);
    }
};

class RpcClient {
    nextId = 1;
    pending = new Map();
    errors = [];

    constructor(socket) {
        this.socket = socket;
        socket.addEventListener("message", event => this.receive(JSON.parse(String(event.data))));
        socket.addEventListener("close", () => this.rejectPending(new Error("Browser RPC connection closed")));
        socket.addEventListener("error", () => this.rejectPending(new Error("Browser RPC connection failed")));
    }

    static connect(url, timeout = 15_000) {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(url);

            const timer = setTimeout(() => {
                socket.close();
                reject(new Error(`Timed out connecting to ${url}`));
            }, timeout);

            socket.addEventListener(
                "open",
                () => {
                    clearTimeout(timer);
                    resolve(new RpcClient(socket));
                },
                {once: true}
            );

            socket.addEventListener(
                "error",
                () => {
                    clearTimeout(timer);
                    reject(new Error(`Unable to connect to ${url}`));
                },
                {once: true}
            );
        });
    }

    send(method, params = {}, sessionId, timeout = 15_000) {
        const id = this.nextId++;

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Browser RPC request timed out: ${method}`));
            }, timeout);

            this.pending.set(id, {reject, resolve, timer});
            this.socket.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
        });
    }

    async close() {
        if (this.socket.readyState === WebSocket.CLOSED) {
            return;
        }

        await new Promise(resolve => {
            const timer = setTimeout(resolve, 1_000);

            this.socket.addEventListener(
                "close",
                () => {
                    clearTimeout(timer);
                    resolve();
                },
                {once: true}
            );

            this.socket.close();
        });
    }

    receive(message) {
        if (message.method === "Runtime.exceptionThrown") {
            this.errors.push(message.params?.exceptionDetails?.exception?.description ?? "Chrome runtime exception");
        }

        if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
            this.errors.push(
                (message.params.args ?? []).map(arg => String(arg.value ?? arg.description ?? "")).join(" ")
            );
        }

        if (message.method === "log.entryAdded" && message.params?.level === "error") {
            this.errors.push(message.params.text ?? "Firefox runtime error");
        }

        if (message.id === undefined) {
            return;
        }

        const pending = this.pending.get(message.id);

        if (!pending) {
            return;
        }

        this.pending.delete(message.id);
        clearTimeout(pending.timer);

        if (message.type === "error" || message.error) {
            pending.reject(new Error(message.message ?? message.error?.message ?? String(message.error)));
        } else {
            pending.resolve(message.result ?? {});
        }
    }

    rejectPending(error) {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }

        this.pending.clear();
    }
}

const findBinary = (environmentName, candidates) => {
    if (process.env[environmentName]) {
        return process.env[environmentName];
    }

    return candidates.find(candidate => existsSync(candidate));
};

const chromeBinary = findBinary("ADNBN_CHROME_BIN", [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
]);

const firefoxBinary = findBinary("ADNBN_FIREFOX_BIN", [
    "/Applications/Firefox.app/Contents/MacOS/firefox",
    "/usr/bin/firefox",
]);

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

const chromeVersion = async port => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {signal: AbortSignal.timeout(5_000)});

    return response.json();
};

const chromeTargets = async port => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {signal: AbortSignal.timeout(5_000)});

    return response.json();
};

const evaluateChrome = async (browser, sessionId, expression) => {
    const result = await browser.send(
        "Runtime.evaluate",
        {awaitPromise: true, expression, returnByValue: true},
        sessionId
    );

    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }

    return result.result?.value;
};

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

        const states = await waitFor(async () => {
            const value = await evaluateChrome(
                browser,
                sessionId,
                `(() => {
                    const child = document.querySelector('iframe')?.contentDocument;
                    if (!child) return undefined;
                    const states = {top: ${stateExpression}(document), child: ${stateExpression}(child)};
                    return states.top.runs && states.child.runs ? states : undefined;
                })()`
            );

            return value;
        }, "Chrome plugin activation in top and child documents");

        assertDocumentStates(states, "Chrome MV3");

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

const firefoxEvaluate = async (browser, context, expression) => {
    const response = await browser.send("script.evaluate", {
        awaitPromise: true,
        expression,
        target: {context},
    });

    if (response.type === "exception") {
        throw new Error(response.exceptionDetails?.text ?? "Firefox evaluation failed");
    }

    return response.result?.value;
};

const flattenContexts = contexts => {
    return contexts.flatMap(context => [context, ...flattenContexts(context.children ?? [])]);
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
        "Verified Chrome MV3 background-tab injection and Firefox MV2 native activation " +
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
