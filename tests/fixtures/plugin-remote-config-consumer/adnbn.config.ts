import {defineConfig} from "adnbn";
import remoteConfig from "@adnbn/plugin-remote-config";

export default defineConfig({
    name: "Remote Config Consumer Smoke",
    description: "Validates the packed remote configuration plugin.",
    version: "1.0.0",
    plugins: [remoteConfig({
        url: () => process.env.REMOTE_CONFIG_SMOKE_URL ?? "http://127.0.0.1:8765/config.json",
        config: () => {
            if (process.env.REMOTE_CONFIG_SMOKE_DEFAULTS === "none") {
                return undefined;
            }

            if (process.env.REMOTE_CONFIG_SMOKE_DEFAULTS === "partial") {
                return {nested: {a: 1}};
            }

            return {flag: false, label: "default", nested: {a: 1, b: 2}};
        },
        ttl: () => Number(process.env.REMOTE_CONFIG_SMOKE_TTL ?? 1),
        timeout: () => Number(process.env.REMOTE_CONFIG_SMOKE_TIMEOUT ?? 1000),
        retryDelay: 100,
    })],
});
