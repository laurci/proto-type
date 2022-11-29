import * as path from "path";
import { inspect } from "util";
import type { RawProtoDefinition } from "./client";

export function withGlobal<T>(key: string, value?: unknown): T | undefined {
    const fullKey = `__${key}`;
    if (typeof value == "undefined") {
        return (globalThis as unknown as Record<string, unknown>)[fullKey] as T;
    }

    (globalThis as unknown as Record<string, unknown>)[fullKey] = value;
}
(globalThis as unknown as Record<string, unknown>)["_with_global"] = withGlobal;

withGlobal("path_relative_to_file", (baseDir: string, relativePath: string) => {
    return path.join(baseDir, relativePath);
});

type LogArg = string | { type: "expression"; value: unknown; text: string };

withGlobal("debug_log", (...args: LogArg[]) => {
    for (const arg of args) {
        if (typeof arg === "string") {
            process.stdout.write(arg);
        }

        if (typeof arg == "object") {
            process.stdout.write("(");
            process.stdout.write(arg.text);
            process.stdout.write(" = ");
            if (typeof arg.value == "object" && typeof (arg.value as any)?.["debugPrint"] == "function") {
                process.stdout.write((arg.value as any).debugPrint());
            } else {
                process.stdout.write(inspect(arg.value, {
                    colors: true
                }));
            }
            process.stdout.write(")");
        }

        process.stdout.write(" ");
    }

    process.stdout.write("\n");
});

withGlobal("raw_proto", (dirname: string, relativePath: string, servicesText: string): RawProtoDefinition => {
    return {
        path: path.join(dirname, relativePath),
        services: JSON.parse(servicesText)
    };
});
