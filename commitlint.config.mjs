export default {
    extends: ["@commitlint/config-conventional"],
    rules: {
        "type-enum": [2, "always", [
            "build", "chore", "ci", "deps", "docs", "feat", "fix", "perf", "refactor", "revert", "style", "test",
        ]],
        "scope-enum": [2, "always", [
            "@adnbn/plugin-reg-cs", "@adnbn/plugin-remote-config", "ci", "deps", "release", "repo",
        ]],
    },
};
