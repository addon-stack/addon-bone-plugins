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
const packageDir = path.join(repoRoot, "packages/@adnbn/plugin-remote-config");
const fixtureDir = path.join(repoRoot, "tests/fixtures/plugin-remote-config-consumer");
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "plugin-remote-config-consumer-"));
const packDir = path.join(temporaryRoot, "pack");
const consumerDir = path.join(temporaryRoot, "consumer");
const storeDir = path.join(repoRoot, ".pnpm-store");
const ignoredFixtureEntries = new Set([".adnbn", "dist", "node_modules", "pnpm-lock.yaml"]);
const smokeUrl = process.env.REMOTE_CONFIG_SMOKE_URL ?? "http://127.0.0.1:8765/config.json";
const missingEnvWarning = 'Environment variable "REMOTE_CONFIG_URL" is unset or empty';

const run = (command, args, cwd, env = {}) => {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        env: {...process.env, CI: "true", ...env},
        stdio: "pipe",
    });

    if (result.status !== 0) {
        process.stderr.write(result.stdout ?? "");
        process.stderr.write(result.stderr ?? "");
        throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
    }

    return `${result.stdout ?? ""}${result.stderr ?? ""}`;
};

const readJson = file => JSON.parse(readFileSync(file, "utf8"));

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
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

const shouldCopyFixtureEntry = source => {
    const [topLevelEntry] = path.relative(fixtureDir, source).split(path.sep);

    return !ignoredFixtureEntries.has(topLevelEntry);
};

const buildAndInspect = ({browser, manifestVersion, configUrl = smokeUrl, env = {}}) => {
    const args = ["node_modules/adnbn/bin/adnbn.js", "build", ".", "-a", "smoke", "-b", browser];

    if (manifestVersion === 2) {
        args.push("--mv2");
    }

    const output = run("node", args, consumerDir, env);
    run("pnpm", ["exec", "tsc", "--noEmit"], consumerDir);
    const outputDir = path.join(consumerDir, `dist/smoke-${browser}-mv${manifestVersion}`);
    const manifest = readJson(path.join(outputDir, "manifest.json"));
    assert(manifest.manifest_version === manifestVersion, "Incorrect manifest version");
    assertIncludes(manifest.permissions, "storage", "Remote config service permissions");
    const origins = manifestVersion === 3 ? manifest.host_permissions : manifest.permissions;

    if (configUrl) {
        const parsed = new URL(configUrl);
        assertIncludes(origins, `${parsed.protocol}//${parsed.hostname}/*`, "Config endpoint access");
        assert(!output.includes(missingEnvWarning), "A resolved endpoint must not produce a missing-env warning");
    } else {
        assert(
            !(origins ?? []).some(origin => origin.includes("://") && origin !== "http://127.0.0.1/*"),
            `Disabled endpoint added access beyond the fixture's content-script host: ${JSON.stringify(origins)}`
        );

        assert(output.split(missingEnvWarning).length === 2, "Expected one missing-env warning during startup");
    }

    for (const permission of ["tabs", "scripting", "unlimitedStorage", "cookies", "alarms", "<all_urls>"]) {
        assert(!(manifest.permissions ?? []).includes(permission), `Unexpected permission: ${permission}`);
        assert(!(manifest.host_permissions ?? []).includes(permission), `Unexpected host access: ${permission}`);
    }

    const backgroundFiles = [manifest.background?.service_worker, ...(manifest.background?.scripts ?? [])]
        .filter(Boolean);

    assert(backgroundFiles.length > 0, `${browser} MV${manifestVersion} must include the service`);
    const background = backgroundFiles.map(file => readFileSync(path.join(outputDir, file), "utf8")).join("\n");
    assert(background.includes("Remote config response must be a JSON object"), "Service runtime is missing");
    assert(!background.includes("__REMOTE_CONFIG_OPTIONS__"), "Build-time options were not replaced");

    if (configUrl) {
        assert(background.includes(configUrl), "Resolved URL is missing from the runtime options");
    }

    if (process.argv.includes("--keep-output")) {
        const declarationsDir = path.join(repoRoot, "output/plugin-remote-config/types");
        mkdirSync(declarationsDir, {recursive: true});
        const destination = path.join(declarationsDir, `${browser}-mv${manifestVersion}.d.ts`);
        cpSync(path.join(consumerDir, ".adnbn/service.d.ts"), destination);
        console.log(`Generated service declaration: ${destination}`);
    }

    return outputDir;
};

