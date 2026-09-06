jest.mock("adnbn", () => ({
    Browser: {Firefox: "firefox"},
    definePlugin: (definition: unknown) => definition,
}));

import registerContentScript from "../plugin";

interface PluginDefinition {
    background: boolean;
    manifest(options: {
        config: {browser: string; manifestVersion: 2 | 3};
        manifest: {addPermission(permission: string): void};
    }): void;
    name: string;
}

type PluginFactory = () => PluginDefinition;

const plugin = (): PluginDefinition => (registerContentScript as unknown as PluginFactory)();

describe("plugin configuration", () => {
    it("registers the background directory without runtime options", () => {
        expect(plugin()).toMatchObject({
            background: true,
            name: "@adnbn/plugin-reg-cs",
        });
    });

    it.each([
        {browser: "chrome", expected: ["storage", "scripting"], manifestVersion: 3 as const},
        {browser: "chrome", expected: [], manifestVersion: 2 as const},
        {browser: "firefox", expected: [], manifestVersion: 3 as const},
        {browser: "firefox", expected: [], manifestVersion: 2 as const},
    ])(
        "adds $expected to a $browser MV$manifestVersion manifest",
        ({browser, expected, manifestVersion}) => {
            const addPermission = jest.fn();
            const manifest = {addPermission};

            addPermission.mockReturnValue(manifest);

            plugin().manifest({
                config: {browser, manifestVersion},
                manifest,
            });

            expect(addPermission.mock.calls.map(([permission]) => permission)).toEqual(expected);
        }
    );
});
