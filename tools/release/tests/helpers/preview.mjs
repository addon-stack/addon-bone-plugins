import {writeFileSync} from "node:fs";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const {ReleaseClient} = require("nx/release");

const client = new ReleaseClient({
    changelog: {projectChangelogs: {createRelease: false, renderOptions: {applyUsernameToAuthors: false}}},
    git: {commit: false, tag: false, push: false},
});

const gitOptions = {gitCommit: false, gitTag: false, gitPush: false, stageChanges: false};
const result = await client.releaseVersion({dryRun: true, verbose: true, ...gitOptions});

const changelog = await client.releaseChangelog({
    dryRun: true,
    ...gitOptions,
    versionData: result.projectsVersionData,
    releaseGraph: result.releaseGraph,
    createRelease: false,
    interactive: false,
});

writeFileSync(process.argv[2], JSON.stringify({versions: result.projectsVersionData, changelog}));
