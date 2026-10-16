# Contributing to Addon Bone Plugins

## Workflow

1. Create a branch from `main`.
2. Use Node.js 24 or newer and install dependencies with `pnpm install`.
3. Make one coherent change and use a Conventional Commit message.
4. Run `pnpm verify` before opening a pull request.

The pre-commit hook safely fixes and validates staged files with ESLint. Successful fixes are returned to the Git
index before the commit is created; unrelated unstaged work remains untouched. The pre-push hook validates the commit
range and runs the same workspace verification expected by CI.

## Package contract

Plugins publish raw TypeScript plus generated declarations. Do not add compiled JavaScript, a production bundler, or a
new public export without documenting and testing the package contract.

Use PascalCase for shared named constants, such as `PluginName`, and camelCase for local bindings. ESLint rejects
UPPER_CASE `const` declarations. Keep internal constants out of public package entrypoints.

## Package documentation

Every public package README follows the same concise, developer-facing order:

1. npm package name as the title;
2. a one- or two-sentence marketing description;
3. npm version, monthly downloads, CI, and license badges using Shields.io's `for-the-badge` style;
4. the package's purpose and the problem it solves;
5. installation and a minimal working example;
6. usage, available options and API, runtime flow, guarantees, and important limitations;
7. permissions, including automatically added permissions, consumer-owned host access, and copy-ready baseline
   store justifications;
8. footer links to release history or migration notes where available, and to this monorepo for development details.

Keep the `Permissions` heading visible and put its contents in a collapsed HTML `<details>` block. This keeps the
installation, usage, and API documentation together while leaving permission details easy to find when preparing a
store submission. Use the same wrapper in every package README:

```md
## Permissions

<details>
<summary>Permission details and store justifications</summary>

Permission descriptions, consumer-owned access, and copy-ready store justifications go here.

</details>
```

Leave blank lines after `</summary>` and before `</details>` so Markdown headings and code blocks render correctly.
Document consumer-owned host access separately from permissions added by the plugin inside this section.
Place footer links after the closing `</details>` tag so they remain visible when permissions are collapsed.

Keep the first example minimal and introduce details progressively. Store justifications must describe the actual
runtime behavior and must not claim a narrower scope than the implementation. A consumer may extend the suggested host
permission justification to describe its own user-facing feature, and must extend any API-permission justification
when it uses that permission outside the package. If a package adds no permissions, state that explicitly instead of
omitting the section.

Use [`@adnbn/plugin-reg-cs`](packages/@adnbn/plugin-reg-cs/README.md) as the current package README reference. The
workspace README remains presentation-focused: what the collection is for, how plugins integrate with Addon Bone, and
a linked list of available packages. Keep implementation and release instructions in package READMEs, this guide, or
dedicated documentation.

Keep workspace-wide requirements and packaging conventions out of individual package READMEs. Document them once at
the monorepo level.

Package changes use the complete npm name as their Conventional Commit scope, for example
`fix(@adnbn/plugin-reg-cs): ...`.

Use `chore(deps)` for root tooling and lockfile-only dependency updates so they do not publish a package. If a
dependency update changes a published package manifest, its commit on `main` must instead be versionable and scoped to
that package—for example, `fix(@adnbn/plugin-reg-cs): update @addon-core/browser`. Without that scoped `fix`, `feat`,
or breaking commit, Nx correctly leaves the package version unchanged and the manifest change is not published yet.

## Development

Use Node.js 24 or newer and pnpm 11.24.0 or newer.

Keep `nx` and `@nx/js` on the same version and apply required migrations with `nx migrate`. Security overrides in
`pnpm-workspace.yaml` are scoped to upstream packages that still require vulnerable dependencies. Check their removal
conditions when updating those packages. The development-server overrides also require a local server startup and
WebSocket connection check; production consumer builds do not exercise that path. These workspace overrides do not
propagate to consumers installing the published plugins.

```sh
pnpm install
pnpm lint
pnpm check
pnpm check:consumer
pnpm check:browser
pnpm verify
pnpm release:dry-run
```

The checks cover separate boundaries:

- ESLint formats and validates source and repository conventions.
- `pnpm audit` blocks high- and critical-severity advisories in the development dependency graph.
- TypeScript checks source and tests, then emits public declarations.
- Remote-config's `typecheck` runs three programs: source, Jest tests, and isolated compiler tests in `tests/types`.
- Shared helpers under `tests/helpers` use `tests/tsconfig.json` and the root Chrome/Node types for editor support.
  `pnpm typecheck:tests` checks them directly and also runs within `pnpm typecheck`, `pnpm check`, and `pnpm verify`.
