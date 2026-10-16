import {execFileSync, spawnSync} from "node:child_process";
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, test} from "@jest/globals";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const RegCs = "@adnbn/plugin-reg-cs";
const RemoteConfig = "@adnbn/plugin-remote-config";

const env = {
    ...Object.fromEntries(Object.entries(process.env)
        .filter(([key]) => !key.startsWith("GIT_") && !key.startsWith("NX_"))),
    NX_DAEMON: "false",
    NX_ISOLATE_PLUGINS: "false",
    NX_NO_CLOUD: "true",
    HUSKY: "0",
    CI: "true",
};

let temporary;
let baseline;
let cwd;

function git(...args) {
    return execFileSync("git", [
        "-c", "core.hooksPath=/dev/null",
        "-c", "commit.gpgsign=false",
        "-c", "tag.gpgsign=false",
        "-c", "user.name=Release regression",
        "-c", "user.email=release-regression@example.invalid",
        ...args,
    ], {cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]}).trim();
}

function write(file, source) {
    mkdirSync(dirname(join(cwd, file)), {recursive: true});
    writeFileSync(join(cwd, file), source);
}

function json(file) {
    return JSON.parse(readFileSync(join(cwd, file), "utf8"));
}

function commit(message) {
    git("add", ".");
    git("commit", "-qm", message);
}

