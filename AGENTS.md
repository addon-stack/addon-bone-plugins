# Repository guidance

## Current scope

- Migrated packages are `@adnbn/plugin-reg-cs` and `@adnbn/plugin-remote-config`.
- Do not scaffold or migrate another plugin unless the user explicitly expands this scope.
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
- Remote-config keeps isolated compiler tests in `tests/types`; its `typecheck` runs source, Jest, and type-test programs.
- Browser-facing tests use the published `@addon-core/browser/testing` harness and fixtures. Keep browser wrappers
  and injection packages real; configure native results/errors through the harness instead of mocking those modules.
- Restore harness globals after every test. URL queries and host permissions use the harness state by default;
  reserve explicit result overrides for malformed responses or unsupported scenarios. Keep real-browser smoke tests.
- Do not add Vite adapters, Testing Library, DOM emulation, or Browser Mode without a concrete test that requires it.
- A test runner does not replace `tsc --noEmit`, declaration emission, tarball validation, or the Addon Bone consumer
  smoke.
- Consumer validation must install a freshly packed tarball; do not validate through a workspace link or neighboring
  checkout.
- `pnpm build:consumer` runs local development builds inside each fixture with workspace dependencies. Addon Bone
  generates `.adnbn` and `dist` there directly. Keep this workflow separate from packed-consumer validation.

## Injection architecture

- Addon Bone is the only production compiler. Packages must not add a Rspack build target or emit a JavaScript bundle.
- Do not introduce Vite or Vitest. The Addon Bone runtime and Rspack consumer pipeline are the integration boundary.
- `@adnbn/plugin-reg-cs` reads the native built-manifest content-script contract and delegates URL pattern and glob
  matching to `webext-patterns`; do not add a second normalized content-script model or a hand-written matcher.
- Install catch-up processes matching complete, non-discarded tabs, whether active or in the background. Chromium MV3
  keeps frozen tabs in `storage.session` and rechecks them after unfreezing. MV2 only performs immediate catch-up.
  Do not activate, reload, or unfreeze tabs for injection. Keep the authorized pending queue session-scoped.
- Firefox performs install-time catch-up natively; exclude the plugin background entrypoint from Firefox builds with
  its static `excludeBrowser` option to avoid duplicate execution and unnecessary runtime code. Do not infer the
  target browser at runtime.
- Process declarations in manifest order. Within a tab, await the whole CSS array before attempting the whole JavaScript
  array; parallelism and `Promise.allSettled` are limited to independent eligible tabs in one declaration.

## Remote configuration

- Defaults are required and must cover the consumer's augmented `RemoteConfig` schema. Successful JSON objects merge
  deeply with these defaults only; never merge a new response with previous remote values. Arrays are replaced whole.
  Empty objects and explicit falsy values are valid responses; explicit `null` replaces the corresponding default.
- Failed refreshes retain the last working response for the same URL. TTL controls freshness, not cache usability.
- New configuration, URL, success time, and retry metadata use one ordinary `storage.local` record with namespace
  `@adnbn/plugin-remote-config` and key `cache`.
  This is an intentional breaking change: use no secure-storage APIs and do not add legacy cache migration paths.
- Keep network and storage failures independent, share concurrent refreshes, and bound requests and retry frequency.
- Requests default to `credentials: "omit"`; cookie-authenticated endpoints must explicitly select `"include"`.
- Keep public exports `.`, `/api`, `/react`, and `/service`, with the declaration-merging contract. Addon Bone owns
  compilation and service transport. Preserve the service get method's public import reference in JSDoc.
- Selectors and typed dot paths are resolved locally in the API and React adapter using the shared selection helper.
  The service returns full configurations; selector functions must not cross the service transport.

## Workspace and releases

- An Nx project name must exactly equal its npm package name.
- Published package manifests must use the monorepo `repository.url` and set `repository.directory` to their project
  root.
- Use pnpm only; keep `pnpm-lock.yaml` authoritative and do not add package-local lockfiles.
- Keep package versions and `{projectName}@{version}` tags under Nx Release control.
- Preserve imported release tags: they are version baselines, not disposable migration artifacts.
- Use Conventional Commit scopes from `commitlint.config.mjs` and add a new full package name there when scope expands.

## Permission design

- Follow least privilege for every plugin. Add only permissions required by the plugin's currently enabled behavior;
  never request permissions for likely consumer needs, future features, or merely because an API namespace is used.
- Reuse consumer-owned host access or API permissions when they already provide the required capability. Verify the
  exact browser and manifest-version contract before adding a broader permission.
- Compute automatically added permissions at the manifest-build boundary for each browser and manifest version. Do not
  emit a permission on targets where the corresponding runtime path is disabled or handled natively by the browser.
- When a permission is needed only by an optional feature or a useful permission-free fallback exists, expose a
  build-time plugin option that controls both the feature and its permission. Disabling the feature must remove its
  runtime path and permission; permissions required by the plugin's core behavior may remain automatic.
- Test the generated permission matrix across supported targets. Where removing a broader permission depends on host
  access or browser behavior, retain a real-browser smoke test rather than relying only on unit mocks.

## Package documentation

- Keep the workspace README presentation-focused and link every available package to its package directory.
- Follow the package README order defined in `CONTRIBUTING.md`; use the `@adnbn/plugin-reg-cs` README as the current
  reference.
- Use npm version, monthly downloads, CI, and license badges with Shields.io's `for-the-badge` style.
- Document every automatically added permission, why it is needed, and a copy-ready baseline store justification.
  Document consumer-owned host access separately, and state explicitly when a package adds no permissions.
- Keep the first example minimal and explain runtime flow, guarantees, and limitations in plain developer-facing prose.

## Validation

- Shared named constants use PascalCase, such as `PluginName`, rather than `UPPER_CASE`. Local bindings may use
  camelCase. Keep internal constants out of public package entrypoints.
- Run the narrow package check while iterating and `pnpm verify` before handoff.
- Treat unit tests, package-shape checks, consumer builds, and real-browser runtime tests as separate evidence.
- Keep mass formatting isolated from behavioral changes so imported history remains useful.
