import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const [kind, ...args] = process.argv.slice(2);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

if (!["consumer", "browser"].includes(kind)) {
    throw new Error("Usage: node tools/smoke/run.mjs <consumer|browser> [--keep-output]");
}

for (const name of ["plugin-reg-cs", "plugin-remote-config"]) {
    const result = spawnSync(process.execPath, [path.join(repoRoot, `tools/smoke/${name}-${kind}.mjs`), ...args], {
        cwd: repoRoot,
        env: process.env,
        stdio: "inherit",
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
