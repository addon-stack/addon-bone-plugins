import {spawn, spawnSync} from "node:child_process";
import {rmSync} from "node:fs";
import {mkdtemp} from "node:fs/promises";
import {createServer} from "node:http";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
    assert, chromeBinary, chromeTargets, chromeVersion, delay, evaluateChrome, firefoxBinary, firefoxEvaluate,
    getFreePort, RpcClient, stopProcess, waitFor,
} from "./browser.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const expectedRemote = {flag: true, label: "remote", nested: {a: 10, b: 20}};
const expectedPartial = {flag: false, label: "partial", nested: {a: 30}};
let mode = "remote";

const server = createServer((request, response) => {
    if (request.url === "/config.json") {
        if (mode === "failure") {
            response.writeHead(503).end("Temporarily unavailable");
        } else {
            const config = mode === "array" ? [] : mode === "partial" ? {label: "partial", nested: {a: 30}}
                : expectedRemote;

            response.writeHead(200, {"Content-Type": "application/json", "Cache-Control": "no-store"});
            response.end(JSON.stringify(config));
        }
    } else {
        response.writeHead(200, {"Content-Type": "text/html"});
        response.end("<!doctype html><title>Remote config smoke</title><body>Remote config test</body>");
    }
});

const build = url => {
    const result = spawnSync(process.execPath, ["tools/smoke/plugin-remote-config-consumer.mjs"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
            ...process.env,
            CI: "true",
            KEEP_SMOKE_TEMP: "1",
            REMOTE_CONFIG_SMOKE_URL: url,
            REMOTE_CONFIG_SMOKE_TTL: "0",
        },
    });

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    const directory = /Consumer smoke workspace kept at (.+)/.exec(output)?.[1]?.trim();
    assert(result.status === 0, `Unable to build packed remote-config consumer:\n${output}`);
    assert(directory, "Consumer did not report its temporary directory");

    return directory;
};

const readConfig = async evaluate => {
    await evaluate(`document.getElementById('read-remote-config').click(); true`);

    return waitFor(async () => {
        const text = await evaluate(`document.getElementById('remote-config-output')?.textContent`);

        return text && text !== "pending" ? JSON.parse(text) : undefined;
    }, "remote config response");
};

const equal = (actual, expected, label) => {
    assert(JSON.stringify(actual) === JSON.stringify(expected), `${label}: ${JSON.stringify(actual)}`);
};

const scenarios = async (evaluate, restart, inspect) => {
    await waitFor(async () => {
        const ready = await evaluate(`document.getElementById('remote-config-hook')?.textContent === 'remote'`);

        return ready ? true : undefined;
    }, "React hook to receive the remote configuration");

    equal(await readConfig(evaluate), expectedRemote, "Initial configuration");
    await inspect?.();
    mode = "failure";
    equal(await readConfig(evaluate), expectedRemote, "Configuration during a failed refresh");

    if (restart) {
        await restart();
        equal(await readConfig(evaluate), expectedRemote, "Configuration after service-worker restart");
    }

    mode = "partial";
    await delay(150);
    equal(await readConfig(evaluate), expectedPartial, "Partial response merged only with defaults");
    mode = "array";
    equal(await readConfig(evaluate), expectedPartial, "Malformed config keeps the last working response");
};

