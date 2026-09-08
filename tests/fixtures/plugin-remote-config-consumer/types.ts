import type {ServiceProxyTarget, ServiceTarget} from "adnbn/service";
import type * as plugin from "@adnbn/plugin-remote-config";
import type {RemoteConfig, ResolvedRemoteConfigOptions} from "@adnbn/plugin-remote-config";
import remoteConfig from "@adnbn/plugin-remote-config";
import type * as api from "@adnbn/plugin-remote-config/api";
import type {getRemoteConfigOptions} from "@adnbn/plugin-remote-config/api";
import {getRemoteConfig} from "@adnbn/plugin-remote-config/api";
import type * as react from "@adnbn/plugin-remote-config/react";
import {useRemoteConfig} from "@adnbn/plugin-remote-config/react";
import type * as service from "@adnbn/plugin-remote-config/service";

type Equal<Actual, Expected> =
    (<T>() => T extends Actual ? 1 : 2) extends (<T>() => T extends Expected ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type PublicExports =
    | keyof typeof plugin
    | keyof typeof api
    | keyof typeof react
    | keyof typeof service;

export type InternalConstantCheck = Expect<Equal<Extract<PublicExports, "PluginName" | "PLUGIN_NAME">, never>>;

// Check the generated registry directly as well as the public API wrappers.
export type ServiceContractChecks = [
    Expect<Equal<ReturnType<ServiceTarget<"@adnbn/plugin-remote-config/service">["get"]>, Promise<RemoteConfig>>>,
    Expect<Equal<ReturnType<ServiceProxyTarget<"@adnbn/plugin-remote-config/service">["get"]>, Promise<RemoteConfig>>>,
    Expect<Equal<ReturnType<typeof getRemoteConfigOptions>, ResolvedRemoteConfigOptions>>,
    Expect<Equal<ReturnType<typeof getRemoteConfigOptions>["timeout"], number>>,
    Expect<Equal<ReturnType<typeof getRemoteConfigOptions>["retryDelay"], number>>,
    Expect<Equal<ReturnType<typeof getRemoteConfigOptions>["config"]["nested"], {
        a?: number;
        b?: number;
    } | undefined>>,
    Expect<Equal<Extract<ReturnType<typeof getRemoteConfigOptions>["config"], undefined>, never>>,
];

// This file is type-checked after every real framework build, and is not a runtime entrypoint.
export function useSelectionTypeChecks(path: string, index: number) {
    const _full = getRemoteConfig();
    const _nested = getRemoteConfig("nested");
    const _value = getRemoteConfig("nested.b");
    const _optional = getRemoteConfig("optional.value");
    const _nullable = getRemoteConfig("nullable.value");
    const _array = getRemoteConfig(`items.${index}.title`);
    const _requiredArray = getRemoteConfig(`banners.${index}.title`);
    const _dictionary = getRemoteConfig("labels.save");
    const _tuple = getRemoteConfig("tuple.1.enabled");
    const _deep = getRemoteConfig("deep.a.b.c.d.e.f");
    const _selected = getRemoteConfig(config => config.flag ? "yes" as const : "no" as const);
    const _asyncSelected = getRemoteConfig(async config => config.label);
    const _hookFull = useRemoteConfig();
    const _hookValue = useRemoteConfig("nested.b");
    const _hookOptional = useRemoteConfig("optional.value");
    const _hookNullable = useRemoteConfig("nullable.value");
    const _hookArray = useRemoteConfig(`items.${index}.title`);
    const _hookRequiredArray = useRemoteConfig(`banners.${index}.title`);
    const _hookDictionary = useRemoteConfig("labels.save");
    const _hookTuple = useRemoteConfig("tuple.1.enabled");
    const _hookSelected = useRemoteConfig(config => config.flag ? 1 as const : 0 as const);
    const _hookObject = useRemoteConfig(config => ({enabled: config.flag}));
    const _hookOptionalSelection = useRemoteConfig(config => config.flag ? config.label : undefined);
    const _literalKey = useRemoteConfig(config => config["dotted.key"]);

    type Checks = [
        Expect<Equal<typeof _full, Promise<RemoteConfig>>>,
        Expect<Equal<typeof _nested, Promise<RemoteConfig["nested"]>>>,
        Expect<Equal<typeof _value, Promise<number>>>,
        Expect<Equal<typeof _optional, Promise<number | undefined>>>,
        Expect<Equal<typeof _nullable, Promise<number | undefined>>>,
        Expect<Equal<typeof _array, Promise<string | undefined>>>,
        Expect<Equal<typeof _requiredArray, Promise<string | undefined>>>,
        Expect<Equal<typeof _dictionary, Promise<string | undefined>>>,
        Expect<Equal<typeof _tuple, Promise<boolean | undefined>>>,
        Expect<Equal<typeof _deep, Promise<number | undefined>>>,
        Expect<Equal<typeof _selected, Promise<"yes" | "no">>>,
        Expect<Equal<typeof _asyncSelected, Promise<string>>>,
        Expect<Equal<typeof _hookFull, RemoteConfig>>,
        Expect<Equal<typeof _hookValue, number>>,
        Expect<Equal<typeof _hookOptional, number | undefined>>,
        Expect<Equal<typeof _hookNullable, number | undefined>>,
        Expect<Equal<typeof _hookArray, string | undefined>>,
        Expect<Equal<typeof _hookRequiredArray, string | undefined>>,
        Expect<Equal<typeof _hookDictionary, string | undefined>>,
        Expect<Equal<typeof _hookTuple, boolean | undefined>>,
        Expect<Equal<typeof _hookSelected, 0 | 1>>,
        Expect<Equal<typeof _hookObject, {enabled: boolean}>>,
        Expect<Equal<typeof _hookOptionalSelection, string | undefined>>,
        Expect<Equal<typeof _literalKey, string | undefined>>,
    ];

    // @ts-expect-error Unknown configuration field.
    getRemoteConfig("nested.missing");
    // @ts-expect-error Unknown configuration field.
    useRemoteConfig("nested.missing");
    // @ts-expect-error Arbitrary strings cannot bypass the augmented schema.
    getRemoteConfig(path);
    // @ts-expect-error Arbitrary strings cannot bypass the augmented schema.
    useRemoteConfig(path);
    // @ts-expect-error Tuple index is outside its declared bounds.
    getRemoteConfig("tuple.2.enabled");
    // @ts-expect-error Array methods are not JSON fields.
    useRemoteConfig("items.map");
    // @ts-expect-error Literal keys containing dots use a selector instead.
    getRemoteConfig("dotted.key");
    // @ts-expect-error Public string paths use dot notation for array indices.
    useRemoteConfig("items[0].title");
    // @ts-expect-error Callers cannot override the full configuration type.
    getRemoteConfig<{invented: boolean}>();
    // @ts-expect-error React selectors must complete synchronously during render.
    useRemoteConfig(async config => config.label);
    // @ts-expect-error Returning a Promise without async is also unsupported by the hook.
    useRemoteConfig(config => Promise.resolve(config.flag));
    // @ts-expect-error A selector must not return a Promise on any branch.
    useRemoteConfig(config => config.flag ? config.label : Promise.resolve(config.label));
    // @ts-expect-error Promise-like return values cannot be awaited during render either.
    useRemoteConfig(config => Promise.resolve(config.label) as PromiseLike<string>);
    remoteConfig();
    remoteConfig({});
    remoteConfig({url: "https://example.com/config.json"});
    remoteConfig({config: undefined});
    remoteConfig({config: {}});
    remoteConfig({config: {flag: false}});
    remoteConfig({config: {flag: false, label: "default", nested: {a: 1}}});
    remoteConfig({config: () => ({flag: false})});
    remoteConfig({config: () => ({nested: {a: 1}})});
    remoteConfig({config: () => undefined});
    remoteConfig({config: {banners: [{title: "default"}], tuple: ["first", {enabled: false}]}});

    // @ts-expect-error Supplied values must follow the augmented schema.
    remoteConfig({config: {flag: "wrong"}});
    // @ts-expect-error Nested values must follow the augmented schema.
    remoteConfig({config: {nested: {a: "wrong"}}});
    // @ts-expect-error Getters must also follow the augmented schema.
    remoteConfig({config: () => ({nested: {a: "wrong"}})});
    // @ts-expect-error Unknown configuration fields remain invalid.
    remoteConfig({config: {invented: true}});
    // @ts-expect-error Defaults must be an object when supplied.
    remoteConfig({config: null});
    // @ts-expect-error Supplied array elements retain their required fields.
    remoteConfig({config: {banners: [{}]}});
    // @ts-expect-error Supplied tuples retain their required entries.
    remoteConfig({config: {tuple: ["first"]}});

    return {} as Checks;
}
