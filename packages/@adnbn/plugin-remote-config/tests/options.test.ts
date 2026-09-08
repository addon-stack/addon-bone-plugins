jest.mock("adnbn", () => ({definePlugin: (definition: unknown) => definition, getEnv: jest.fn()}));
jest.mock("@rspack/core", () => ({DefinePlugin: jest.fn()}));

import {getEnv} from "adnbn";

import {DefinePlugin} from "@rspack/core";

import pluginFactory from "../plugin";
import {normalizeOptions} from "../plugin/options";

interface TestPlugin {
    service: boolean;
    startup(context: {config: object}): void;
    manifest(context: {config: object; manifest: {addHostPermission: jest.Mock}}): void;
    bundler(context: {config: object}): {plugins: unknown[]};
}

const definitions = (plugin: TestPlugin, config = {}) => {
    plugin.bundler({config});

    return jest.mocked(DefinePlugin).mock.calls.at(-1)![0] as Record<string, string>;
};

beforeEach(() => {
    jest.mocked(getEnv).mockReset();
    jest.spyOn(console, "warn").mockImplementation(() => {});
});

it("resolves options at startup and reuses them across hooks and rebuilds", () => {
    jest.mocked(getEnv).mockReturnValue("https://config.example/path.json?token=example");
    const url = jest.fn(() => "CONFIG_URL");
    const config = jest.fn(() => ({flag: false}));
    const plugin = pluginFactory({url, config}) as unknown as TestPlugin;
    const build = {};
    const addHostPermission = jest.fn();

    expect(url).not.toHaveBeenCalled();
    expect(config).not.toHaveBeenCalled();
    expect(getEnv).not.toHaveBeenCalled();
    plugin.startup({config: build});
    expect(url).toHaveBeenCalledTimes(1);
    expect(config).toHaveBeenCalledTimes(1);
    expect(getEnv).toHaveBeenCalledTimes(1);

    plugin.manifest({config: build, manifest: {addHostPermission}});
    const initialDefinitions = definitions(plugin, build);

    expect(JSON.parse(initialDefinitions.__REMOTE_CONFIG_OPTIONS__)).toMatchObject({
        url: "https://config.example/path.json?token=example", config: {flag: false},
    });

    expect(addHostPermission).toHaveBeenCalledWith("https://config.example/*");
    expect(url).toHaveBeenCalledTimes(1);
    expect(config).toHaveBeenCalledTimes(1);
    expect(getEnv).toHaveBeenCalledTimes(1);

    jest.mocked(getEnv).mockReturnValue("https://next.example/config.json");
    expect(definitions(plugin, build)).toEqual(initialDefinitions);
    plugin.manifest({config: build, manifest: {addHostPermission}});
    expect(addHostPermission).toHaveBeenLastCalledWith("https://config.example/*");
    expect(url).toHaveBeenCalledTimes(1);
    expect(config).toHaveBeenCalledTimes(1);
    expect(getEnv).toHaveBeenCalledTimes(1);

    plugin.startup({config: {}});
    expect(url).toHaveBeenCalledTimes(2);
    expect(config).toHaveBeenCalledTimes(2);
    expect(getEnv).toHaveBeenCalledTimes(2);

    expect(JSON.parse(definitions(plugin).__REMOTE_CONFIG_OPTIONS__).url)
        .toBe("https://next.example/config.json");
});

it.each(["chrome", "firefox"])("keeps the service and endpoint access enabled in %s builds", browser => {
    const plugin = pluginFactory({config: {}, url: "https://config.example/config.json"}) as unknown as TestPlugin;

    for (const manifestVersion of [2, 3]) {
        plugin.startup({config: {browser, manifestVersion}});
        const addHostPermission = jest.fn();
        plugin.manifest({config: {browser, manifestVersion}, manifest: {addHostPermission}});
        expect(addHostPermission).toHaveBeenCalledWith("https://config.example/*");
        expect(plugin.service).toBe(true);
    }
});

it("adds no host permission for an explicitly disabled endpoint", () => {
    const plugin = pluginFactory({config: {}, url: ""}) as unknown as TestPlugin;
    const addHostPermission = jest.fn();
    plugin.startup({config: {}});
    plugin.manifest({config: {}, manifest: {addHostPermission}});
    expect(addHostPermission).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
});

it.each([undefined, ""])("warns once at startup when the default environment variable is %j", value => {
    jest.mocked(getEnv).mockReturnValue(value);
    const plugin = pluginFactory({config: {}}) as unknown as TestPlugin;
    const addHostPermission = jest.fn();
    plugin.startup({config: {}});
    plugin.manifest({config: {}, manifest: {addHostPermission}});
    definitions(plugin);
    definitions(plugin);
    expect(getEnv).toHaveBeenCalledWith("REMOTE_CONFIG_URL");
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"REMOTE_CONFIG_URL" is unset or empty'));
    expect(addHostPermission).not.toHaveBeenCalled();
});

it("identifies a missing custom environment variable in the warning", () => {
    const plugin = pluginFactory({config: {}, url: "CUSTOM_CONFIG_URL"}) as unknown as TestPlugin;
    plugin.startup({config: {}});
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"CUSTOM_CONFIG_URL" is unset or empty'));
});

it.each([
    {ttl: -1}, {ttl: NaN}, {ttl: Infinity}, {timeout: 0}, {timeout: -1}, {timeout: 2_147_483_648},
    {retryDelay: -1}, {retryDelay: Infinity}, {url: "ftp://config.example/config.json"},
    {url: "https://user:password@config.example/config.json"},
    {credentials: "unsupported" as any},
])("rejects invalid build parameters at startup: %j", options => {
    const plugin = pluginFactory({config: {}, ...options}) as unknown as TestPlugin;
    expect(() => plugin.startup({config: {}})).toThrow();
});

it("accepts fractional TTL, zero TTL and a disabled retry delay", () => {
    expect(normalizeOptions({config: {}, ttl: 0.5, retryDelay: 0})).toMatchObject({ttl: 0.5, retryDelay: 0});
    expect(normalizeOptions({config: {}, ttl: 0})).toMatchObject({ttl: 0});
});

it.each([undefined, [], null, "config", new Date()])("rejects missing or non-object defaults: %j", config => {
    expect(() => normalizeOptions({config: config as any})).toThrow("defaults must be a JSON object");
});

it("reports missing defaults when a JavaScript caller omits plugin options", () => {
    // @ts-expect-error JavaScript callers can omit the options required by the TypeScript signature.
    const plugin = pluginFactory() as unknown as TestPlugin;
    expect(() => plugin.startup({config: {}})).toThrow(new TypeError("Remote config defaults must be a JSON object"));
});

it("allows a URL getter to disable the endpoint even when the default environment variable exists", () => {
    jest.mocked(getEnv).mockReturnValue("https://config.example/config.json");
    const plugin = pluginFactory({config: {}, url: () => undefined}) as unknown as TestPlugin;
    const addHostPermission = jest.fn();
    plugin.startup({config: {}});
    plugin.manifest({config: {}, manifest: {addHostPermission}});
    expect(addHostPermission).not.toHaveBeenCalled();
    expect(getEnv).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
});
