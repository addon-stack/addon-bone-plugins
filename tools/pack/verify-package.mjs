import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";

const packageDir = path.resolve(process.argv[2] ?? process.cwd());
const packageJsonPath = path.join(packageDir, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const pack = spawnSync("pnpm", ["pack", "--dry-run", "--json"], {
    cwd: packageDir,
    encoding: "utf8",
    env: process.env,
});

if (pack.status !== 0) {
    process.stderr.write(pack.stdout);
    process.stderr.write(pack.stderr);
    process.exit(pack.status ?? 1);
}

const parsePackOutput = output => {
    const candidateStarts = [];

    for (let index = 0; index < output.length; index++) {
        if ((output[index] === "[" || output[index] === "{") && (index === 0 || output[index - 1] === "\n")) {
            candidateStarts.push(index);
        }
    }

    for (const start of candidateStarts.reverse()) {
        try {
            return JSON.parse(output.slice(start));
        } catch {
            // Lifecycle output may precede the final JSON payload.
        }
    }

    throw new Error(`Unable to parse pnpm pack JSON output:\n${output}`);
};

const packResult = parsePackOutput(pack.stdout.trim());
const metadata = Array.isArray(packResult) ? packResult[0] : packResult;
const files = new Set((metadata.files ?? []).map(file => file.path.replace(/^package\//, "").replace(/^\.\//, "")));

const requiredFiles = [
    "LICENSE.md",
    "README.md",
    "dist-types/background.d.ts",
    "dist-types/background.d.ts.map",
    "dist-types/index.d.ts",
    "dist-types/index.d.ts.map",
    "package.json",
    "plugin/background.ts",
    "plugin/index.ts",
];

const missingFiles = requiredFiles.filter(file => !files.has(file));

if (missingFiles.length > 0) {
    throw new Error(`Packed package is missing required files: ${missingFiles.join(", ")}`);
}

const rawTypeScriptFiles = [...files].filter(file => file.startsWith("plugin/") && file.endsWith(".ts"));
const missingDeclarations = rawTypeScriptFiles.flatMap(file => {
    const declaration = file.replace(/^plugin\//, "dist-types/").replace(/\.ts$/, ".d.ts");
    const declarationMap = `${declaration}.map`;

    return [declaration, declarationMap].filter(expected => !files.has(expected));
});

if (missingDeclarations.length > 0) {
    throw new Error(`Packed package is missing declarations for raw TypeScript: ${missingDeclarations.join(", ")}`);
}

const forbiddenFiles = [...files].filter(
    file =>
        file.endsWith(".js") ||
        file.endsWith(".cjs") ||
        file.endsWith(".mjs") ||
        file.startsWith("tests/") ||
        file.includes("node_modules/") ||
        file.includes("rstest") ||
        file.includes("tsconfig")
);

if (forbiddenFiles.length > 0) {
    throw new Error(`Packed package contains forbidden files: ${forbiddenFiles.join(", ")}`);
}

const exportsEntries = Object.values(packageJson.exports ?? {});

for (const entry of exportsEntries) {
    if (!entry.default?.endsWith(".ts")) {
        throw new Error(`Runtime export must reference raw TypeScript: ${JSON.stringify(entry)}`);
    }

    if (!entry.types?.endsWith(".d.ts")) {
        throw new Error(`Type export must reference a declaration file: ${JSON.stringify(entry)}`);
    }
}

const forbiddenTooling = ["vite", "vitest", "@rsbuild/core", "@rspack/cli", "@rslib/core", "tsup", "rollup", "esbuild"];
const dependencyGroups = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.optionalDependencies,
    packageJson.peerDependencies,
];
const declaredDependencies = new Set(dependencyGroups.flatMap(group => Object.keys(group ?? {})));
const forbiddenDependencies = forbiddenTooling.filter(dependency => declaredDependencies.has(dependency));

if (forbiddenDependencies.length > 0) {
    throw new Error(`Package declares forbidden build tooling: ${forbiddenDependencies.join(", ")}`);
}

if (packageJson.peerDependencies?.["@rspack/core"] && packageJson.dependencies?.["@rspack/core"]) {
    throw new Error("@rspack/core must remain a config-time peer and must not become a package runtime dependency");
}

console.log(
    `Verified ${packageJson.name}@${packageJson.version}: ${files.size} packed files, raw TypeScript + declarations only.`
);
