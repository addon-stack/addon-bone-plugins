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

## Package documentation

Every public package README follows the same concise, developer-facing order:

1. npm package name as the title;
2. a one- or two-sentence marketing description;
3. npm version, monthly downloads, CI, and license badges using Shields.io's `for-the-badge` style;
4. the package's purpose and the problem it solves;
5. installation and a minimal working example;
6. permissions added by the package, why each permission is required, and copy-ready baseline store justifications;
7. host permissions required from the consumer, documented separately from permissions added by the package;
8. a short explanation of the runtime flow, guarantees, and important limitations;
9. a link back to this monorepo for development details.

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
package itself only imports React in its hooks entrypoint. Additional builds exercise the default
`REMOTE_CONFIG_URL` environment variable both when set and when missing, including the startup warning.

After each build, the consumer checks the generated service registry against its augmented `RemoteConfig` interface
for both direct and proxy access. The service method's JSDoc preserves the public `import(...)` reference; removing
it causes the framework parser to inline the package's empty base interface as `{}` and lose consumer augmentation.

`pnpm check:consumer` and `pnpm check:browser` run both migrated packages. For a narrow runtime check, use
`node tools/smoke/plugin-remote-config-browser.mjs`; it starts an isolated local endpoint and disposable browser
profiles. It tests failed refreshes, recovery, partial responses, the React hook, and Chrome service-worker restarts.

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
extension adds a **Read config** button, a JSON result, and a React label.

Read **Full config**, then select **HTTP 503**, **Invalid JSON**, **Array response**, or **Slow response** and read
again: the previous working configuration should remain available. **Partial config** merges only with defaults
and replaces the nested object; **Empty object** returns defaults. The fixture uses a 1-minute TTL, a 1-second
timeout, and a 100-ms retry delay. Reads within that minute return the cached result; after expiry, the next read
requests the selected server response. The React label is read on page mount; the button makes an explicit API
read. Stop the server with `Ctrl+C`. `pnpm serve:consumer` remains the content-script test page for `plugin-reg-cs`.

For immediate response switching, build with `REMOTE_CONFIG_SMOKE_TTL=0 pnpm build:consumer`. The automated browser
smoke sets this override itself so its failure and recovery scenarios do not wait for the manual fixture's TTL.

## Releases

Do not manually edit package versions, create package tags, or publish packages. Nx Release performs independent
versioning and publication after changes reach `main`.
