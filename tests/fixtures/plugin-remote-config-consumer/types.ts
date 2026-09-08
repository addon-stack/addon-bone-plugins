import type {ServiceProxyTarget, ServiceTarget} from "adnbn/service";
import type * as plugin from "@adnbn/plugin-remote-config";
import type {RemoteConfig, ResolvedRemoteConfigOptions} from "@adnbn/plugin-remote-config";
import type * as api from "@adnbn/plugin-remote-config/api";
import type {getRemoteConfigOptions} from "@adnbn/plugin-remote-config/api";
import type * as hooks from "@adnbn/plugin-remote-config/hooks";
import type * as service from "@adnbn/plugin-remote-config/service";

type Equal<Actual, Expected> =
    (<T>() => T extends Actual ? 1 : 2) extends (<T>() => T extends Expected ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type PublicExports =
    | keyof typeof plugin
    | keyof typeof api
    | keyof typeof hooks
    | keyof typeof service;

export type InternalConstantCheck = Expect<Equal<Extract<PublicExports, "PluginName" | "PLUGIN_NAME">, never>>;

// Check the generated registry directly; the public API wrapper's generic return type can hide a broken registry.
export type ServiceContractChecks = [
    Expect<Equal<ReturnType<ServiceTarget<"@adnbn/plugin-remote-config/service">["get"]>, Promise<RemoteConfig>>>,
    Expect<Equal<ReturnType<ServiceProxyTarget<"@adnbn/plugin-remote-config/service">["get"]>, Promise<RemoteConfig>>>,
    Expect<Equal<ReturnType<typeof getRemoteConfigOptions>, ResolvedRemoteConfigOptions>>,
    Expect<Equal<ReturnType<typeof getRemoteConfigOptions>["timeout"], number>>,
    Expect<Equal<ReturnType<typeof getRemoteConfigOptions>["retryDelay"], number>>,
];
