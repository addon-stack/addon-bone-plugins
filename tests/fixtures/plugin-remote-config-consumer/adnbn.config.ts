import {defineConfig} from "adnbn";
import remoteConfig from "@adnbn/plugin-remote-config";

export default defineConfig({
    name: "Remote Config Consumer Smoke",
    description: "Validates the packed remote configuration plugin.",
    version: "1.0.0",
    plugins: [remoteConfig({
        url: () => process.env.REMOTE_CONFIG_SMOKE_URL ?? "http://127.0.0.1:8765/config.json",
        config: {flag: false, label: "default", nested: {a: 1, b: 2}},
        ttl: 0,
        timeout: 1000,
        retryDelay: 100,
    })],
});
