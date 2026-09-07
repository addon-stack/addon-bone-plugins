export default class RpcClient {
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