- Jest validates package behavior and repository tooling.
- The package check verifies that npm tarballs contain raw TypeScript and declarations only.
- The consumer smoke installs a fresh tarball and builds Chrome and Firefox MV3/MV2 extensions with Addon Bone.
- The browser smoke loads Chrome MV3 and Firefox MV2 builds in real browsers and verifies CSS-before-JavaScript
  execution for `plugin-reg-cs`. It also verifies remote-config API/hook access, failed refresh recovery, and Chrome
  service-worker restart persistence.

## Manual browser testing

Build both consumer fixtures locally and start the content-script test page:

```sh
pnpm build:consumer
pnpm serve:consumer
```

Open the printed `http://127.0.0.1:<port>/top.html` URL before installing the extension. Load
`tests/fixtures/plugin-reg-cs-consumer/dist/smoke-chrome-mv3` as an unpacked Chrome extension or
`tests/fixtures/plugin-reg-cs-consumer/dist/smoke-firefox-mv3/manifest.json` as a temporary Firefox add-on.
MV2 variants are available in
the corresponding `smoke-chrome-mv2` and `smoke-firefox-mv2` directories.

For every install-time test, remove the extension, reload the page while the extension is absent, and install it again.
Using the extension's Reload button does not reproduce a fresh installation. The page may remain in a background tab.
Discarded tabs use the browser's normal reload behavior; frozen Chrome MV3 tabs are queued and processed after the
browser unfreezes them.

The local server uses Node.js and needs no additional package. Press `Ctrl+C` to stop it.

`pnpm build:consumer` first emits the workspace packages' declarations, then runs Addon Bone directly inside each
fixture for Chrome/Firefox MV2/MV3. The framework generates `.adnbn` and `dist` there. TypeScript checks the fixture
after each build, including its generated declarations; `.adnbn` reflects the most recent target.

Install fixture dependencies with the root `pnpm install`. Local builds use workspace packages for development.
`pnpm check:consumer` independently installs freshly packed tarballs in temporary directories for publication
validation and does not change the local fixtures' generated files.

## Remote configuration validation

The remote-config consumer installs a freshly packed tarball and builds Chrome/Firefox MV2/MV3 with the Addon Bone
version pinned in [the fixture manifest](tests/fixtures/plugin-remote-config-consumer/package.json). Its React fixture
declares `scheduler` explicitly because the framework resolves React dependencies through consumer aliases. The
package itself only imports React in its `/react` entrypoint. Additional builds exercise the default
`REMOTE_CONFIG_URL` environment variable both when set and when missing with `remoteConfig()` and no arguments,
including the startup warning. Additional variants build partial defaults and a getter returning `undefined`.

After each build, the consumer checks the generated service registry against its augmented `RemoteConfig` interface
for both direct and proxy access. The service method's JSDoc preserves the public `import(...)` reference; removing
it causes the framework parser to inline the package's empty base interface as `{}` and lose consumer augmentation.

`pnpm check:consumer` and `pnpm check:browser` run both migrated packages. For a narrow runtime check, use
`node tools/smoke/plugin-remote-config-browser.mjs`; it starts an isolated local endpoint and disposable browser
profiles. It tests failed refreshes, recovery, deep partial responses, typed dot-path and selector access, React
selection changes without refetching, and Chrome service-worker restarts. Config responses allow HTTP caching for an
hour; the smoke checks that the default `cache: "no-store"` still reaches the server on refresh. A separate build without
defaults uses a clean profile and holds the first response until React's empty initial config and missing selections are checked.
The consumer type checks accept absent and partial defaults, reject invalid paths and wrongly typed defaults, and
preserve the augmented result types and standard `Get` behavior for optional fields, arrays, and dictionaries.

`pnpm build:consumer` writes remote-config builds under `tests/fixtures/plugin-remote-config-consumer/dist`. Set
`REMOTE_CONFIG_SMOKE_URL` to a test endpoint when creating manual builds; its default is
`http://127.0.0.1:8765/config.json`. Remote-config's automated browser check supplies its own endpoint.
The generated service registry is available at `tests/fixtures/plugin-remote-config-consumer/.adnbn/service.d.ts`.

For manual remote-config testing, run from the repository root:

```sh
pnpm build:consumer
pnpm serve:remote-config
```

