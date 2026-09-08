import {selectConfig} from "../plugin/selection";
import type {RemoteConfigPath} from "../plugin/types";

const config = {
    banner: {enabled: false, text: "", count: 0, nullable: null},
    items: [{title: "first"}],
    "dotted.key": "literal",
};

it("returns the complete configuration when no selection is supplied", () => {
    expect(selectConfig(config)).toBe(config);
});

it.each([
    ["banner.enabled", false], ["banner.text", ""], ["banner.count", 0], ["banner.nullable", null],
    ["banner", config.banner], ["items.0.title", "first"], ["items.1.title", undefined],
    ["missing.value", undefined], ["banner.nullable.value", undefined], ["__proto__.toString", undefined],
])("selects %s without losing falsy values or throwing for missing branches", (path, expected) => {
    // Exercise runtime inputs without schema augmentation, including deliberately invalid paths.
    // The isolated compiler tests separately check inferred types and rejected arguments.
    expect(selectConfig(config, path as RemoteConfigPath)).toEqual(expected);
});

it("executes a selector locally and preserves its result", () => {
    const selector = jest.fn(value => [value]);
    expect(selectConfig(config, selector)).toEqual([config]);
    expect(selector).toHaveBeenCalledWith(config);
    expect(selectConfig(config, () => config["dotted.key"])).toBe("literal");
});

it("propagates selector errors", () => {
    expect(() => selectConfig(config, () => {
        throw new Error("selector failed");
    })).toThrow("selector failed");
});

it("does not expose inherited properties from dictionaries or traverse primitive values", () => {
    const dictionary = {own: "value"};
    expect(selectConfig({dictionary}, "dictionary.toString" as RemoteConfigPath)).toBeUndefined();
    expect(selectConfig({dictionary}, "dictionary.own.length" as RemoteConfigPath)).toBeUndefined();
    expect(selectConfig({dictionary}, "dictionary.own" as RemoteConfigPath)).toBe("value");
});
