import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const run = (command, args, cwd) => {
    const result = spawnSync(command, args, {cwd, stdio: "inherit", env: process.env});

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
};

for (const name of ["plugin-reg-cs", "plugin-remote-config"]) {
    const fixtureDir = path.join(repoRoot, `tests/fixtures/${name}-consumer`);

    for (const browser of ["chrome", "firefox"]) {
        for (const manifestVersion of [3, 2]) {
            const args = ["node_modules/adnbn/bin/adnbn.js", "build", ".", "-a", "smoke", "-b", browser];

            if (manifestVersion === 2) {
                args.push("--mv2");
            }

            run(process.execPath, args, fixtureDir);
            run("pnpm", ["exec", "tsc", "--noEmit"], fixtureDir);
            const outputDir = path.join(fixtureDir, `dist/smoke-${browser}-mv${manifestVersion}`);
            console.log(`Local extension build: ${outputDir}`);
        }
    }

    console.log(`Generated fixture configuration: ${path.join(fixtureDir, ".adnbn")}`);
}