The mock server uses the fixture's default endpoint, `http://127.0.0.1:8765/config.json`. Keep
`REMOTE_CONFIG_SMOKE_URL` unset when building for this server. Load
`tests/fixtures/plugin-remote-config-consumer/dist/smoke-chrome-mv3` as an unpacked Chrome extension, or load
`tests/fixtures/plugin-remote-config-consumer/dist/smoke-firefox-mv2/manifest.json` as a temporary Firefox add-on.
Open `http://127.0.0.1:8765/` and reload after installing the extension. The page offers response modes, and the
extension adds a **Read config** button, full and selected JSON results, a React label, and a **Switch selected field**
button. Switching the React field updates both its dot path and selector without making another request.

Read **Full config**, then select **HTTP 503**, **Invalid JSON**, **Array response**, or **Slow response** and read
again: the previous working configuration should remain available. **Partial config** merges only with defaults
and deeply fills missing nested fields from them; **Empty object** returns defaults. The fixture uses a 1-minute TTL, a 1-second
timeout, and a 100-ms retry delay. Reads within that minute return the cached result; after expiry, the next read
requests the selected server response. The React label is read on page mount; the button makes an explicit API
read. Stop the server with `Ctrl+C`. `pnpm serve:consumer` remains the content-script test page for `plugin-reg-cs`.

For immediate response switching, build with `REMOTE_CONFIG_SMOKE_TTL=0 pnpm build:consumer`. The automated browser
smoke sets this override itself so its failure and recovery scenarios do not wait for the manual fixture's TTL.
Use `REMOTE_CONFIG_SMOKE_DEFAULTS=none` or `partial` when building to exercise empty or partial defaults manually;
the default fixture supplies `{flag: false, label: "default", nested: {a: 1, b: 2}}`.
`REMOTE_CONFIG_SMOKE_TIMEOUT` sets the fixture's request timeout in milliseconds (default `1000`); the automated
smoke uses `10000` for the held-response scenario without defaults.

## Releases

Do not manually edit package versions, create package tags, or publish packages. Nx Release performs independent
versioning and publication after changes reach `main`.


### Independent dependency releases

`nx.json` enables `pluginsConfig.@nx/js.projectsAffectedByDependencyUpdates: "auto"`. The shared
`pnpm-lock.yaml` is deliberately absent from `namedInputs.sharedGlobals`: Nx compares resolved dependencies and
walks their consumers instead of treating every lockfile edit as a change to every plugin. Nx still hashes external
dependencies for cached targets. CI continues checking **all** plugins and both packed consumer fixtures.

Examples for a `deps` commit:

| Changed dependency | Packages receiving a patch |
| --- | --- |
| `@addon-core/inject-css` | `@adnbn/plugin-reg-cs` |
| `dot-prop` | `@adnbn/plugin-remote-config` |
| Shared `@addon-core/browser` or Chrome types | Both plugins |
| No dependency changes | None |

`deps` produces a patch and appears under **📦 Dependencies** in each affected package's changelog. Ordinary
`ci` and `chore` commits do not release packages. `fix` still produces a patch, `feat` a minor, and breaking changes
below 1.0 retain the existing minor-bump policy. An explicit breaking-change marker still takes precedence.
Actual workspace dependents remain eligible for updates through `updateDependents: "always"`.

Nx resolves changes since **each package's own latest release tag**, not simply since the last repository release.
`tools/release/check-dependency-history.mjs` runs before versioning, including dry-runs. It rejects shallow history,
missing package tags, and lockfile changes for which Nx would fall back to marking every project affected. This can
also happen when a removed dependency is absent from the current dependency graph. A failed preflight stops before
version edits, tags, GitHub releases or publication; it must be investigated rather than bypassed. Fetch full history
and tags first, then check the reported commit and lockfile. A parser/removal limitation requires a reviewed Nx fix
and a regression test before retrying. New packages need an explicit first-release setup before this tagged-release
workflow can include them.

The custom `ChangelogRenderer.cjs` supplements Nx's path-based changelog filtering with dependency commits
attributed by the same affected graph, including lockfile-only updates. It preserves Nx's normal rendering and
avoids duplicate entries for commits that also change a package manifest.

The guard and renderer use the pinned Nx version's parser and affected-project locator. Upgrade `nx` and `@nx/js` together and
run `pnpm test:release` when doing so. The suite creates disposable Git repositories, executes real Nx version and
changelog dry-runs, and checks isolated/shared dependency updates, non-release commits, missing history and tags,
malformed lockfiles, and the existing pre-1.0 breaking-change policy. It is included in `pnpm verify`.

### Automated dependency updates

The **Update Dependencies** workflow runs on Sundays at **02:15 America/Los_Angeles**. To start immediately, open
**Actions → Update Dependencies → Run workflow** on `main`. The workflow itself controls the schedule; Renovate has
no additional scheduling window that could block a manual run. Dependencies must have been published for at least
one day, consistent with the pnpm supply-chain cooldown.

