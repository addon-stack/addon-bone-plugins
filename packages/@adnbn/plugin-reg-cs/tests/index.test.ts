jest.mock("adnbn", () => ({
    definePlugin: (definition: unknown) => definition,
}));

import registerContentScript from "../plugin/index";

interface PluginDefinition {
    background: boolean;
    name: string;
}

type PluginFactory = () => PluginDefinition;

describe("plugin configuration", () => {
    it("registers the background entrypoint without build-time options", () => {
        const plugin = (registerContentScript as unknown as PluginFactory)();

        expect(plugin).toEqual({
            background: true,
            name: "@adnbn/plugin-reg-cs",
        });
    });
});
