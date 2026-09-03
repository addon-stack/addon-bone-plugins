/** @type {import("jest").Config} */
module.exports = {
    rootDir: __dirname,
    clearMocks: true,
    restoreMocks: true,
    testEnvironment: "node",
    testMatch: ["<rootDir>/tests/**/*.test.ts"],
    transform: {
        "^.+\\.[jt]s$": [
            "@swc/jest",
            {
                jsc: {
                    parser: {
                        syntax: "typescript",
                    },
                    target: "es2022",
                },
                module: {
                    type: "commonjs",
                },
                sourceMaps: "inline",
            },
        ],
    },
    transformIgnorePatterns: ["/node_modules/(?!\\.pnpm/webext-patterns@|webext-patterns/)"],
    collectCoverageFrom: ["plugin/**/*.ts"],
    coverageDirectory: "coverage",
    coverageReporters: ["text", "json-summary", "lcov"],
};
