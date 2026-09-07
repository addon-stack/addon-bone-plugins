import "@adnbn/plugin-remote-config";

declare module "@adnbn/plugin-remote-config" {
    interface RemoteConfig {
        flag: boolean;
        label: string;
        nested: {a: number; b?: number};
    }
}
