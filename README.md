# Addon Bone Plugins

Official plugins for [Addon Bone](https://addonbone.com), the framework for building modern browser extensions.

This monorepo collects focused capabilities that can be added to an Addon Bone extension without rebuilding common
browser behavior from scratch. Install only the plugins your extension needs and register them in its framework
configuration.

## Packages

- [`@adnbn/plugin-reg-cs`](packages/@adnbn/plugin-reg-cs) — activates declarative content scripts in eligible tabs
  that were already open when an extension was installed.

## How plugins work

Each plugin connects to Addon Bone through `defineConfig()`. Addon Bone then includes the plugin's raw TypeScript in
the consumer extension and remains the only production compiler and bundler.

Package-specific installation, permissions, store justifications, behavior, and examples live in each package's own
README.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development, package documentation, validation, and release conventions.
