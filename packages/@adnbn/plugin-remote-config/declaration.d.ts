import "adnbn/service";

import type service from "./plugin/service";

declare module "adnbn/service" {
    interface ServiceRegistry {
        "@adnbn/plugin-remote-config/service": ReturnType<typeof service.init>;
    }
}
