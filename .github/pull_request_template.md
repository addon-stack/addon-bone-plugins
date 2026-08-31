## Summary

<!-- Describe the user-visible or infrastructure change. -->

## Verification

- [ ] `pnpm lint`
- [ ] `pnpm check`
- [ ] `pnpm check:consumer` when the package or packaging contract changed

## Package contract

- [ ] Runtime exports still point to raw TypeScript.
- [ ] The tarball contains declarations and no compiled JavaScript.
- [ ] Public APIs, peer requirements, and release impact are documented.
- [ ] A published package dependency change will land with a versionable package-scoped commit.
