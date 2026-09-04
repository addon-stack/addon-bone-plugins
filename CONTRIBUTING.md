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
- Jest validates package behavior and repository tooling.
- The package check verifies that npm tarballs contain raw TypeScript and declarations only.
- The consumer smoke installs a fresh tarball and builds Chrome MV3 and Firefox MV2 extensions with Addon Bone.
- The browser smoke loads those builds in real browsers and verifies CSS-before-JavaScript execution.

## Manual browser testing

Build the consumer fixture and start its local test page:

```sh
pnpm build:consumer
pnpm serve:consumer
```

Open the printed `http://127.0.0.1:<port>/top.html` URL before installing the extension. Load
`output/plugin-reg-cs/smoke-chrome-mv3` as an unpacked Chrome extension or
`output/plugin-reg-cs/smoke-firefox-mv2/manifest.json` as a temporary Firefox add-on.

For every install-time test, remove the extension, reload the page while the extension is absent, and install it again.
Using the extension's Reload button does not reproduce a fresh installation. The page may remain in a background tab,
but discarded and frozen tabs are intentionally skipped.

The local server uses Node.js and needs no additional package. Press `Ctrl+C` to stop it. Generated manual builds live
under the ignored `output/` directory; CI uses temporary directories and does not update this local output.

## Releases

Do not manually edit package versions, create package tags, or publish packages. Nx Release performs independent
versioning and publication after changes reach `main`.
