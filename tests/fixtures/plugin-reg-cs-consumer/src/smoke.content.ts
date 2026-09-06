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
        const frame = window === window.top ? "top" : "child";

        root.dataset.adnbnPluginRegCsCss = getComputedStyle(root)
            .getPropertyValue("--adnbn-plugin-reg-cs-smoke")
            .trim();

        root.dataset.adnbnPluginRegCsFrame = frame;
        root.dataset.adnbnPluginRegCsRuns = String(runCount);
        root.dataset.adnbnPluginRegCsState = runCount === 1 ? "ready" : "duplicate";

        const heading = document.querySelector<HTMLElement>("[data-smoke-heading]");
        const status = document.querySelector<HTMLElement>("[data-smoke-status]");

        if (heading) {
            heading.textContent = runCount === 1 ? "Injection complete" : "Duplicate injection detected";
        }

        if (status) {
            status.textContent =
                runCount === 1
                    ? `JavaScript injected successfully into the ${frame} frame.`
                    : `The ${frame} frame was injected ${runCount} times.`;
        }
    },
});
