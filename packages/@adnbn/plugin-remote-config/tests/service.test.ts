jest.mock("adnbn", () => ({defineService: (definition: unknown) => definition}));
jest.mock("../plugin/api", () => ({getRemoteConfigOptions: jest.fn()}));

import {getRemoteConfigOptions} from "../plugin/api";
import {normalizeOptions} from "../plugin/options";
import definition from "../plugin/service";
import type {RemoteConfigOptions} from "../plugin/types";
import {setupBrowserHarness} from "./helpers/browser";

const url = "https://config.example/config.json";
const cacheKey = "@adnbn/plugin-remote-config:cache";
const defaults = {flag: false, endpoint: "default", nested: {a: 1, b: 2}};
const remote = {flag: true, endpoint: "remote", nested: {a: 10, b: 20}};

const response = (value: unknown): Response => ({
    ok: true, status: 200, statusText: "OK", json: async () => value,
}) as Response;

let harness: ReturnType<typeof setupBrowserHarness>;
let fetchMock: jest.SpiedFunction<typeof fetch>;
let now: number;

const service = (options: Partial<RemoteConfigOptions> = {}) => {
    jest.mocked(getRemoteConfigOptions).mockReturnValue(normalizeOptions({config: defaults, url, ...options}));

    return definition.init({name: "@adnbn/plugin-remote-config/service"});
};

const seed = async (record: Record<string, unknown>) => {
    await harness.storage.api.local.set({[cacheKey]: record});
};

const stored = () => harness.storage.local.values()[cacheKey];

beforeEach(() => {
    harness = setupBrowserHarness();
    now = Date.parse("2026-09-01T00:00:00Z");
    jest.spyOn(Date, "now").mockImplementation(() => now);
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(response(remote));
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    harness.restore();
});

it("declares storage on the service without browser-specific exclusions", () => {
    expect(definition.permissions).toEqual(["storage"]);
    expect(definition).not.toHaveProperty("excludeBrowser");
});

it("uses defaults without accessing storage or the network when URL is disabled", async () => {
    const read = jest.spyOn(harness.storage.api.local, "get");
    await expect(service({url: undefined}).get()).resolves.toEqual(defaults);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
});

it("returns an empty object without defaults or an endpoint", async () => {
    const read = jest.spyOn(harness.storage.api.local, "get");
    await expect(service({config: undefined, url: undefined}).get()).resolves.toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
});

it("merges partial nested defaults with each new response only", async () => {
    const instance = service({config: {nested: {a: 1}}, ttl: 0});
    fetchMock.mockResolvedValue(response({flag: false, nested: {b: 2}}));
    await expect(instance.get()).resolves.toEqual({flag: false, nested: {a: 1, b: 2}});
    fetchMock.mockResolvedValue(response({nested: {b: 3}}));
    await expect(instance.get()).resolves.toEqual({nested: {a: 1, b: 3}});
    fetchMock.mockResolvedValue(response({}));
    await expect(instance.get()).resolves.toEqual({nested: {a: 1}});
});

it("returns an empty object after a successful empty response without defaults", async () => {
    const instance = service({config: undefined, ttl: 0});
    await expect(instance.get()).resolves.toEqual(remote);
    fetchMock.mockResolvedValue(response({}));
    await expect(instance.get()).resolves.toEqual({});
});

it("omits request credentials by default", async () => {
    await service().get();
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({credentials: "omit"}));
});

it.each(["omit", "same-origin", "include"] as const)(
    "uses the configured credentials policy: %s", async credentials => {
        await service({credentials}).get();
        expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({credentials}));
    }
);

it("merges each successful partial response with defaults, excluding previous remote values", async () => {
    const instance = service({ttl: 0});
    await expect(instance.get()).resolves.toEqual(remote);
    fetchMock.mockResolvedValue(response({nested: {a: 30}}));
    await expect(instance.get()).resolves.toEqual({...defaults, nested: {a: 30, b: 2}});
    expect(stored()).toEqual({url, config: {nested: {a: 30}}, updatedAt: now});
});

