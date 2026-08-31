# Contributing to Addon Bone Plugins

## Workflow

1. Create a branch from `main`.
2. Install dependencies with `pnpm install`.
3. Make one coherent change and use a Conventional Commit message.
4. Run `pnpm verify` before opening a pull request.

The pre-commit hook safely fixes staged files with ESLint and Prettier. The pre-push hook validates the commit range and
runs the same workspace verification expected by CI.

## Package contract

Plugins publish raw TypeScript plus generated declarations. Do not add compiled JavaScript, a production bundler, or a
new public export without documenting and testing the package contract.

Package changes use the complete npm name as their Conventional Commit scope, for example
`fix(@adnbn/plugin-reg-cs): ...`.

Dependabot uses `chore(deps)` for npm updates so root tooling and lockfile-only changes do not publish a package. If a
dependency update changes a published package manifest, its commit on `main` must instead be versionable and scoped to
that package—for example, rename the squash-merge title to `fix(@adnbn/plugin-reg-cs): update @addon-core/browser`.
Without that scoped `fix`, `feat`, or breaking commit, Nx correctly leaves the package version unchanged and the
manifest change is not published yet.

## Releases

Do not manually edit package versions, create package tags, or publish packages. Nx Release performs independent
versioning and publication after changes reach `main`.
