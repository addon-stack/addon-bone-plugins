import {defineContentScript} from "adnbn";
import {getRemoteConfig} from "@adnbn/plugin-remote-config/api";
import {useRemoteConfig} from "@adnbn/plugin-remote-config/hooks";

import {createElement} from "react";
import {createRoot} from "react-dom/client";

function ConfigView() {
    const label = useRemoteConfig(config => config.label);

    return createElement("pre", {id: "remote-config-hook"}, label);
}

export default defineContentScript({
    matches: ["http://127.0.0.1/*"],
    declarative: true,
    runAt: "document_idle",
    main() {
        const button = document.createElement("button");
        button.id = "read-remote-config";
        button.textContent = "Read config";
        const output = document.createElement("pre");
        output.id = "remote-config-output";
        const react = document.createElement("div");
        document.body.append(button, output, react);
        createRoot(react).render(createElement(ConfigView));

        button.addEventListener("click", async () => {
            output.textContent = "pending";

            try {
                output.textContent = JSON.stringify(await getRemoteConfig());
            } catch (error) {
                output.textContent = JSON.stringify({error: String(error)});
            }
        });
    },
});
