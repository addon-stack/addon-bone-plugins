export default {
    extends: ["@commitlint/config-conventional"],
    rules: {
        "scope-enum": [2, "always", ["@adnbn/plugin-reg-cs", "ci", "deps", "release", "repo"]],
    },
};
