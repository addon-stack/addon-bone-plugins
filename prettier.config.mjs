/** @type {import("prettier").Config} */
const config = {
    arrowParens: "avoid",
    bracketSpacing: false,
    endOfLine: "lf",
    printWidth: 120,
    semi: true,
    singleQuote: false,
    tabWidth: 4,
    trailingComma: "es5",
    useTabs: false,
    overrides: [
        {
            files: ["*.json", "*.jsonc", "*.yml", "*.yaml"],
            options: {
                bracketSpacing: true,
                printWidth: 100,
                tabWidth: 2,
            },
        },
    ],
};

export default config;
