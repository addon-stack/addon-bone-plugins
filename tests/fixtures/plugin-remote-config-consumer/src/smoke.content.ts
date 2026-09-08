import {defineContentScript} from "adnbn";
import {getRemoteConfig} from "@adnbn/plugin-remote-config/api";
import {useRemoteConfig} from "@adnbn/plugin-remote-config/react";

import {createElement, useState} from "react";
import {createRoot} from "react-dom/client";

function ConfigView() {
    const [path, setPath] = useState<"nested.a" | "nested.b">("nested.a");
    const [prefix, setPrefix] = useState("");
    const label = useRemoteConfig(config => prefix + config.label);
    const value = useRemoteConfig(path);

    return createElement("div", null,
        createElement("pre", {id: "remote-config-hook"}, label),
        createElement("pre", {id: "remote-config-hook-path"}, value),
        createElement("button", {id: "switch-remote-config-path", onClick: () => {
            setPath(value => value === "nested.a" ? "nested.b" : "nested.a");
            setPrefix(value => value ? "" : "selected: ");
        }}, "Switch selected field")
    );
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
        const selection = document.createElement("pre");
        selection.id = "remote-config-selection";
        const react = document.createElement("div");
        document.body.append(button, output, selection, react);
        createRoot(react).render(createElement(ConfigView));

        button.addEventListener("click", async () => {
            output.textContent = "pending";

            try {
                const [config, value, enabled] = await Promise.all([
                    getRemoteConfig(), getRemoteConfig("nested.b"), getRemoteConfig(config => config.flag),
                ]);

                selection.textContent = JSON.stringify({value, enabled});
                output.textContent = JSON.stringify(config);
            } catch (error) {
                output.textContent = JSON.stringify({error: String(error)});
            }
        });
    },
});
