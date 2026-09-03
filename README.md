# Addon Bone Plugins

Addon Bone Plugins is the pnpm and Nx monorepo for public plugins maintained for the
[Addon Bone](https://addonbone.com) browser-extension framework.

The migration is intentionally incremental. The current pilot contains one package:

```text
packages/
└── @adnbn/
    └── plugin-reg-cs    # registers content scripts in already-open tabs after installation
```

Other plugins are added only after the pilot package has passed its package, consumer-build, CI, and release gates.

## Packaging contract

Plugin implementations are published as raw TypeScript. Addon Bone owns production transpilation and bundling when a
consumer extension is built.

- Runtime exports point to `plugin/*.ts`.
- Type exports point to generated `dist-types/*.d.ts`.
- The only package generation step is TypeScript declaration emission.
- Published tarballs must not contain compiled JavaScript.
- Do not add Vite, Vitest, Rsbuild, Rspack, Rslib, Rollup, tsup, esbuild, or another package-level production bundler
  without an explicit architecture decision that changes this contract.

Unit tests use Jest in the Node environment. Its SWC transform is test-only, runs in memory, and produces no published
package artifact. Addon Bone's Rspack pipeline remains the only production compiler.

Browser-facing tests use `@addon-core/browser/testing` with the real browser wrappers and injection packages. The
harness supplies manifest/tab fixtures, granted permissions, install events, native API results, and failures; it does
not execute content scripts or apply CSS in a document. Only Addon Bone's build-time boundary is mocked. Real-browser
smoke tests remain a separate check, and the testing entrypoint is never imported by the published implementation.

## Development

Requirements: Node.js 24 or newer and pnpm 11.24.0 or newer.

```sh
pnpm install
pnpm lint
pnpm check
pnpm check:consumer
pnpm check:browser
pnpm verify
pnpm release:dry-run
```

The verification layers are deliberately separate:

- ESLint and Prettier validate source and repository conventions.
- pnpm audit blocks high- and critical-severity advisories in the complete development dependency graph.
- TypeScript checks source/tests and emits public declarations.
- Jest validates package behavior in a Node test environment.
- The pack contract verifies that the npm tarball contains raw TypeScript and declarations only.
- The consumer smoke installs the real tarball into an isolated Addon Bone project and performs cold Chrome MV3 and
  Firefox MV2 builds.
- The browser smoke installs those builds after a top-level page and child frame have loaded, then verifies CSS-before-JS
  execution in Chrome MV3 and Firefox MV2. The Chrome scenario leaves the test page in a background tab during installation.
  CI runs this separately from `pnpm verify` on Node.js 24.

## Manual browser testing

Build the existing consumer fixture, then start its local test page:

```sh
pnpm build:consumer
pnpm serve:consumer
```

`serve:consumer` prints a URL such as `http://127.0.0.1:<port>/top.html`. Open that URL before installing the
extension. The page includes a child iframe; the server listens only on `127.0.0.1` and chooses an available port.
Leave the command running during testing and press `Ctrl+C` to stop it. It uses Node.js's built-in HTTP server, so
no additional server packages are required. This command does not rebuild or install the extension.

The ready-to-load extension builds are inside this repository:

- Chrome: load the `output/plugin-reg-cs/smoke-chrome-mv3` directory as an unpacked extension.
- Firefox: load `output/plugin-reg-cs/smoke-firefox-mv2/manifest.json` as a temporary add-on.

This command still installs a freshly packed plugin in an isolated temporary consumer. Only after both builds pass
validation does it copy their extension bundles into `output/plugin-reg-cs`. Each successful run replaces those two
generated build directories. Dependencies and temporary consumer files are not copied. `output/` is excluded from
Git, ESLint, and Prettier; it is not part of the published plugin.

The CI commands (`pnpm verify` and `pnpm check:browser`) keep using temporary directories and do not create or update
the manual output. The browser smoke starts and stops the same HTTP server automatically; CI does not run the
long-lived `serve:consumer` command. `KEEP_SMOKE_TEMP=1` remains available when debugging the complete isolated consumer.

The fixture matches only `http://127.0.0.1/*`, including any port. Open a fully loaded local test page before installation;
it may remain in a background tab while you install the extension from the extensions page in the same window.
Discarded and frozen tabs are skipped without being woken up. For each install-time test, remove the test extension,
reload the page while the extension is absent, and then install the extension again instead of using its Reload button.
This clears markers left by previous runs. In the page console, `document.documentElement.dataset.adnbnPluginRegCsRuns`
should be `"1"` and `document.documentElement.dataset.adnbnPluginRegCsCss` should be `"ready"`.

## Commits and releases

Use Conventional Commits. Package-scoped changes use the full npm project name, for example:

```text
fix(@adnbn/plugin-reg-cs): handle a newly granted host permission
```

Nx Release owns versions, package tags, changelogs, GitHub Releases, and npm publication. Package tags follow
`{projectName}@{version}`; the imported `@adnbn/plugin-reg-cs@0.5.1` tag is the current release baseline.
Scoped `fix` commits produce patches, scoped `feat` commits produce minors, and breaking changes below `1.0.0` also
produce a minor instead of jumping directly to `1.0.0`.

The release workflow is manual and main-only. It uses a repository-scoped GitHub App for Git writes and npm Trusted
Publishing/OIDC for publication with provenance.

See [Repository setup](docs/repository-setup.md) for the one-time branch-policy, GitHub App, release-environment, npm
Trusted Publishing, and initial-push checklist. A release dry-run previews GitHub Release creation and therefore needs
GitHub CLI authentication, but it does not write versions, tags, releases, or packages.

## Migrated history

`@adnbn/plugin-reg-cs` was imported with its complete reachable history: 73 commits and 11 annotated release tags.
Historical paths were rewritten under `packages/@adnbn/plugin-reg-cs`; audit maps are stored in
`docs/migrations/plugin-reg-cs/`.
