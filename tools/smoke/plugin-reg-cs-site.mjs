import {createServer} from "node:http";
import {pathToFileURL} from "node:url";

export const startSite = async () => {
    const server = createServer((request, response) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

        response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});

        if (pathname === "/child.html") {
            response.end("<!doctype html><html><head><title>Child</title></head><body>child</body></html>");
        } else {
            response.end(
                "<!doctype html><html><head><title>Top</title></head><body>top" +
                    '<iframe src="/child.html"></iframe></body></html>'
            );
        }
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
        throw new Error("Unable to determine browser smoke site port");
    }

    return {server, url: `http://127.0.0.1:${address.port}/top.html`};
};

export const stopSite = server =>
    new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const site = await startSite();

    console.log(`Consumer test page: ${site.url}`);
    console.log("Open this page before installing the extension; it can stay in a background tab in the same window.");
    console.log("Discarded and frozen tabs are skipped. Reinstall the extension for each install-time test.");
    console.log("The page contains a child frame. This command does not build or install the extension.");
    console.log("Press Ctrl+C to stop the server.");

    const stop = () => {
        process.off("SIGINT", stop);
        process.off("SIGTERM", stop);

        void stopSite(site.server).catch(error => {
            console.error("Unable to stop consumer test server:", error);
            process.exitCode = 1;
        });
    };

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
}
