import {selectConfig} from "../../plugin/selection";
import type {RemoteConfig} from "../../plugin/types";

// This schema belongs to an isolated compiler project so it cannot affect runtime test fixtures.
declare module "../../plugin/types" {
    interface RemoteConfig {
        flag: boolean;
        label: string;
        nested: {a: number; b: number};
        optional?: {value: number};
        items?: {title: string}[];
    }
}

type Equal<Actual, Expected> =
    (<T>() => T extends Actual ? 1 : 2) extends (<T>() => T extends Expected ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

export function checkHelperTypes(
    config: RemoteConfig,
    arbitraryPath: string,
    optionalPath: "nested.b" | undefined,
    selection: "nested.b" | ((config: RemoteConfig) => boolean)
) {
    const _full = selectConfig(config);
    const _undefined = selectConfig(config, undefined);
    const _nested = selectConfig(config, "nested");
    const _number = selectConfig(config, "nested.b");
    const _optional = selectConfig(config, "optional.value");
    const _array = selectConfig(config, "items.0.title");
    const _selected = selectConfig(config, value => value.flag);
    const _asyncSelected = selectConfig(config, async value => value.label);
    const _optionalSelection = selectConfig(config, optionalPath);
    const _unionSelection = selectConfig(config, selection);

    type Checks = [
        Expect<Equal<typeof _full, RemoteConfig>>,
        Expect<Equal<typeof _undefined, RemoteConfig>>,
        Expect<Equal<typeof _nested, RemoteConfig["nested"]>>,
        Expect<Equal<typeof _number, number>>,
        Expect<Equal<typeof _optional, number | undefined>>,
        Expect<Equal<typeof _array, string | undefined>>,
        Expect<Equal<typeof _selected, boolean>>,
        Expect<Equal<typeof _asyncSelected, Promise<string>>>,
        Expect<Equal<typeof _optionalSelection, RemoteConfig | number>>,
        Expect<Equal<typeof _unionSelection, number | boolean>>,
    ];

    // @ts-expect-error Invalid internal paths must be rejected too.
    selectConfig(config, "nested.missing");
    // @ts-expect-error Arbitrary strings cannot bypass the helper's schema.
    selectConfig(config, arbitraryPath);
    // @ts-expect-error Selector parameters are RemoteConfig, not any.
    selectConfig(config, value => value.missing);
    // @ts-expect-error The selection cannot be omitted when a path type is explicitly supplied.
    selectConfig<"nested.b">(config);

    return {} as Checks;
}
