import "@adnbn/plugin-remote-config";

declare module "@adnbn/plugin-remote-config" {
    interface RemoteConfig {
        flag: boolean;
        label: string;
        nested: {a: number; b: number};
        optional?: {value: number};
        nullable?: {value: number} | null;
        items?: {title: string}[];
        tuple?: readonly [string, {enabled: boolean}];
        deep?: {a: {b: {c: {d: {e: {f: number}}}}}};
        "dotted.key"?: string;
    }
}
