import { TaggedTemplateMacro } from "compiler";
import { getGlobalInvokeExpression } from "./lib";

export macro function rel(this: TaggedTemplateMacro, ..._args: unknown[]): string {
    this.transform(({ node, factory }) => {
        return node.replace(
            getGlobalInvokeExpression(factory, "path_relative_to_file", [
                factory.createIdentifier("__dirname"), node.template
            ])
        );
    });
}