const runChrome = async (extensionDir, siteUrl) => {
    assert(chromeBinary, "Chrome is required for the remote-config runtime smoke");
    const profile = await mkdtemp(path.join(tmpdir(), "remote-config-chrome-"));
    const port = await getFreePort();
    let child;
    let rpc;

    try {
        mode = "remote";

        child = spawn(chromeBinary, [
            "--headless=new", "--no-sandbox", "--no-first-run", "--no-default-browser-check",
            "--enable-unsafe-extension-debugging", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
            "about:blank",
        ], {stdio: "ignore"});

        const version = await waitFor(() => chromeVersion(port), "Chrome endpoint");
        rpc = await RpcClient.connect(version.webSocketDebuggerUrl);
        const installed = await rpc.send("Extensions.loadUnpacked", {path: extensionDir});
        const target = await rpc.send("Target.createTarget", {url: siteUrl});
        const attached = await rpc.send("Target.attachToTarget", {targetId: target.targetId, flatten: true});
        const session = attached.sessionId;
        const evaluate = expression => evaluateChrome(rpc, session, expression);

        const worker = () => waitFor(async () => {
            return (await chromeTargets(port)).find(value => value.type === "service_worker" &&
                value.url.startsWith(`chrome-extension://${installed.id}/`));
        }, "remote config service worker");

        const inspect = async () => {
            const current = await worker();
            const attachedWorker = await rpc.send("Target.attachToTarget", {targetId: current.id, flatten: true});
            const direct = await evaluateChrome(rpc, attachedWorker.sessionId, "remoteConfigSmokeRead()");
            equal(direct, expectedRemote, "Direct background service call");
            const values = await evaluateChrome(rpc, attachedWorker.sessionId, "chrome.storage.local.get(null)");
            equal(Object.keys(values), ["@adnbn/plugin-remote-config:cache"], "Only one namespaced local record");
            equal(values["@adnbn/plugin-remote-config:cache"].config, expectedRemote, "Plain local cache");
            await rpc.send("Target.detachFromTarget", {sessionId: attachedWorker.sessionId});
        };

        const restart = async () => {
            await rpc.send("ServiceWorker.enable", {}, session);
            await rpc.send("ServiceWorker.stopAllWorkers", {}, session);

            await waitFor(async () => {
                const present = (await chromeTargets(port)).some(value => value.type === "service_worker" &&
                    value.url.startsWith(`chrome-extension://${installed.id}/`));

                return present ? undefined : true;
            }, "service worker termination");
        };

        await scenarios(evaluate, restart, inspect);
        console.log("Chrome MV3: API, React hook, local cache, failed refresh, restart and recovery passed.");
    } finally {
        await rpc?.close();
        await stopProcess(child);
        rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
};

const runFirefox = async (extensionDir, siteUrl) => {
    assert(firefoxBinary, "Firefox is required for the remote-config runtime smoke");
    const profile = await mkdtemp(path.join(tmpdir(), "remote-config-firefox-"));
    const port = await getFreePort();
    let child;
    let rpc;

    try {
        mode = "remote";

        child = spawn(firefoxBinary, [
            "--headless", "--no-remote", "--profile", profile, "--remote-debugging-port", String(port), "about:blank",
        ], {stdio: "ignore"});

        rpc = await waitFor(() => RpcClient.connect(`ws://127.0.0.1:${port}/session`, 1000), "Firefox endpoint");
        await rpc.send("session.new", {capabilities: {alwaysMatch: {acceptInsecureCerts: true}}});
        await rpc.send("webExtension.install", {extensionData: {path: extensionDir, type: "path"}});
        const {context} = await rpc.send("browsingContext.create", {type: "tab"});
        await rpc.send("browsingContext.navigate", {context, url: siteUrl, wait: "complete"});
        const evaluate = expression => firefoxEvaluate(rpc, context, expression);
        await scenarios(evaluate);
        console.log("Firefox MV2: proxy API, React hook, failed refresh, partial response and recovery passed.");
    } finally {
        if (rpc) {
            try {
                await rpc.send("session.end", {}, undefined, 2000);
            } catch {
                // Ending the session may close its connection first.
            }

            await rpc.close();
        }

        await stopProcess(child);
        rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
};

let directory;

try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const siteUrl = `http://127.0.0.1:${server.address().port}/index.html`;
    console.log("Building the packed remote-config consumer for browser validation...");
    directory = build(new URL("config.json", siteUrl).href);
    await runChrome(path.join(directory, "consumer/dist/smoke-chrome-mv3"), siteUrl);
    await runFirefox(path.join(directory, "consumer/dist/smoke-firefox-mv2"), siteUrl);
} finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));

    if (directory) {
        rmSync(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
}
