jest.mock("adnbn", () => ({getService: jest.fn()}));
jest.mock("adnbn/service", () => ({getService: jest.fn()}));

import {getService as getProxy} from "adnbn";
import {getService as getOrigin} from "adnbn/service";

import {getRemoteConfig, getRemoteConfigOptions} from "../plugin/api";
import {setupBrowserHarness} from "./helpers/browser";

const config = {banner: {title: "remote", enabled: false}};
let harness: ReturnType<typeof setupBrowserHarness> | undefined;
const get = jest.fn(async () => structuredClone(config));

afterEach(() => {
    harness?.restore();
    harness = undefined;
    Reflect.deleteProperty(globalThis, "__REMOTE_CONFIG_OPTIONS__");
});

it.each(["serviceWorker", "contentScript"] as const)("selects locally in %s", async context => {
    harness = setupBrowserHarness(context);

    harness.browser.runtime.setManifest({
        manifest_version: 3, name: "Remote config test", version: "1.0.0",
        background: {service_worker: "background.js"},
    });

    jest.mocked(getOrigin).mockReturnValue({get} as unknown as ReturnType<typeof getOrigin>);
    jest.mocked(getProxy).mockReturnValue({get} as ReturnType<typeof getProxy>);

    await expect(getRemoteConfig()).resolves.toEqual(config);
    // The augmented-schema type checks live in the packed consumer fixture.
    await expect(getRemoteConfig("banner.enabled" as never)).resolves.toBe(false);
    const suffix = "!";
    const selector = jest.fn(value => `${(value as typeof config).banner.title}${suffix}`);
    await expect(getRemoteConfig(selector)).resolves.toBe("remote!");
    expect(selector).toHaveBeenCalledWith(config);
    expect(get.mock.calls).toEqual([[], [], []]);
    const selected = context === "serviceWorker" ? getOrigin : getProxy;
    const unused = context === "serviceWorker" ? getProxy : getOrigin;
    expect(selected).toHaveBeenCalledWith("@adnbn/plugin-remote-config/service");
    expect(unused).not.toHaveBeenCalled();
});

it("fails clearly when build-time configuration was not injected", () => {
    expect(() => getRemoteConfigOptions()).toThrow("Make sure the plugin is properly configured");
});

it("returns complete injected defaults and normalized runtime options", () => {
    Object.assign(globalThis, {__REMOTE_CONFIG_OPTIONS__: {config}});
    expect(getRemoteConfigOptions()).toMatchObject({config, ttl: 1440, timeout: 10_000, credentials: "omit"});
});

it("rejects injected options without required defaults", () => {
    Object.assign(globalThis, {__REMOTE_CONFIG_OPTIONS__: {}});
    expect(() => getRemoteConfigOptions()).toThrow("defaults must be a JSON object");
});
