import { provider } from "@laurci/injector/lib";
import * as path from "path";
import type { RawProtoDefinition } from "./client";

export function bootstrap() {
    provider!(function rawProto(dirname: string, relativePath: string, servicesText: string): RawProtoDefinition {
        return {
            path: path.join(dirname, relativePath),
            services: JSON.parse(servicesText)
        };
    });
}
