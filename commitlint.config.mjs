export default {
    extends: ["@commitlint/config-conventional"],
    rules: {
        "scope-enum": [2, "always", [
            "@adnbn/plugin-reg-cs", "@adnbn/plugin-remote-config", "ci", "deps", "release", "repo",
        ]],
    },
};