Renovate reads the root manifest, every `packages/@adnbn/*/package.json`, the consumer fixture manifests and the
single pnpm workspace lockfile. It uses Node 24 and the workspace's pinned pnpm 11.24.0.

- Production dependencies of public plugins and Chrome types are grouped in `deps/update-dependencies`, with a
  `deps: ...` commit. This includes dependencies unique to a single plugin.
- Other development dependencies are handled separately with `chore(deps): ...` commits. Root tooling changes do
  not request package releases.
- Addon Bone (`adnbn`) and Rspack (`@rspack/*`) stay on their current versions. Framework/toolchain upgrades
  require a separate compatibility review and are excluded from automatic updates in every workspace manifest.
- Nx and its plugins require manual coordinated upgrades and migrations. Peer ranges, workspace references,
  package-manager versions and existing security overrides are also maintained manually.
- Renovate updates the lockfile with the manifests, rebases an open branch when it falls behind `main`, and creates
  no PR if there are no eligible updates. Automatic merging and standalone lockfile maintenance are disabled.

Every PR must pass `verify`, including frozen-lockfile installation, lint, tooling and release regression tests,
security audit, package tests/type checks, tarball checks, packed consumer builds, browser smoke tests, workflow
lint and Renovate config validation. CI also previews release versions with write operations disabled. Failed
checks leave the PR open for investigation; they do not merge or publish anything.

After reviewing and merging a dependency PR, start **Actions → Release → Run workflow** on `main` manually. The
release pipeline computes each affected version, creates its changelog/tag/GitHub release and publishes through the
existing release App and npm OIDC setup. The Renovate App does not publish packages.

### GitHub setup for Renovate

Reuse the organization's **addon-stack-dependency-updates** GitHub App:

1. Add `addon-stack/addon-bone-plugins` to the installation's selected repositories. Keep repository permissions
   **Contents: read/write**, **Pull requests: read/write**, **Issues: read/write**, **Checks: read**,
   **Commit statuses: read**, and GitHub's mandatory **Metadata: read**.
2. Grant this repository access to the organization Actions variable `RENOVATE_APP_CLIENT_ID` (or create it at
   repository scope), using the existing App's client ID.
3. Grant it access to the organization Actions secret `RENOVATE_APP_PRIVATE_KEY`, or store the same App's private
   key as a repository Actions secret. Never commit the key. No new App or private key is necessary.
4. Require the **verify** status check for PR merges into `main`. Keep the existing release App's ruleset/bypass
   access so its automated release commit can be pushed. This is separate from Renovate permissions.
5. Once this configuration reaches `main`, run **Update Dependencies** manually and review its logs and any PR.

The App token is scoped to this repository even when the shared App is installed in several repositories. The
workflow checks for missing credentials before starting Renovate. `RELEASE_APP_ID`, `RELEASE_APP_PRIVATE_KEY`, the
`release` environment and Trusted Publishing settings remain the existing manual release workflow's credentials.


### Security audit status (2026-10-14)

The compatible security refresh updates Nx and `@nx/js` together from 23.2.1 to 23.3.0 (the Nx migrator reports no
required migrations), plus the vulnerable transitive `brace-expansion`, `compression`, `engine.io`, `proxy-addr`,
`shell-quote`, `source-map-js`, `fast-uri` and their compatible parents. `fast-uri` is locked to 3.1.8, which satisfies
Ajv's `^3.0.1` range; its registry integrity and the complete lockfile were verified by `pnpm install --frozen-lockfile`.
No peer ranges, public plugin versions or existing overrides were changed, and no new overrides were added.

Audit findings decreased from **2 critical / 19 high / 11 moderate** to **0 critical / 3 high / 6 moderate / 3 low**.
The remaining findings are in development/release tooling:

- Nx 23.3.0 pins `undici` to exactly 7.29.0; its advisories are fixed in 7.29.1, which requires an upstream Nx update
  or an explicit override. The high advisories are
  [GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5) and
  [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3).
- `braces` 3.0.3, used through the framework's development server/build tooling, has no published fixed version for
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- `sprintf-js` 1.0.3, through Jest's coverage configuration loader, has no published fixed version for the moderate
  [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

`pnpm audit:security` and therefore `pnpm verify`, CI and the manual release workflow **remain blocked** by the
three high findings. The audit threshold has not been lowered and advisories have not been suppressed. Resolve
these upstream constraints before expecting a green CI/release; functional test success does not waive the audit.
