import {existsSync} from "node:fs";
import {createServer as createNetServer} from "node:net";

import RpcClient from "./RpcClient.mjs";

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

export {
    assert, chromeBinary, chromeTargets, chromeVersion, delay, evaluateChrome, firefoxBinary, firefoxEvaluate,
    flattenContexts, getFreePort, RpcClient, stopProcess, waitFor,
};
