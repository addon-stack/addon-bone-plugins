# Security Policy

## Supported versions

We maintain the latest release line of packages in this repository.

## Dependency audit policy

`pnpm verify` blocks high- and critical-severity advisories across the complete development dependency graph.
Moderate advisories are reviewed but do not automatically block development: the latest Addon Bone development
toolchain can carry upstream Rspack development-server advisories that are not part of the published plugin runtime.
Recheck them whenever Addon Bone or its Rspack dependencies are updated; do not add compatibility-risky overrides
without a separate validation decision.

## Reporting a vulnerability

Report security issues privately through
[GitHub private vulnerability reporting](https://github.com/addon-stack/addon-bone-plugins/security/advisories/new).
Do not open a public issue containing exploitable details.

For non-sensitive bugs, use the
[issue tracker](https://github.com/addon-stack/addon-bone-plugins/issues).

Please include the affected package/version, environment, reproduction steps, and expected impact when possible. We
will acknowledge reports within 72 hours and coordinate disclosure after a fix is available.
