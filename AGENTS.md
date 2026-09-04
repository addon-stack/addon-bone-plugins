# Repository guidance

## Current scope

- The only migrated package is `@adnbn/plugin-reg-cs`.
- Do not scaffold or migrate another plugin unless the user explicitly expands the pilot scope.
- Preserve public package names, exports, peer contracts, and observable runtime behavior during infrastructure work.

## Raw TypeScript contract

- Packages publish their implementation as raw TypeScript under `plugin/`.
- Addon Bone is the sole owner of consumer-side production transpilation and bundling.
- The only allowed generated publish artifacts are `dist-types/**/*.d.ts` and declaration maps.
- `exports.default` must point to `plugin/*.ts`; `exports.types` must point to `dist-types/*.d.ts`.
- Do not add a JavaScript build target or Vite, Vitest, Rsbuild, Rspack, Rslib, Rollup, tsup, esbuild, or another
  production bundler without an explicit architecture decision from the user.

## Tests

- Unit tests use Jest in the Node environment. Test transforms must not produce or publish package artifacts.
- Browser-facing tests use the published `@addon-core/browser/testing` harness and fixtures. Keep browser wrappers
  and injection packages real; configure native results/errors through the harness instead of mocking those modules.
- Restore harness globals after every test. URL queries and host permissions use the harness state by default;
  reserve explicit result overrides for malformed responses or unsupported scenarios. Keep real-browser smoke tests.
- Do not add Vite adapters, Testing Library, DOM emulation, or Browser Mode without a concrete test that requires it.
- A test runner does not replace `tsc --noEmit`, declaration emission, tarball validation, or the Addon Bone consumer
  smoke.
- Consumer validation must install a freshly packed tarball; do not validate through a workspace link or neighboring
  checkout.

## Injection architecture

- Addon Bone is the only production compiler. Packages must not add a Rspack build target or emit a JavaScript bundle.
- Do not introduce Vite or Vitest. The Addon Bone runtime and Rspack consumer pipeline are the integration boundary.
- `@adnbn/plugin-reg-cs` reads the native built-manifest content-script contract and delegates URL pattern and glob
  matching to `webext-patterns`; do not add a second normalized content-script model or a hand-written matcher.
- Install catch-up processes all matching complete, non-discarded, non-frozen tabs, whether active or in the background.
  Do not activate, reload, or unfreeze tabs for injection. Do not add persistence, permission waiting, background-tab
  listeners, or deferred activation without an explicit opt-in product decision.
- Firefox performs install-time catch-up natively; use Addon Bone's synchronous `getBrowser()` build target and keep
  the explicit Firefox early return to avoid duplicate execution. Do not infer the target browser at runtime.
- Process declarations in manifest order. Within a tab, await the whole CSS array before attempting the whole JavaScript
  array; parallelism and `Promise.allSettled` are limited to independent eligible tabs in one declaration.

## Workspace and releases

- An Nx project name must exactly equal its npm package name.
- Published package manifests must use the monorepo `repository.url` and set `repository.directory` to their project
  root.
- Use pnpm only; keep `pnpm-lock.yaml` authoritative and do not add package-local lockfiles.
- Keep package versions and `{projectName}@{version}` tags under Nx Release control.
- Preserve imported release tags: they are version baselines, not disposable migration artifacts.
- Use Conventional Commit scopes from `commitlint.config.mjs` and add a new full package name there when scope expands.

## Package documentation

- Keep the workspace README presentation-focused and link every available package to its package directory.
- Follow the package README order defined in `CONTRIBUTING.md`; use the `@adnbn/plugin-reg-cs` README as the current
  reference.
- Use npm version, monthly downloads, CI, and license badges with Shields.io's `for-the-badge` style.
- Document every automatically added permission, why it is needed, and a copy-ready baseline store justification.
  Document consumer-owned host access separately, and state explicitly when a package adds no permissions.
- Keep the first example minimal and explain runtime flow, guarantees, and limitations in plain developer-facing prose.

## Validation

- Run the narrow package check while iterating and `pnpm verify` before handoff.
- Treat unit tests, package-shape checks, consumer builds, and real-browser runtime tests as separate evidence.
- Keep mass formatting isolated from behavioral changes so imported history remains useful.
