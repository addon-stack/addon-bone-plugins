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

- Unit tests use Rstest in the Node environment.
- Rstest's internal Rsbuild/Rspack transform is test-only and must not produce or publish package artifacts.
- Do not add Vite adapters, Testing Library, DOM emulation, or Browser Mode without a concrete test that requires it.
- A test runner does not replace `tsc --noEmit`, declaration emission, tarball validation, or the Addon Bone consumer
  smoke.
- Consumer validation must install a freshly packed tarball; do not validate through a workspace link or neighboring
  checkout.

## Workspace and releases

- An Nx project name must exactly equal its npm package name.
- Published package manifests must use the monorepo `repository.url` and set `repository.directory` to their project
  root.
- Use pnpm only; keep `pnpm-lock.yaml` authoritative and do not add package-local lockfiles.
- Keep package versions and `{projectName}@{version}` tags under Nx Release control.
- Preserve imported release tags: they are version baselines, not disposable migration artifacts.
- Use Conventional Commit scopes from `commitlint.config.mjs` and add a new full package name there when scope expands.

## Validation

- Run the narrow package check while iterating and `pnpm verify` before handoff.
- Treat unit tests, package-shape checks, consumer builds, and real-browser runtime tests as separate evidence.
- Keep mass formatting isolated from behavioral changes so imported history remains useful.
