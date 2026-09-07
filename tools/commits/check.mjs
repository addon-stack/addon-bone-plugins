import {spawnSync} from "node:child_process";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const run = (command, args, input) => {
    const result = spawnSync(command, args, {cwd: repoRoot, encoding: "utf8", input});

    if (result.status !== 0) {
        process.stderr.write(result.stdout ?? "");
        process.stderr.write(result.stderr ?? "");
        process.exit(result.status ?? 1);
    }

    return result.stdout.trim();
};

const imported = new Set();
const migrationRoot = path.join(repoRoot, "docs/migrations");

for (const entry of readdirSync(migrationRoot, {withFileTypes: true})) {
    if (!entry.isDirectory()) {
        continue;
    }

    const map = readFileSync(path.join(migrationRoot, entry.name, "commit-map.txt"), "utf8");

    for (const line of map.trim().split("\n").slice(1)) {
        const [original, rewritten] = line.trim().split(/\s+/);

        if (!/^[a-f0-9]{40}$/.test(original) || !/^[a-f0-9]{40}$/.test(rewritten)) {
            throw new Error(`Invalid commit map entry in ${entry.name}: ${line}`);
        }

        imported.add(rewritten);
    }
}

const [from, to = "HEAD"] = process.argv.slice(2);

if (!from) {
    throw new Error("Usage: node tools/commits/check.mjs <base> [head]");
}

// Resolve refs before constructing the revision range; arguments cannot become Git options.
const base = run("git", ["rev-parse", "--verify", "--end-of-options", `${from}^{commit}`]);
const head = run("git", ["rev-parse", "--verify", "--end-of-options", `${to}^{commit}`]);
const commits = run("git", ["rev-list", `${base}..${head}`]).split("\n").filter(Boolean);
let checked = 0;

for (const commit of commits) {
    if (imported.has(commit)) {
        continue;
    }

    const message = run("git", ["show", "--no-patch", "--format=%B", commit]);
    run("pnpm", ["exec", "commitlint", "--verbose"], `${message}\n`);
    checked++;
}

console.log(`Validated ${checked} new commits; preserved ${commits.length - checked} mapped historical commits.`);