it.each([{}, {flag: false}, {nested: null}, {endpoint: ""}, {count: 0}, {items: []}])(
    "accepts empty and explicitly falsy values: %j", async value => {
        fetchMock.mockResolvedValue(response(value));
        await expect(service().get()).resolves.toEqual({...defaults, ...value});
    }
);

it("uses a fresh cache and refreshes at the TTL boundary", async () => {
    await seed({url, config: remote, updatedAt: now});
    const instance = service({ttl: 1});
    now += 59_999;
    await expect(instance.get()).resolves.toEqual(remote);
    expect(fetchMock).not.toHaveBeenCalled();
    now++;
    await instance.get();
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("loads ordinary storage once per service instance and keeps subsequent reads in memory", async () => {
    await seed({url, config: remote, updatedAt: now});
    const read = jest.spyOn(harness.storage.api.local, "get");
    const instance = service();
    await expect(instance.get()).resolves.toEqual(remote);
    await expect(instance.get()).resolves.toEqual(remote);
    expect(read).toHaveBeenCalledTimes(1);
    await expect(service().get()).resolves.toEqual(remote);
    expect(read).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
});

it("keeps in-memory cache state independent between service instances", async () => {
    const first = service();
    await expect(first.get()).resolves.toEqual(remote);
    const other = {flag: false, endpoint: "other", nested: {a: 3}};
    fetchMock.mockResolvedValue(response(other));

    await expect(service({url: "https://other.example/config.json"}).get())
        .resolves.toEqual({...other, nested: {a: 3, b: 2}});

    await expect(first.get()).resolves.toEqual(remote);
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each(["offline", "http", "json", "array", "null", "string", "number", "boolean"])(
    "retains the last working config and success timestamp after %s failure", async failure => {
        const updatedAt = now - 120_000;
        await seed({url, config: remote, updatedAt});

        if (failure === "offline") {
            fetchMock.mockRejectedValue(new Error("offline"));
        } else if (failure === "http") {
            fetchMock.mockResolvedValue({...response(null), ok: false, status: 503} as Response);
        } else if (failure === "json") {
            fetchMock.mockResolvedValue({...response(null), json: async () => {
                throw new SyntaxError("bad JSON");
            }});
        } else {
            const bodies: Record<string, unknown> = {array: [], null: null, string: "bad", number: 1, boolean: true};
            fetchMock.mockResolvedValue(response(bodies[failure]));
        }

        await expect(service({ttl: 1}).get()).resolves.toEqual(remote);
        expect(stored()).toEqual({url, config: remote, updatedAt, retryAt: now + 60_000});
    }
);

it.each([undefined, {nested: {a: 1}}, defaults])(
    "falls back to supplied defaults %j before the first success, then recovers", async config => {
        fetchMock.mockRejectedValue(new Error("offline"));
        const instance = service({config});
        await expect(instance.get()).resolves.toEqual(config ?? {});
        fetchMock.mockResolvedValue(response(remote));
        now += 59_999;
        await expect(instance.get()).resolves.toEqual(config ?? {});
        expect(fetchMock).toHaveBeenCalledTimes(1);
        now++;
        await expect(instance.get()).resolves.toEqual(remote);
        expect(stored()).toEqual({url, config: remote, updatedAt: now});
    }
);

it("shares failed attempts and retains retry delay across service restarts", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const instance = service();
    const results = await Promise.all(Array.from({length: 8}, () => instance.get()));
    expect(results).toEqual(Array.from({length: 8}, () => defaults));
    await expect(service().get()).resolves.toEqual(defaults);
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([true, false])("skips retry writes with zero delay and an existing cache: %s", async hasCache => {
    const record = {url, config: remote, updatedAt: now - 120_000};

    if (hasCache) {
        await seed(record);
    }

    const write = jest.spyOn(harness.storage.api.local, "set");
    fetchMock.mockRejectedValue(new Error("offline"));
    const instance = service({ttl: 0, retryDelay: 0});
    await expect(instance.get()).resolves.toEqual(hasCache ? remote : defaults);
    await expect(instance.get()).resolves.toEqual(hasCache ? remote : defaults);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(write).not.toHaveBeenCalled();
    expect(stored()).toEqual(hasCache ? record : undefined);
});

it.each([undefined, defaults])("retains stale configuration across restarts with defaults %j", async config => {
    await service({config}).get();
    now += 86_400_000;
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(service({config}).get()).resolves.toEqual(remote);
});

it("does not carry cached values or retry deadlines across different sources", async () => {
    await seed({url: "https://old.example/config.json", config: remote, updatedAt: now, retryAt: now + 60_000});
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(service({config: undefined}).get()).resolves.toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("still fetches when storage reads fail and contains errors when both sources fail", async () => {
    jest.spyOn(harness.storage.api.local, "get").mockImplementation(() => {
        throw new Error("read failed");
    });

    await expect(service().get()).resolves.toEqual(remote);
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(service().get()).resolves.toEqual(defaults);
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("retains network results when the storage provider cannot be constructed", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(chrome, "storage")!;
    Object.defineProperty(chrome, "storage", {...descriptor, value: undefined});

    try {
        const instance = service({ttl: 0});
        await expect(instance.get()).resolves.toEqual(remote);
        fetchMock.mockRejectedValue(new Error("offline"));
        await expect(instance.get()).resolves.toEqual(remote);
    } finally {
        Object.defineProperty(chrome, "storage", descriptor);
    }
});

it("returns and retains successful data in memory when persistence fails", async () => {
    jest.spyOn(harness.storage.api.local, "set").mockImplementation(() => {
        throw new Error("write failed");
    });

    const instance = service({ttl: 0});
    await expect(instance.get()).resolves.toEqual(remote);
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(instance.get()).resolves.toEqual(remote);
});

it("stores the accepted payload, URL and success time in one namespaced native write", async () => {
    const write = jest.spyOn(harness.storage.api.local, "set");
    await service().get();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toEqual({[cacheKey]: {url, config: remote, updatedAt: now}});
});

it("does not allow direct callers to mutate the cached config or defaults", async () => {
    const instance = service();
    const value = await instance.get() as typeof remote;
    value.nested.a = -1;
    await expect(instance.get()).resolves.toEqual(remote);
});

it.each([undefined, "broken", Date.parse("2030-01-01T00:00:00Z")])(
    "refreshes invalid or future timestamps: %s", async timestamp => {
        await seed({url, config: remote, updatedAt: timestamp});
        await service().get();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    }
);

it.each([true, false])("ignores records outside its namespace when network success is %s", async success => {
    const record = {url, config: remote, updatedAt: now};

    const unrelated = {
        cache: record,
        "another-plugin:cache": record,
    };

    await harness.storage.api.local.set(unrelated);

    const read = jest.spyOn(harness.storage.api.local, "get");
    const remove = jest.spyOn(harness.storage.api.local, "remove");

    if (!success) {
        fetchMock.mockRejectedValue(new Error("offline"));
    }

    await expect(service().get()).resolves.toEqual(success ? remote : defaults);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][0]).toBe(cacheKey);
    expect(remove).not.toHaveBeenCalled();
    expect(harness.storage.local.values()).toMatchObject(unrelated);
});

it("times out a stalled JSON body, releases waiting callers and ignores late completion", async () => {
    jest.useFakeTimers();
    let started!: () => void;

    const ready = new Promise<void>(resolve => {
        started = resolve;
    });

    let finish!: (value: unknown) => void;

    const body = new Promise<unknown>(resolve => {
        finish = resolve;
    });

    fetchMock.mockImplementation(async () => {
        started();

        return {...response(null), json: () => body};
    });

    const instance = service({timeout: 50, retryDelay: 0});
    const first = instance.get();
    await ready;
    await jest.advanceTimersByTimeAsync(50);
    await expect(first).resolves.toEqual(defaults);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    fetchMock.mockResolvedValue(response(remote));
    await expect(instance.get()).resolves.toEqual(remote);
    finish({flag: false, endpoint: "late"});
    await Promise.resolve();
    expect(stored()).toMatchObject({config: remote});
});

it("does not let a corrupted retry deadline suppress recovery indefinitely", async () => {
    await seed({url, config: remote, updatedAt: now - 120_000, retryAt: now + 1_000_000});
    await service({ttl: 1}).get();
    expect(fetchMock).toHaveBeenCalledTimes(1);
});
