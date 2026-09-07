# `@adnbn/plugin-remote-config` history import

The source repository was filtered into `packages/@adnbn/plugin-remote-config` with `git-filter-repo` 2.47.0.

- Source `develop`: `05e0c3a24d76cd93a7ca8fe137faebde452d42a8`
- Source `main`: `29f33587b3b9e4d0b2a797ca93276395c658a608`
- Imported commits: 46
- Imported annotated release tags: 6
- Tag mapping: `vX.Y.Z` to `@adnbn/plugin-remote-config@X.Y.Z`

`commit-map.txt` records original and rewritten commit IDs. `ref-map.txt` records both heads and annotated tag
objects. Authors, committers, dates, messages, parent relationships, and file contents are preserved; only tree paths
and object IDs change. Empty commits and merges were retained. Both branch tips are reachable through the import
merge. Preserve that merge when integrating the migration into `main`; squashing it would discard the imported ancestry.

Filtering ran in a fresh `git clone --mirror --no-local` copy, with `--to-subdirectory-filter`, `--tag-rename`,
`--preserve-commit-hashes`, `--prune-empty never`, and `--prune-degenerate never`. The source checkout was unchanged.
Import refs are local bookkeeping; scoped release tags must accompany the eventual authorized push.

The source repository remains the authority for GitHub-only pull-request discussions, release assets, and Actions
logs. The imported `0.3.1` tag is the Nx Release baseline; new versions remain under Nx control.
