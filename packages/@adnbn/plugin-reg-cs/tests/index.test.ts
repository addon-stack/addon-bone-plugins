import {describe, expect, it, rs} from "@rstest/core";

type PluginMetadata = {
    name: string;
    background: boolean;
};

const mocks = rs.hoisted(() => ({
    definePlugin: rs.fn((factory: () => PluginMetadata) => factory()),
}));

rs.mock("adnbn", () => ({
    definePlugin: mocks.definePlugin,
}));

import plugin from "../plugin/index";

describe("plugin metadata", () => {
    it("registers the scoped package as a background plugin", () => {
        expect(plugin).toEqual({
            name: "@adnbn/plugin-reg-cs",
            background: true,
        });
    });
});
