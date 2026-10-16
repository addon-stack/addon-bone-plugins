import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const require = createRequire(import.meta.url);
// These adapters deliberately use the pinned Nx version's own parsing and fallback behavior.
// Run the release regression suite when upgrading nx and @nx/js together.
const {createProjectGraphAsync} = require("nx/src/project-graph/project-graph");
const {calculateFileChanges} = require("nx/src/project-graph/file-utils");
const {findMatchingProjects} = require("nx/src/utils/find-matching-projects");
const {getTouchedProjectsFromLockFile} = require("nx/src/plugins/js/project-graph/affected/lock-file-changes");
const {getGitDiff, getLatestGitTagForPattern, parseCommits} = require("nx/src/command-line/release/utils/git");
const {RepoGitTags} = require("nx/src/command-line/release/utils/repository-git-tags");

const {DEFAULT_CONVENTIONAL_COMMITS_CONFIG: DefaultCommits} =
    require("nx/src/command-line/release/config/conventional-commits");

export function assertPreciseLockfileChanges(changes, graph, nxJson, packageJson, label) {
    const touched = getTouchedProjectsFromLockFile(changes, graph.nodes, nxJson, packageJson, graph);

    // Successful auto analysis returns external npm node names. Workspace project names
    // indicate Nx's conservative fallback to every project, which must never drive a release.
    if (touched.some(name => Object.hasOwn(graph.nodes, name))) {
        throw new Error(
            `Cannot safely attribute dependency changes in ${label}. Nx would affect every project. ` +
            "Check full Git history, lockfile parsing and removed dependencies before releasing."
        );
    }
}

export async function checkDependencyHistory() {
    const nxJson = JSON.parse(readFileSync("nx.json", "utf8"));
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    if (nxJson.pluginsConfig?.["@nx/js"]?.projectsAffectedByDependencyUpdates !== "auto") {
        throw new Error("Independent dependency releases require Nx dependency analysis in auto mode.");
    }

    if (execFileSync("git", ["rev-parse", "--is-shallow-repository"], {encoding: "utf8"}).trim() !== "false") {
        throw new Error("Release analysis requires full Git history and package tags; fetch-depth must be 0.");
    }

    const graph = await createProjectGraphAsync();
    const projects = findMatchingProjects(nxJson.release.projects, graph.nodes);
    const tags = RepoGitTags.create();
    const checked = new Set();
    const types = {...DefaultCommits.types, ...nxJson.release.conventionalCommits.types};

    for (const name of projects) {
        const latest = await getLatestGitTagForPattern(
            nxJson.release.releaseTag.pattern,
            {projectName: name},
            tags.resolveTags.bind(tags),
            {requireSemver: true, strictPreid: true, checkAllBranchesWhen: false}
        );

        if (!latest) {
            throw new Error(`Missing release tag for ${name}. Fetch package tags before releasing.`);
        }

        const commits = parseCommits(await getGitDiff(latest.tag));

        for (const commit of commits) {
            const bump = types[commit.type]?.semverBump;

            if (checked.has(commit.shortHash) || (!commit.isBreaking && (!bump || bump === "none"))) {
                continue;
            }

            checked.add(commit.shortHash);

            const changes = calculateFileChanges(commit.affectedFiles, {
                base: `${commit.shortHash}^`,
                head: commit.shortHash,
            });

            assertPreciseLockfileChanges(changes, graph, nxJson, packageJson, commit.shortHash);
        }
    }

    console.log(`Dependency history checked for ${projects.length} independently released packages.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await checkDependencyHistory();
}
