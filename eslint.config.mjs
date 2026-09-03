import js from "@eslint/js";
import {defineConfig, globalIgnores} from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
    globalIgnores([
        ".nx/**",
        "coverage/**",
        "dist/**",
        "dist-types/**",
        "node_modules/**",
        "output/**",
        "package/**",
        "packages/**/dist-types/**",
    ]),
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{js,mjs,cjs,ts}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
        },
        plugins: {
            "simple-import-sort": simpleImportSort,
        },
        rules: {
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    fixStyle: "separate-type-imports",
                    prefer: "type-imports",
                },
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "simple-import-sort/exports": "error",
            "simple-import-sort/imports": "error",
        },
    },
    {
        files: ["packages/*/*/plugin/**/*.ts"],
        languageOptions: {
            globals: globals.browser,
        },
    },
    {
        files: ["**/*.config.{js,mjs,cjs,ts}", "tools/**/*.{js,mjs,cjs,ts}", "**/tests/**/*.ts"],
        languageOptions: {
            globals: globals.node,
        },
    },
    {
        files: ["tools/**/*.cjs"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },
    prettier,
]);
