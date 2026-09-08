import {mergeConfig} from "../plugin/service/merge";

it("deeply combines objects and keeps both input objects unchanged", () => {
    const defaults = {banner: {theme: {color: "blue", size: 10}, enabled: true}};
    const response = {banner: {theme: {color: "red"}}};
    const before = structuredClone({defaults, response});

    expect(mergeConfig(defaults, response)).toEqual({
        banner: {theme: {color: "red", size: 10}, enabled: true},
    });

    expect({defaults, response}).toEqual(before);
});

it.each([{items: []}, {items: [{name: "remote"}]}])("replaces arrays as a whole: %j", ({items}) => {
    expect(mergeConfig({items: [{name: "default", enabled: true}, {name: "second"}]}, {items})).toEqual({items});
});

it.each([false, 0, "", null, [], "text"].map(value => ({value})))("replaces an object with %j", ({value}) => {
    expect(mergeConfig({branch: {enabled: true}}, {branch: value})).toEqual({branch: value});
});

it("replaces a scalar or array with a remote object", () => {
    expect(mergeConfig({scalar: null, array: [1, 2]}, {scalar: {a: 1}, array: {b: 2}}))
        .toEqual({scalar: {a: 1}, array: {b: 2}});
});

it("restores nested defaults for an empty response or an empty nested object", () => {
    const defaults = {branch: {enabled: true}};
    expect(mergeConfig(defaults, {})).toEqual(defaults);
    expect(mergeConfig(defaults, {branch: {}})).toEqual(defaults);
});

it("treats prototype-related JSON keys as data without modifying prototypes", () => {
    const response = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
    const defaults = {nested: {enabled: true}};
    const merged = mergeConfig(defaults, response);
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(Object.hasOwn(merged, "__proto__")).toBe(true);
    expect(merged).toEqual({...defaults, ...response});
    expect(Object.prototype).not.toHaveProperty("polluted");
});
