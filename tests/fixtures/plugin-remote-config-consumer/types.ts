import type {ServiceProxyTarget, ServiceTarget} from "adnbn/service";
import type {RemoteConfig} from "@adnbn/plugin-remote-config";

type Equal<Actual, Expected> =
    (<T>() => T extends Actual ? 1 : 2) extends (<T>() => T extends Expected ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

// Check the generated registry directly; the public API wrapper's generic return type can hide a broken registry.
export type ServiceContractChecks = [
    Expect<Equal<ReturnType<ServiceTarget<"@adnbn/plugin-remote-config/service">["get"]>, Promise<RemoteConfig>>>,
    Expect<Equal<ReturnType<ServiceProxyTarget<"@adnbn/plugin-remote-config/service">["get"]>, Promise<RemoteConfig>>>,
];
