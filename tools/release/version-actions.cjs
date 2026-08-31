const defaultVersionActions = require("@nx/js/src/release/version-actions");

class AddonBonePluginsVersionActions extends defaultVersionActions.default {
    async calculateNewVersion(
        currentVersion,
        newVersionInput,
        newVersionInputReason,
        newVersionInputReasonData,
        preid
    ) {
        const isPreOneMajor = currentVersion?.startsWith("0.");
        const adjustedInput =
            isPreOneMajor && newVersionInput === "major"
                ? "minor"
                : isPreOneMajor && newVersionInput === "premajor"
                  ? "preminor"
                  : newVersionInput;

        const result = await super.calculateNewVersion(
            currentVersion,
            adjustedInput,
            newVersionInputReason,
            newVersionInputReasonData,
            preid
        );

        if (adjustedInput === newVersionInput) {
            return result;
        }

        return {
            ...result,
            logText: `Applied a minor bump for a breaking change below 1.0.0 to get new version ${result.newVersion}`,
        };
    }
}

module.exports = AddonBonePluginsVersionActions;
module.exports.afterAllProjectsVersioned = defaultVersionActions.afterAllProjectsVersioned;
