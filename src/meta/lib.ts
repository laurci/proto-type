import { createPrinter, Expression, Node, NodeFactory, SourceFile } from "compiler";

const printer = createPrinter();
export function getNodeText(node: Node, sourceFile: SourceFile) {
    return printer.printNode(4 /* EmitHint.Unspecified */, node, sourceFile);
}

export function getGlobalAccessExpression(factory: NodeFactory, name: string) {
    return factory.createCallExpression(
        factory.createIdentifier("_with_global"),
        [],
        [factory.createStringLiteral(name)]
    )
}

export function getGlobalInvokeExpression(factory: NodeFactory, name: string, args: Expression[] = []) {
    return factory.createCallExpression(
        getGlobalAccessExpression(factory, name),
        [],
        args
    )
}
