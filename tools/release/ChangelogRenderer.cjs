const DefaultChangelogRenderer = require("nx/release/changelog-renderer").default;
const {readNxJson} = require("nx/src/config/nx-json");
const {createProjectGraphAsync} = require("nx/src/project-graph/project-graph");
const {calculateFileChanges} = require("nx/src/project-graph/file-utils");
const {filterAffected} = require("nx/src/project-graph/affected/affected-project-graph");
const {getGitDiff, getLatestGitTagForPattern, parseCommits} = require("nx/src/command-line/release/utils/git");
const {RepoGitTags} = require("nx/src/command-line/release/utils/repository-git-tags");
const {mapCommitToChange} = require("nx/src/command-line/release/changelog/commit-utils");

// Nx 23 filters project changelogs by paths, whereas versioning also follows lockfile dependencies.
// Retain Nx's renderer and add only missing dependency commits attributed by the same affected graph.
class ChangelogRenderer extends DefaultChangelogRenderer {
    async render() {
        if (this.project && !this.isVersionPlans) {
            const nxJson = readNxJson();
            const tags = RepoGitTags.create();

            const latest = await getLatestGitTagForPattern(
                nxJson.release.releaseTag.pattern,
                {projectName: this.project},
                tags.resolveTags.bind(tags),
                {requireSemver: true, strictPreid: true, checkAllBranchesWhen: false}
            );

            if (!latest) {
                throw new Error(`Missing release tag for ${this.project}.`);
            }

            const graph = await createProjectGraphAsync();
            const known = new Set(this.changes.map(change => change.shortHash));
            const commits = parseCommits(await getGitDiff(latest.tag));

            for (const commit of commits) {
                if (commit.type !== "deps" || known.has(commit.shortHash)) {
                    continue;
                }

                const changes = calculateFileChanges(commit.affectedFiles, {
                    base: `${commit.shortHash}^`, head: commit.shortHash,
                });

                const affected = await filterAffected(graph, changes, nxJson, undefined, false);

                if (affected.nodes[this.project]) {
                    this.changes.push(mapCommitToChange(commit, [this.project]));
                }
            }
        }

        return super.render();
    }
}

module.exports = ChangelogRenderer;
