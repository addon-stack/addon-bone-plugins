import {defineContentScript} from "adnbn";

import "./smoke.css";

export default defineContentScript({
    allFrames: true,
    matches: ["http://127.0.0.1/*"],
    declarative: true,
    runAt: "document_idle",
    main() {
        const root = document.documentElement;
        const runCount = Number(root.dataset.adnbnPluginRegCsRuns ?? 0) + 1;

        root.dataset.adnbnPluginRegCsCss = getComputedStyle(root)
            .getPropertyValue("--adnbn-plugin-reg-cs-smoke")
            .trim();

        root.dataset.adnbnPluginRegCsFrame = window === window.top ? "top" : "child";
        root.dataset.adnbnPluginRegCsRuns = String(runCount);
    },
});
