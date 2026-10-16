import {createRequire} from "node:module";

import {describe, expect, test} from "@jest/globals";

import {assertPreciseLockfileChanges} from "../check-dependency-history.mjs";

const require = createRequire(import.meta.url);
const {LockFileChange, WholeFileChange} = require("nx/src/project-graph/file-utils");
const nxJson = {pluginsConfig: {"@nx/js": {projectsAffectedByDependencyUpdates: "auto"}}};

const graph = {
    nodes: {first: {name: "first"}, second: {name: "second"}},
    externalNodes: {"npm:example": {data: {packageName: "example", version: "1.0.0"}}},
};

const base = "lockfileVersion: '9.0'\npackages:\n  example@1.0.0:\n" +
    "    resolution: {integrity: sha512-before}\nsnapshots:\n  example@1.0.0: {}\n";

const head = base.replace("sha512-before", "sha512-after");
const changes = change => [{file: "pnpm-lock.yaml", getChanges: () => [change]}];

describe("release stops instead of accepting Nx's all-project fallback", () => {
    test("a dependency present in the graph is safe to attribute", () => {
        expect(() => assertPreciseLockfileChanges(
            changes(new LockFileChange(base, head)), graph, nxJson, {}, "valid"
        )).not.toThrow();
    });

    test("missing historical lockfile content blocks release", () => {
        expect(() => assertPreciseLockfileChanges(
            changes(new WholeFileChange()), graph, nxJson, {}, "missing history"
        )).toThrow(/Cannot safely attribute/);
    });

    test("invalid historical lockfiles block release", () => {
        expect(() => assertPreciseLockfileChanges(
            changes(new LockFileChange("invalid: [", head)), graph, nxJson, {}, "invalid lockfile"
        )).toThrow(/Cannot safely attribute/);
    });

    test("a removed dependency absent from the current graph blocks release", () => {
        expect(() => assertPreciseLockfileChanges(
            changes(new LockFileChange(base, "lockfileVersion: '9.0'\npackages: {}\n")),
            {...graph, externalNodes: {}}, nxJson, {}, "removed dependency"
        )).toThrow(/Cannot safely attribute/);
    });
});
