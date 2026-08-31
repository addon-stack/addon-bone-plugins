import {defineConfig} from "@rstest/core";

export default defineConfig({
    root: import.meta.dirname,
    include: ["tests/**/*.test.ts"],
    testEnvironment: "node",
    clearMocks: true,
    restoreMocks: true,
    source: {
        tsconfigPath: "./tsconfig.test.json",
    },
    coverage: {
        provider: "v8",
        include: ["plugin/**/*.ts"],
        reporters: ["text", "json-summary", "lcov"],
    },
});
