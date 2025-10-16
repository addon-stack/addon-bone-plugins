# Changelog

## 🚀 Release `@adnbn/plugin-remote-config` v0.3.0 (2025-10-16)


### ⚡️ Performance Improvements

* **config:** replace Prettier with Biome for standardization ([e463231](https://github.com/addon-stack/plugin-remote-config/commit/e463231a50633dc2d7445931f25b780753a7af94))




### ✨ Features

* add manifest support for remote config host permissions ([ea309ca](https://github.com/addon-stack/plugin-remote-config/commit/ea309cab29fbe3c03ceaa3a7b501d267a1a9860b))


* enhance TypeScript and build configuration ([f0592d0](https://github.com/addon-stack/plugin-remote-config/commit/f0592d0d489de1d8d5ee794327fc9b3585b9939d))


* **husky:** add Husky hooks for pre-commit, commit-msg, and pre-push ([456efdb](https://github.com/addon-stack/plugin-remote-config/commit/456efdb7345d30f33d44ecca5043fbb5d9fa8716))


* update dependencies, refactor remote config, and introduce hooks ([c4d9c05](https://github.com/addon-stack/plugin-remote-config/commit/c4d9c05dd9ca6ef7372ef1222430db3909c23dbb))

  - Replaced `validator` with `is-url` for URL validation.
  - Added `useRemoteConfig` hook in `plugin/hooks.ts`.
  - Removed `RemoteConfigProvider` and related React context in favor of simpler hooks.
  - Introduced `AwaitLock` for better concurrency handling in RemoteConfig service.
  - Refactored `plugin/index.ts` and removed unused code for improved flexibility.



### 🐛 Bug Fixed

* replace Promise.allSettled with sequential calls in RemoteConfig service ([f9cdc01](https://github.com/addon-stack/plugin-remote-config/commit/f9cdc010a4f6ae718b328a73c4082662ddcf2841))




### 📝 Documentation

* update badges, usage instructions, and add license and security policy ([a20c073](https://github.com/addon-stack/plugin-remote-config/commit/a20c07343b75591c9f23be2be2c410d3fdc76fed))




### 🤖 CI

* add GitHub Actions workflows for CI and release automation ([d62a783](https://github.com/addon-stack/plugin-remote-config/commit/d62a7834fcd1f62c539842de31a63e34d22f32db))


* **fix:** update build step to run `build:types` instead of `build` ([0f00fbb](https://github.com/addon-stack/plugin-remote-config/commit/0f00fbbd68a1529b7632960305968a896b566c9b))


* **fix:** update Node.js versions in CI and release workflows ([37d6b8a](https://github.com/addon-stack/plugin-remote-config/commit/37d6b8a60517056057902f4794560754845b113c))




### 🧩 Other

* Update dependencies, refactor remote config, and introduce hooks ([503b4b8](https://github.com/addon-stack/plugin-remote-config/commit/503b4b8457421178af0d5b6416f4d126e07ef6f8))

  - Replaced `validator` with `is-url` for URL validation.
  - Added `useRemoteConfig` hook in `plugin/hooks.ts`.
  - Removed `RemoteConfigProvider` and related React context in favor of simpler hooks.
  - Introduced `AwaitLock` for better concurrency handling in RemoteConfig service.
  - Refactored `plugin/index.ts` and removed unused code for improved flexibility.



### 🛠️ Refactoring

* organize imports and improve type usage ([505b56e](https://github.com/addon-stack/plugin-remote-config/commit/505b56ea8bf00e76ab6606a9920711c48672a9cd))


* **types:** simplify `import` for type-only modules ([b2825e1](https://github.com/addon-stack/plugin-remote-config/commit/b2825e111c26e42c82fed1bafcf8adf3e5637455))





### 🙌 Contributors

- [Addon Stack](https://github.com/addon-stack) (@addon-stack) — 13 commits
- [Rostyslav Nihrutsa](rostyslav.nihrutsa@gmail.com) — 5 commits
