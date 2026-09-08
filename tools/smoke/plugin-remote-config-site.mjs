import {createServer} from "node:http";
import {pathToFileURL} from "node:url";

const modes = {
    remote: {label: "Full config", body: JSON.stringify({flag: true, label: "remote", nested: {a: 10, b: 20}})},
    partial: {label: "Partial config", body: JSON.stringify({label: "partial", nested: {a: 30}})},
    empty: {label: "Empty object", body: "{}"},
    failure: {label: "HTTP 503", body: "Temporarily unavailable", status: 503},
    invalid: {label: "Invalid JSON", body: "{"},
    array: {label: "Array response", body: "[]"},
    timeout: {label: "Slow response (2 s)", body: JSON.stringify({label: "slow"}), delay: 2000},
};

const smokeDocument = mode => `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Remote Config Consumer</title>
    <style>
        body { max-width: 800px; margin: 40px auto; padding: 0 20px; font: 16px/1.6 system-ui; }
        button { margin: 4px; padding: 8px 12px; cursor: pointer; }
        pre { padding: 16px; background: #f0f2f5; white-space: pre-wrap; overflow-wrap: anywhere; }
    </style>
</head>
<body>
    <h1>Remote Config Consumer</h1>
    <p>Install the test extension and reload this page. Its <strong>Read config</strong> button appears below.</p>
    <p>Endpoint: <a href="/config.json">/config.json</a>. Current response: <strong>${modes[mode].label}</strong>.</p>
    <form method="post">
        ${Object.entries(modes).map(([value, {label}]) =>
            `<button formaction="/mode/${value}">${label}</button>`).join("\n        ")}
    </form>
    <p>Choose Full config and read it, then switch to HTTP 503, Invalid JSON, Array response, or Slow response.
       The extension should keep the previous working config.</p>
    <p>Partial config merges deeply with defaults: nested.a becomes 30 and nested.b keeps its default value of 2.
       Empty object resets the result to defaults.</p>
    <p>The fixture uses a 1-minute TTL, a 1-second timeout, and a 100-ms retry delay. Read config returns the
       cached result during that minute. Once it expires, the next read requests the selected server response.
       The React label below is read when the page mounts.</p>
    <hr>
</body>
</html>`;

export const startSite = async (port = 8765) => {
    let mode = "remote";

    const server = createServer((request, response) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        response.setHeader("Cache-Control", "no-store");

        if (request.method === "POST" && pathname.startsWith("/mode/")) {
            const next = pathname.slice("/mode/".length);

            if (!Object.hasOwn(modes, next)) {
                response.writeHead(400).end("Unknown response mode");

                return;
            }

            mode = next;
            response.writeHead(303, {Location: "/"}).end();

            return;
        }

        if (request.method !== "GET") {
            response.writeHead(405).end("Method not allowed");
        } else if (pathname === "/config.json") {
            const current = modes[mode];

            const send = () => {
                response.writeHead(current.status ?? 200, {"Content-Type": "application/json"});
                response.end(current.body);
            };

            console.log(`GET /config.json: ${current.label}`);

            if (current.delay) {
                const timer = setTimeout(send, current.delay);
                response.once("close", () => clearTimeout(timer));
            } else {
                send();
            }
        } else if (pathname === "/" || pathname === "/index.html") {
            response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
            response.end(smokeDocument(mode));
        } else {
            response.writeHead(404).end("Not found");
        }
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
    });

    return {server, url: `http://127.0.0.1:${server.address().port}/`};
};

export const stopSite = server => {
    server.closeAllConnections();

    return new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const site = await startSite();
    console.log(`Remote config test page: ${site.url}`);
    console.log(`Mock endpoint: ${new URL("config.json", site.url).href}`);
    console.log("Load tests/fixtures/plugin-remote-config-consumer/dist/smoke-chrome-mv3 and reload the test page.");
    console.log("Switch responses on the page, then click the extension's Read config button.");
    console.log("Press Ctrl+C to stop the server.");

    const stop = () => {
        process.off("SIGINT", stop);
        process.off("SIGTERM", stop);

        void stopSite(site.server).catch(error => {
            console.error("Unable to stop remote config test server:", error);
            process.exitCode = 1;
        });
    };

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
}
