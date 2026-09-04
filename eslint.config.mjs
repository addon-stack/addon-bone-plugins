import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import jsonc from "eslint-plugin-jsonc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

import project from "./tools/eslint/file-naming.mjs";

const codeFiles = ["**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"];
const typeScriptFiles = ["**/*.{ts,cts,mts,tsx}"];
const jsonFiles = ["**/*.{json,jsonc}"];
const controlStatements = ["if", "for", "while", "do", "switch"];

const importGroups = [
    ["^\\u0000?node:"],
    [
        "^\\u0000?adnbn(?:/|\\u0000?$)",
        "^\\u0000?@adnbn/",
    ],
    ["^\\u0000?@addon-core/"],
    ["^\\u0000?@?\\w"],
    [
        "^",
        "^\\u0000?\\.",
    ],
    [
        "^\\u0000?.*\\.(?:avif|bmp|eot|gif|ico|jpe?g|mp3|mp4|ogg|otf|png|svg|ttf|wav|wasm|webm|webp|woff2?)" +
            "(?:[?#].*)?$",
    ],
    ["^\\u0000?.*\\.(?:css|scss)(?:[?#].*)?$"],
];

export default tseslint.config(
    {
        ignores: [
            "**/node_modules/**", "**/.git/**", "**/.nx/**", "**/.pnpm-store/**",
            "**/dist/**", "**/dist-types/**", "**/coverage/**", "**/output/**",
            "**/package/**", "**/.cache/**", "**/.output/**", "**/.rstest-temp/**",
            "**/.idea/**", "**/.vscode/**", ".husky/_/**", "**/.DS_Store",
            "**/.env*", "**/.npmrc", "**/*.log", "**/*.tgz", "**/*.tsbuildinfo",
            "package-lock.json",
        ],
    },
    {
        files: ["**/*.*", "**/!(*.*)"],
        plugins: {project},
        linterOptions: {reportUnusedDisableDirectives: "error"},
        rules: {
            "project/file-naming": ["error", {
                exceptions: [
                    "README.md", "CONTRIBUTING.md", "CHANGELOG.md", "CODE_OF_CONDUCT.md",
                    "SECURITY.md", "LICENSE", "LICENSE.md", "AGENTS.md", "CODEOWNERS",
                    "pull_request_template.md",
                ],
            }],
        },
    },
    {
        files: ["**/*.*", "**/!(*.*)"],
        ignores: [...codeFiles, ...jsonFiles],
        processor: "project/filename-only",
    },
    {
        files: codeFiles,
        extends: [js.configs.recommended],
        plugins: {"@stylistic": stylistic, "simple-import-sort": simpleImportSort},
        languageOptions: {
            ecmaVersion: "latest",
            parserOptions: {ecmaFeatures: {jsx: true}},
        },
        rules: {
            curly: ["error", "all"],
            "project/padding-around-multiline": "error",
            "@stylistic/array-bracket-spacing": ["error", "never"],
            "@stylistic/arrow-parens": ["error", "as-needed"],
            "@stylistic/arrow-spacing": "error",
            "@stylistic/block-spacing": ["error", "never"],
            "@stylistic/brace-style": ["error", "1tbs"],
            "@stylistic/comma-dangle": ["error", {
                arrays: "always-multiline", objects: "always-multiline", imports: "always-multiline",
                exports: "always-multiline", functions: "never", enums: "always-multiline",
                generics: "always-multiline", tuples: "always-multiline",
            }],
            "@stylistic/comma-spacing": "error",
            "@stylistic/comma-style": ["error", "last"],
            "@stylistic/computed-property-spacing": ["error", "never"],
            "@stylistic/eol-last": ["error", "always"],
            "@stylistic/function-call-spacing": ["error", "never"],
            "@stylistic/indent": ["error", 4, {SwitchCase: 1}],
            "@stylistic/key-spacing": "error",
            "@stylistic/keyword-spacing": "error",
            "@stylistic/linebreak-style": ["error", "unix"],
            "@stylistic/max-len": ["error", {
                code: 120,
                comments: 120,
                ignoreUrls: true,
                tabWidth: 4,
            }],
            "@stylistic/member-delimiter-style": "error",
            "@stylistic/no-extra-semi": "error",
            "@stylistic/no-floating-decimal": "error",
            "@stylistic/no-mixed-spaces-and-tabs": "error",
            "@stylistic/no-multi-spaces": "error",
            "@stylistic/no-multiple-empty-lines": ["error", {max: 1, maxBOF: 0, maxEOF: 0}],
            "@stylistic/no-trailing-spaces": "error",
            "@stylistic/object-curly-spacing": ["error", "never"],
            "@stylistic/padded-blocks": ["error", "never"],
            "@stylistic/padding-line-between-statements": ["error",
                {blankLine: "always", prev: "*", next: "return"},
                {blankLine: "always", prev: "*", next: controlStatements},
                {blankLine: "always", prev: controlStatements, next: "*"},
                {blankLine: "always", prev: "import", next: "*"},
                {blankLine: "any", prev: "import", next: "import"},
            ],
            "@stylistic/quote-props": ["error", "as-needed"],
            "@stylistic/quotes": ["error", "double", {avoidEscape: true, allowTemplateLiterals: "always"}],
            "@stylistic/rest-spread-spacing": ["error", "never"],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/semi-spacing": "error",
            "@stylistic/space-before-blocks": "error",
            "@stylistic/space-before-function-paren": ["error", {
                anonymous: "always",
                named: "never",
                asyncArrow: "always",
            }],
            "@stylistic/space-in-parens": ["error", "never"],
            "@stylistic/space-infix-ops": "error",
            "@stylistic/space-unary-ops": "error",
            "@stylistic/template-curly-spacing": ["error", "never"],
            "@stylistic/type-annotation-spacing": "error",
            "@stylistic/type-generic-spacing": "error",
            "@stylistic/type-named-tuple-spacing": "error",
            "simple-import-sort/imports": ["error", {groups: importGroups}],
            "simple-import-sort/exports": "error",
        },
    },
    {
        files: typeScriptFiles,
        extends: [tseslint.configs.recommended],
        rules: {
            "@typescript-eslint/consistent-type-imports": ["error", {
                fixStyle: "separate-type-imports",
                prefer: "type-imports",
            }],
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            }],
        },
    },
    {
        files: ["packages/*/*/plugin/**/*.{js,jsx,ts,tsx}"],
        languageOptions: {globals: {...globals.browser, ...globals.webextensions}},
    },
    {
        files: [
            "**/*.{cjs,mjs}", "**/*.config.{js,mjs,cjs,ts}", "tools/**/*.{js,ts}",
            "**/tests/**/*.{js,ts}",
        ],
        languageOptions: {globals: globals.node},
    },
    {
        files: ["**/*.{test,spec}.{js,cjs,mjs,ts,tsx}"],
        languageOptions: {globals: {...globals.node, ...globals.jest}},
    },
    {
        files: ["tools/**/*.cjs"],
        rules: {"@typescript-eslint/no-require-imports": "off"},
    },
    ...jsonc.configs["flat/recommended-with-jsonc"],
    {
        files: jsonFiles,
        plugins: {"@stylistic": stylistic},
        rules: {
            "@stylistic/eol-last": ["error", "always"],
            "@stylistic/linebreak-style": ["error", "unix"],
            "@stylistic/no-multiple-empty-lines": ["error", {max: 1, maxBOF: 0, maxEOF: 0}],
            "@stylistic/no-trailing-spaces": "error",
            "jsonc/array-bracket-newline": ["error", {minItems: 1}],
            "jsonc/array-bracket-spacing": ["error", "never"],
            "jsonc/array-element-newline": ["error", "always"],
            "jsonc/comma-dangle": ["error", "never"],
            "jsonc/comma-style": ["error", "last"],
            "jsonc/indent": ["error", 2],
            "jsonc/key-spacing": "error",
            "jsonc/object-curly-newline": ["error", {multiline: true, minProperties: 1}],
            "jsonc/object-curly-spacing": ["error", "never"],
            "jsonc/object-property-newline": "error",
            "jsonc/quote-props": ["error", "always"],
            "jsonc/quotes": ["error", "double"],
        },
    },
    {
        files: ["**/*.json"],
        rules: {"jsonc/no-comments": "error"},
    }
);
