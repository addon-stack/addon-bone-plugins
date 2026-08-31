import registerContentScript from "@adnbn/plugin-reg-cs";
import {defineConfig} from "adnbn";

export default defineConfig({
    name: "Plugin Reg CS Consumer Smoke",
    description: "Validates the packed plugin against a real Addon Bone build.",
    version: "1.0.0",
    jsFilename: "[name].js",
    cssFilename: "[name].css",
    plugins: [registerContentScript()],
});
