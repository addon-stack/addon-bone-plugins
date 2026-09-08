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
    moduleNameMapper: {
        "^@addon-core/storage$": "<rootDir>/node_modules/@addon-core/storage/dist/index.js",
    },
    transformIgnorePatterns: [
        "/node_modules/(?!\\.pnpm/(?:@addon-core\\+storage@|dot-prop@)|@addon-core/storage|dot-prop/)",
    ],
    collectCoverageFrom: ["plugin/**/*.ts"],
    coverageDirectory: "coverage",
    coverageReporters: ["text", "json-summary", "lcov"],
};
