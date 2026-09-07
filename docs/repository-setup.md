# Repository setup

The files in this repository define the local and GitHub Actions side of the monorepo. The following one-time remote
settings must be completed by a repository or npm administrator before the first release.

## Initial Git push

Push `main` together with the imported package tags. Do not recreate or rename the scoped tags after publication.

```sh
git push origin main
git push origin --tags
```

The source repository should remain available read-only until the imported history, npm package links, and first
monorepo release have been checked from GitHub.

## Branch policy

Protect `main` with pull requests and require the single aggregate status check named `verify`. That job depends on
workflow lint and the Node.js 24 verification job, so the required-check name remains stable if the runtime baseline is
changed later. The workflow also handles GitHub merge queues through the `merge_group` event.

Recommended policy:

- require at least one approving review and CODEOWNERS review;
- dismiss stale approvals and require resolved conversations;
- require the branch to be current before merge;
- require `verify` and block force pushes/deletions;
- allow only the release GitHub App to write release commits and tags to `main`.

## Release GitHub App

Install a GitHub App only on `addon-stack/addon-bone-plugins` and grant it repository Contents read/write permission.
Configure:

- repository variable `RELEASE_APP_ID` with the App ID;
- repository secret `RELEASE_APP_PRIVATE_KEY` with the App private key;
- GitHub environment `release`, restricted to `main` and protected with the desired reviewer policy.

The workflow requests a repository-scoped, one-hour installation token and uses it only for checkout, the Nx release
commit, tags, GitHub Releases, and their push.

## npm trusted publishing

Configure a trusted publisher for each migrated npm package (`@adnbn/plugin-reg-cs` and
`@adnbn/plugin-remote-config`) with:

- organization/repository: `addon-stack/addon-bone-plugins`;
- workflow filename: `release.yml`;
- GitHub environment: `release`;
- allowed action: `npm publish`.

No long-lived npm token belongs in GitHub. The release job grants `id-token: write`, verifies npm 11.5.1 or newer, and
publishes with provenance enabled.

## First remote proof

After CI passes on `main`, run the Release workflow manually. Before migrating another plugin, verify all of the
following from the remote systems:

- the App created and pushed the release commit and scoped tag;
- the GitHub Release was created from the same tag;
- npm shows the expected version, raw TypeScript files, declarations, and provenance;
- a clean external Addon Bone project can install the published version and build Chrome and Firefox MV3/MV2.

Local tests and dry-runs do not prove GitHub App permissions, branch rules, npm OIDC, or registry publication.

## Importing another history

Preserve the history-import merge when integrating a migration into `main`. Include scoped imported tags in the
separately authorized push; local import refs do not need publication. `tools/commits/check.mjs` validates new
commits and exempts only exact rewritten SHAs listed in the reviewed migration commit maps. Historical messages
retain their original scopes. Commit messages created in this repository remain subject to the current rules.

Before releasing remote-config from this repository, verify that its npm trusted publisher targets this repository,
`release.yml`, and the `release` environment. Keep the existing source repository available for historical GitHub
metadata. A local dry-run does not prove registry authentication or publication.
