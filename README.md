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
- Do not add Vite, Vitest, Rsbuild, Rspack, Rslib, Rollup, tsup, esbuild, or another production bundler without an
  explicit architecture decision that changes this contract.

Unit tests use [Rstest](https://rstest.rs/). Rstest's internal Rsbuild/Rspack transformation is test-only, normally
in-memory, and produces no published package artifact. It is not a production build step.

## Development

Requirements: Node.js 22.14 or newer and pnpm 11.24.0 or newer.

```sh
pnpm install
pnpm lint
pnpm check
pnpm check:consumer
pnpm verify
pnpm release:dry-run
```

The verification layers are deliberately separate:

- ESLint and Prettier validate source and repository conventions.
- pnpm audit blocks high- and critical-severity advisories in the complete development dependency graph.
- TypeScript checks source/tests and emits public declarations.
- Rstest validates package behavior in a Node test environment.
- The pack contract verifies that the npm tarball contains raw TypeScript and declarations only.
- The consumer smoke installs the real tarball into an isolated Addon Bone project and performs cold Chrome MV3 and
  Firefox MV2 builds.

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
