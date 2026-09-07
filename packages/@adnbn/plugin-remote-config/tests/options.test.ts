jest.mock("adnbn", () => ({definePlugin: (definition: unknown) => definition, getEnv: jest.fn()}));

import {getEnv} from "adnbn";

import pluginFactory from "../plugin";
import {normalizeOptions} from "../plugin/options";

interface TestPlugin {
    service: boolean;
    manifest(context: {config: object; manifest: {addHostPermission: jest.Mock}}): void;
    bundler(context: {config: object}): {plugins: {_args: [Record<string, string>]}[]};
}

it("resolves getters and environment values once per build for both hooks", () => {
    jest.mocked(getEnv).mockReturnValue("https://config.example/path.json?token=example");
    const url = jest.fn(() => "CONFIG_URL");
    const config = jest.fn(() => ({flag: false}));
    const plugin = pluginFactory({url, config}) as unknown as TestPlugin;
    const build = {};
    const addHostPermission = jest.fn();
    plugin.manifest({config: build, manifest: {addHostPermission}});
    const definitions = plugin.bundler({config: build}).plugins[0]._args[0];

    expect(JSON.parse(definitions.__REMOTE_CONFIG_OPTIONS__)).toMatchObject({
        url: "https://config.example/path.json?token=example", config: {flag: false},
    });

    expect(addHostPermission).toHaveBeenCalledWith("https://config.example/*");
    expect(url).toHaveBeenCalledTimes(1);
    expect(config).toHaveBeenCalledTimes(1);
    expect(getEnv).toHaveBeenCalledTimes(1);
    plugin.bundler({config: {}});
    expect(url).toHaveBeenCalledTimes(2);
});

it.each(["chrome", "firefox"])("keeps the service and endpoint access enabled in %s builds", browser => {
    const plugin = pluginFactory({url: "https://config.example/config.json"}) as unknown as TestPlugin;

    for (const manifestVersion of [2, 3]) {
        const addHostPermission = jest.fn();
        plugin.manifest({config: {browser, manifestVersion}, manifest: {addHostPermission}});
        expect(addHostPermission).toHaveBeenCalledWith("https://config.example/*");
        expect(plugin.service).toBe(true);
    }
});

it("adds no host permission for an explicitly disabled endpoint", () => {
    const plugin = pluginFactory({url: ""}) as unknown as TestPlugin;
    const addHostPermission = jest.fn();
    plugin.manifest({config: {}, manifest: {addHostPermission}});
    expect(addHostPermission).not.toHaveBeenCalled();
});

it.each([
    {ttl: -1}, {ttl: NaN}, {ttl: Infinity}, {timeout: 0}, {timeout: -1}, {timeout: 2_147_483_648},
    {retryDelay: -1}, {retryDelay: Infinity}, {url: "ftp://config.example/config.json"},
    {url: "https://user:password@config.example/config.json"},
])("rejects invalid build parameters: %j", options => {
    expect(() => normalizeOptions(options)).toThrow();
});

it("accepts fractional TTL, zero TTL and a disabled retry delay", () => {
    expect(normalizeOptions({ttl: 0.5, retryDelay: 0})).toMatchObject({ttl: 0.5, retryDelay: 0});
    expect(normalizeOptions({ttl: 0})).toMatchObject({ttl: 0});
});

it.each([[], null, "config", new Date()])("rejects non-object defaults: %j", config => {
    expect(() => normalizeOptions({config: config as any})).toThrow("defaults must be a JSON object");
});

it("allows a URL getter to disable the endpoint even when the default environment variable exists", () => {
    jest.mocked(getEnv).mockReturnValue("https://config.example/config.json");
    const plugin = pluginFactory({url: () => undefined}) as unknown as TestPlugin;
    const addHostPermission = jest.fn();
    plugin.manifest({config: {}, manifest: {addHostPermission}});
    expect(addHostPermission).not.toHaveBeenCalled();
    expect(getEnv).not.toHaveBeenCalled();
});