try {
    mkdirSync(packDir);
    cpSync(fixtureDir, consumerDir, {filter: shouldCopyFixtureEntry, recursive: true});

    const packOutput = run("pnpm", ["pack", "--pack-destination", packDir, "--json"], packageDir);
    const tarballs = collectFiles(packDir).filter(file => file.endsWith(".tgz"));

    assert(tarballs.length === 1, `Expected one package tarball, found ${tarballs.length}: ${packOutput}`);

    const tarball = tarballs[0];
    const consumerPackagePath = path.join(consumerDir, "package.json");
    const consumerPackage = readJson(consumerPackagePath);

    consumerPackage.dependencies["@adnbn/plugin-remote-config"] = `file:${tarball}`;
    writeFileSync(consumerPackagePath, `${JSON.stringify(consumerPackage, null, 2)}\n`);

    run("pnpm", ["install", "--ignore-scripts", "--no-frozen-lockfile", "--store-dir", storeDir], consumerDir);

    const installedPackageDir = path.join(consumerDir, "node_modules/@adnbn/plugin-remote-config");
    const installedPackageRealpath = realpathSync(installedPackageDir);
    const consumerRealpath = realpathSync(consumerDir);

    assert(
        installedPackageRealpath.startsWith(`${consumerRealpath}${path.sep}`),
        `Plugin resolved outside the isolated consumer: ${installedPackageRealpath}`
    );

    const installedPackage = readJson(path.join(installedPackageDir, "package.json"));

    assert(
        Object.keys(installedPackage.exports).join(",") === ".,./api,./hooks,./service",
        "Public export contract changed"
    );

    for (const entry of Object.values(installedPackage.exports)) {
        assert(entry.default.endsWith(".ts"), "Runtime exports must keep raw TypeScript");
        assert(entry.types.endsWith(".d.ts"), "Type exports must reference declarations");
        assert(existsSync(path.join(installedPackageDir, entry.default)), "Missing raw TypeScript export");
        assert(existsSync(path.join(installedPackageDir, entry.types)), "Missing declaration export");
    }

    const runtimeJavaScript = collectFiles(installedPackageDir).filter(file => /\.(?:c|m)?js$/.test(file));

    assert(
        runtimeJavaScript.length === 0,
        `Packed plugin contains runtime JavaScript: ${runtimeJavaScript.join(", ")}`
    );

    const configPath = path.join(consumerDir, "adnbn.config.ts");
    const originalConfig = readFileSync(configPath, "utf8");

    try {
        writeFileSync(configPath, `import {defineConfig} from "adnbn";
import remoteConfig from "@adnbn/plugin-remote-config";

export default defineConfig({
    name: "Remote Config Environment Smoke",
    description: "Validates build-time environment resolution.",
    version: "1.0.0",
    plugins: [remoteConfig()],
});
`);

        const configUrl = "https://remote-config-env.example/config.json";
        buildAndInspect({browser: "chrome", manifestVersion: 3, configUrl, env: {REMOTE_CONFIG_URL: configUrl}});
        buildAndInspect({browser: "chrome", manifestVersion: 3, configUrl: null, env: {REMOTE_CONFIG_URL: undefined}});
    } finally {
        writeFileSync(configPath, originalConfig);
    }

    const buildDirectories = [
        buildAndInspect({browser: "chrome", manifestVersion: 3}),
        buildAndInspect({browser: "chrome", manifestVersion: 2}),
        buildAndInspect({browser: "firefox", manifestVersion: 3}),
        buildAndInspect({browser: "firefox", manifestVersion: 2}),
    ];

    const frameworkVersion = readJson(path.join(consumerDir, "node_modules/adnbn/package.json")).version;

    console.log(
        "Verified packed @adnbn/plugin-remote-config builds and generated service types " +
        `with Addon Bone ${frameworkVersion} in Chrome and Firefox MV3/MV2, ` +
        "including resolved and missing environment variables."
    );

    if (process.argv.includes("--keep-output")) {
        for (const buildDirectory of buildDirectories) {
            const destination = path.join(repoRoot, "output/plugin-remote-config", path.basename(buildDirectory));

            rmSync(destination, {recursive: true, force: true});
            cpSync(buildDirectory, destination, {recursive: true});
            console.log(`Manual extension build: ${destination}`);
        }
    }
} finally {
    if (process.env.KEEP_SMOKE_TEMP === "1") {
        console.log(`Consumer smoke workspace kept at ${temporaryRoot}`);
    } else {
        rmSync(temporaryRoot, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
    }
}