// Change a real resolved package's integrity without relying on a future registry release.
// This exercises the lockfile-only path used for transitive dependency updates too.
function changeDependency(name) {
    const file = "pnpm-lock.yaml";
    const source = readFileSync(join(cwd, file), "utf8");
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(\n  '?${escaped}@[^\n]+:\n    resolution: {integrity: )[^}]+`);
    const updated = source.replace(pattern, "$1sha512-regression");

    expect(updated).not.toBe(source);
    write(file, updated);
}

function preview() {
    const before = git("status", "--porcelain");
    const tags = git("tag");
    const output = join(temporary, "result.json");
    rmSync(output, {force: true});

    const result = spawnSync(process.execPath, ["tools/release/tests/helpers/preview.mjs", output], {
        cwd, env, encoding: "utf8", timeout: 110000,
    });

    if (result.status !== 0) {
        throw new Error(result.error?.message ?? `${result.stdout}\n${result.stderr}`);
    }

    expect(git("status", "--porcelain")).toBe(before);
    expect(git("tag")).toBe(tags);

    return JSON.parse(readFileSync(output, "utf8"));
}

function expectedPatch(name) {
    const version = json(`packages/${name}/package.json`).version.split(".").map(Number);
    version[2]++;

    return version.join(".");
}

beforeAll(() => {
    temporary = mkdtempSync(join(tmpdir(), "addon-bone-plugins-release-"));
    baseline = join(temporary, "baseline");
    mkdirSync(baseline);
    cwd = baseline;

    const files = execFileSync("git", ["ls-files", "-z"], {cwd: root, env, encoding: "utf8"})
        .split("\0").filter(Boolean);

    for (const file of files) {
        mkdirSync(dirname(join(cwd, file)), {recursive: true});
        cpSync(join(root, file), join(cwd, file));
    }

    // Include new, not-yet-committed release code in this isolated repository.
    cpSync(join(root, "tools/release"), join(cwd, "tools/release"), {recursive: true});
    git("init", "-q", "--initial-branch=main");
    git("remote", "add", "origin", "https://github.com/addon-stack/addon-bone-plugins.git");
    commit("chore: release test baseline");

    for (const name of [RegCs, RemoteConfig]) {
        git("tag", `${name}@${json(`packages/${name}/package.json`).version}`);
    }
});

beforeEach(() => {
    cwd = temporary;
    git("clone", "--quiet", "--no-hardlinks", baseline, "scenario");
    cwd = join(temporary, "scenario");
    git("remote", "set-url", "origin", "https://github.com/addon-stack/addon-bone-plugins.git");
    symlinkSync(join(root, "node_modules"), join(cwd, "node_modules"), "dir");
});

afterEach(() => rmSync(join(temporary, "scenario"), {recursive: true, force: true}));
afterAll(() => rmSync(temporary, {recursive: true, force: true}));

describe("Nx independent version and changelog dry-runs with real Git history", () => {
    test.each([
        ["@addon-core/inject-css", RegCs, RemoteConfig],
        ["dot-prop", RemoteConfig, RegCs],
    ])("%s changes only its consuming plugin", (dependency, changed, unchanged) => {
        changeDependency(dependency);
        commit("deps: update dependencies");

        const {versions, changelog} = preview();

        expect(versions[changed].newVersion).toBe(expectedPatch(changed));
        expect(versions[unchanged].newVersion).toBeNull();
        expect(changelog.projectChangelogs[changed].contents).toContain("📦 Dependencies");
        expect(changelog.projectChangelogs[changed].contents).toContain("update dependencies");
        expect(changelog.projectChangelogs[unchanged]).toBeUndefined();
    });

    test.each(["@addon-core/browser", "@types/chrome"])("shared %s releases both consumers", dependency => {
        changeDependency(dependency);
        commit("deps: update dependencies");

        const {versions} = preview();

        for (const name of [RegCs, RemoteConfig]) {
            expect(versions[name].newVersion).toBe(expectedPatch(name));
        }
    });

    test.each(["ci: update checks", "chore(deps): update development dependencies"])("%s does not release", message => {
        changeDependency("@addon-core/browser");
        write("package.json", JSON.stringify({...json("package.json"), description: "Changed shared tooling"}));
        commit(message);

        const {versions} = preview();

        expect(versions[RegCs].newVersion).toBeNull();
        expect(versions[RemoteConfig].newVersion).toBeNull();
    });

    test.each(["deps: update dependencies", "chore(deps): update development dependencies", "ci: update checks"])(
        "commitlint accepts %s", message => {
            const result = spawnSync(process.execPath, ["node_modules/@commitlint/cli/cli.js"], {
                cwd, env, input: message, encoding: "utf8",
            });

            expect(result.stderr).toBe("");
            expect(result.status).toBe(0);
        }
    );

    test("no updates do not create release versions", () => {
        const {versions} = preview();

        expect(versions[RegCs].newVersion).toBeNull();
        expect(versions[RemoteConfig].newVersion).toBeNull();
    });

    test("manifest plus lockfile updates stay within one plugin", () => {
        changeDependency("@addon-core/inject-css");
        const file = `packages/${RegCs}/package.json`;
        const manifest = json(file);
        manifest.dependencies["@addon-core/inject-css"] = "^0.4.1";
        write(file, JSON.stringify(manifest));

        const lock = readFileSync(join(cwd, "pnpm-lock.yaml"), "utf8")
            .replaceAll("@addon-core/inject-css@0.4.0", "@addon-core/inject-css@0.4.1")
            .replace("specifier: ^0.4.0\n        version: 0.4.0", "specifier: ^0.4.1\n        version: 0.4.1");

        write("pnpm-lock.yaml", lock);
        commit(`deps(${RegCs}): update inject-css`);

        const {versions, changelog} = preview();

        expect(versions[RegCs].newVersion).toBe(expectedPatch(RegCs));
        expect(versions[RemoteConfig].newVersion).toBeNull();
        expect(changelog.projectChangelogs[RegCs].contents.match(/update inject-css/g)).toHaveLength(1);
    });

    test("each plugin uses its own release tag after an intervening release", () => {
        changeDependency("@addon-core/inject-css");
        commit("deps: update inject-css");
        const file = `packages/${RegCs}/package.json`;
        const manifest = json(file);
        manifest.version = expectedPatch(RegCs);
        write(file, JSON.stringify(manifest));
        commit("chore(release): publish reg-cs");
        git("tag", `${RegCs}@${manifest.version}`);
        changeDependency("dot-prop");
        commit("deps: update dot-prop");

        const {versions, changelog} = preview();

        expect(versions[RegCs].newVersion).toBeNull();
        expect(versions[RemoteConfig].newVersion).toBe(expectedPatch(RemoteConfig));
        expect(changelog.projectChangelogs[RemoteConfig].contents).toContain("update dot-prop");
        expect(changelog.projectChangelogs[RemoteConfig].contents).not.toContain("update inject-css");
    });

    test("dependency preflight failures stop the real version command", () => {
        write("tools/release/check-dependency-history.mjs", "throw new Error('Preflight regression');\n");
        commit("chore: simulate preflight failure");
        changeDependency("dot-prop");
        commit("deps: update dependencies");
        expect(() => preview()).toThrow(/Preflight regression/);
        expect(git("status", "--porcelain")).toBe("");
    });

    test("breaking changes below 1.0 retain the existing minor release policy", () => {
        write(`packages/${RemoteConfig}/plugin/release-regression.ts`, "export {};\n");
        commit(`feat(${RemoteConfig})!: change contract`);

        const {versions} = preview();
        const [major, minor] = json(`packages/${RemoteConfig}/package.json`).version.split(".").map(Number);

        expect(versions[RemoteConfig].newVersion).toBe(`${major}.${minor + 1}.0`);
        expect(versions[RegCs].newVersion).toBeNull();
    });

    test("missing package tags block release before versioning", () => {
        git("tag", "-d", `${RegCs}@${json(`packages/${RegCs}/package.json`).version}`);
        expect(() => preview()).toThrow(/Missing release tag|No git tags matching pattern/);
    });
});
