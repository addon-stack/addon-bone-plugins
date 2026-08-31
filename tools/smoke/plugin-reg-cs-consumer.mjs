import {spawnSync} from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packageDir = path.join(repoRoot, "packages/@adnbn/plugin-reg-cs");
const fixtureDir = path.join(repoRoot, "tests/fixtures/plugin-reg-cs-consumer");
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "plugin-reg-cs-consumer-"));
const packDir = path.join(temporaryRoot, "pack");
const consumerDir = path.join(temporaryRoot, "consumer");

const run = (command, args, cwd) => {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        env: {...process.env, CI: "true"},
        stdio: "pipe",
    });

    if (result.status !== 0) {
        process.stderr.write(result.stdout ?? "");
        process.stderr.write(result.stderr ?? "");
        throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
    }

    return result.stdout ?? "";
};

const readJson = file => JSON.parse(readFileSync(file, "utf8"));

const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const assertIncludes = (values, expected, label) => {
    assert(values?.includes(expected), `${label} must include ${expected}; got ${JSON.stringify(values)}`);
};

const collectFiles = directory => {
    const files = [];

    for (const entry of readdirSync(directory, {withFileTypes: true})) {
        const absolute = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...collectFiles(absolute));
        } else {
            files.push(absolute);
        }
    }

    return files;
};

const inspectBundle = (outputDir, manifest) => {
    const backgroundFiles = [manifest.background?.service_worker, ...(manifest.background?.scripts ?? [])].filter(
        Boolean
    );

    assert(backgroundFiles.length > 0, `No background bundle found in ${outputDir}`);

    const backgroundSource = backgroundFiles.map(file => readFileSync(path.join(outputDir, file), "utf8")).join("\n");

    for (const marker of ["ExecuteScript error on tab", "InsertCSS error on tab"]) {
        assert(backgroundSource.includes(marker), `Background bundle does not contain plugin marker: ${marker}`);
    }
};

const buildAndInspect = ({browser, manifestVersion}) => {
    const args = ["node_modules/adnbn/bin/adnbn.js", "build", ".", "-a", "smoke", "-b", browser];

    if (manifestVersion === 2) args.push("--mv2");

    run("node", args, consumerDir);
    run("pnpm", ["exec", "tsc", "--noEmit"], consumerDir);

    const outputDir = path.join(consumerDir, `dist/smoke-${browser}-mv${manifestVersion}`);
    const manifestPath = path.join(outputDir, "manifest.json");

    assert(existsSync(manifestPath), `Build did not create ${manifestPath}`);

    const manifest = readJson(manifestPath);

    assert(manifest.manifest_version === manifestVersion, `${browser} manifest version is not ${manifestVersion}`);
    assertIncludes(manifest.permissions, "tabs", `${browser} permissions`);

    if (manifestVersion === 3) {
        assert(typeof manifest.background?.service_worker === "string", "Chrome MV3 must use a service worker");
        assertIncludes(manifest.permissions, "scripting", "Chrome MV3 permissions");
        assertIncludes(manifest.host_permissions, "https://example.com/*", "Chrome MV3 host permissions");
    } else {
        assert(Array.isArray(manifest.background?.scripts), "Firefox MV2 must use background scripts");
        assertIncludes(manifest.permissions, "https://example.com/*", "Firefox MV2 permissions");
        assert(!(manifest.permissions ?? []).includes("scripting"), "Firefox MV2 must not declare scripting");
    }

    inspectBundle(outputDir, manifest);
};

try {
    mkdirSync(packDir);
    cpSync(fixtureDir, consumerDir, {recursive: true});

    const packOutput = run("pnpm", ["pack", "--pack-destination", packDir, "--json"], packageDir);
    const tarballs = collectFiles(packDir).filter(file => file.endsWith(".tgz"));

    assert(tarballs.length === 1, `Expected one package tarball, found ${tarballs.length}: ${packOutput}`);

    const tarball = tarballs[0];
    const consumerPackagePath = path.join(consumerDir, "package.json");
    const consumerPackage = readJson(consumerPackagePath);

    consumerPackage.dependencies["@adnbn/plugin-reg-cs"] = `file:${tarball}`;
    writeFileSync(consumerPackagePath, `${JSON.stringify(consumerPackage, null, 2)}\n`);

    run("pnpm", ["install", "--ignore-scripts", "--no-frozen-lockfile"], consumerDir);

    const installedPackageDir = path.join(consumerDir, "node_modules/@adnbn/plugin-reg-cs");
    const installedPackageRealpath = realpathSync(installedPackageDir);
    const consumerRealpath = realpathSync(consumerDir);

    assert(
        installedPackageRealpath.startsWith(`${consumerRealpath}${path.sep}`),
        `Plugin resolved outside the isolated consumer: ${installedPackageRealpath}`
    );

    const installedPackage = readJson(path.join(installedPackageDir, "package.json"));

    assert(installedPackage.exports?.["."]?.default === "./plugin/index.ts", "Root export must keep raw TypeScript");
    assert(
        installedPackage.exports?.["./background"]?.types === "./dist-types/background.d.ts",
        "Background export must expose generated declarations"
    );
    assert(
        existsSync(path.join(installedPackageDir, "plugin/background.ts")),
        "Packed plugin is missing raw TypeScript"
    );
    assert(
        existsSync(path.join(installedPackageDir, "dist-types/background.d.ts")),
        "Packed plugin is missing declarations"
    );

    const runtimeJavaScript = collectFiles(installedPackageDir).filter(file => /\.(?:c|m)?js$/.test(file));
    assert(
        runtimeJavaScript.length === 0,
        `Packed plugin contains runtime JavaScript: ${runtimeJavaScript.join(", ")}`
    );

    buildAndInspect({browser: "chrome", manifestVersion: 3});
    buildAndInspect({browser: "firefox", manifestVersion: 2});

    console.log(`Verified packed @adnbn/plugin-reg-cs with Addon Bone 0.10.0 in Chrome MV3 and Firefox MV2 builds.`);
} finally {
    if (process.env.KEEP_SMOKE_TEMP === "1") {
        console.log(`Consumer smoke workspace kept at ${temporaryRoot}`);
    } else {
        rmSync(temporaryRoot, {recursive: true, force: true});
    }
}
