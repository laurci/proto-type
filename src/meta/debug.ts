import { FunctionMacro, getBuildConfig, getCurrentProgram, findAncestor, isStringLiteral, MacroCallExpressionNode, NodeFactory, SourceFile, isFunctionLike, isClassDeclaration, Node, getLineAndCharacterOfPosition } from "compiler";
import * as path from "path";
import { getGlobalInvokeExpression, getNodeText } from "./lib";

const ENABLE_KEY = "debug.enable";

function createLog(factory: NodeFactory, sourceFile: SourceFile, node: MacroCallExpressionNode) {
    const baseDir = getCurrentProgram().getCurrentDirectory();
    const fileName = path.relative(baseDir, sourceFile.fileName);

    let intro = `[debug][${fileName}`;

    const topFn = findAncestor(node, isFunctionLike);
    if (topFn && topFn.name) {
        const fnNAme = getNodeText(topFn.name, sourceFile);
        const topClass = findAncestor(topFn, isClassDeclaration);
        if (topClass && topClass.name) {
            const className = getNodeText(topClass.name, sourceFile);
            intro += `:${className}.${fnNAme}`;
        } else {
            intro += `:${fnNAme}`;
        }
    }

    intro += "]";

    return getGlobalInvokeExpression(factory, "debug_log", [
        factory.createStringLiteral(intro),
        ...node.arguments.flatMap((arg) => {
            if (isStringLiteral(arg)) return arg;
            const argText = getNodeText(arg, sourceFile);

            return factory.createObjectLiteralExpression([
                factory.createPropertyAssignment("type", factory.createStringLiteral("expression")),
                factory.createPropertyAssignment("value", arg),
                factory.createPropertyAssignment("text", factory.createStringLiteral(argText)),
            ]);
        })
    ]);
}

export macro function debug(this: FunctionMacro, ..._args: unknown[]) {
    this.transform(({ node, factory, sourceFile }) => {
        const buildConfig = getBuildConfig();

        if (!buildConfig[ENABLE_KEY]) {
            return node.remove();
        }


        return node.replace(createLog(factory, sourceFile, node));
    });
}
