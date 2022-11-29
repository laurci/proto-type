import { FunctionMacro, IntrinsicTypes, isStringLiteral, ObjectMemberTypeDefinition, TypeDefinitionFactory } from "compiler";
import * as Path from "path";
import * as Fs from "fs";
import { FieldType, parse as parseProto, ProtoDocument, ServiceDefinition, BaseType, SyntaxType, MessageDefinition } from "proto-parser";
import { getGlobalInvokeExpression } from "./lib";
import type { RawMethodDefinition, RawServiceDefinition } from "../client";

function parseBaseType(baseType: BaseType) {
    const name = baseType.value;
    switch (name) {
        case "string":
            return IntrinsicTypes.String;
        default:
            return IntrinsicTypes.Any;
    }
}

function parseMessageType(factory: TypeDefinitionFactory, document: ProtoDocument, messageType: FieldType) {
    const messageDefinition = (document.root.nested ?? {})[messageType.value] as MessageDefinition | undefined;
    if (!messageDefinition || messageDefinition.syntaxType !== SyntaxType.MessageDefinition) throw new Error(`Unknown message type ${messageType.value}`);

    const fields = messageDefinition.fields;
    const fieldNames = Object.keys(fields);

    const members = fieldNames.map(fieldName => {
        const field = fields[fieldName];
        const fieldType = parseFieldType(factory, document, field.type);
        return factory.createObjectMemberDefinition(fieldName, fieldType);
    }).filter(x => !!x) as ObjectMemberTypeDefinition[];


    return factory.createObjectDefinition(members);
}

function parseFieldType(factory: TypeDefinitionFactory, document: ProtoDocument, fieldType: FieldType) {
    if (fieldType.syntaxType == SyntaxType.BaseType) {
        return factory.createIntrinsicDefinition(parseBaseType(fieldType));
    } else if (fieldType.syntaxType == SyntaxType.Identifier) {
        return parseMessageType(factory, document, fieldType);
    }

    console.log("unknown field type", fieldType);

    return factory.createIntrinsicDefinition(IntrinsicTypes.Any);
}

function parseServiceType(factory: TypeDefinitionFactory, document: ProtoDocument, service: ServiceDefinition) {
    const methods = service.methods;
    const methodNames = Object.keys(methods);

    const members = methodNames.map(methodName => {
        const method = methods[methodName];
        const requestType = parseFieldType(factory, document, method.requestType);
        const responseType = parseFieldType(factory, document, method.responseType);

        return factory.createObjectMemberDefinition(methodName, factory.createObjectDefinition([
            factory.createObjectMemberDefinition("request", requestType),
            factory.createObjectMemberDefinition("response", responseType)
        ]));
    });

    return factory.createObjectMemberDefinition(service.name, factory.createObjectDefinition(members));
}

function parseServicesType(factory: TypeDefinitionFactory, proto: ProtoDocument) {
    // TODO: parse services and methods
    const nested = proto.root.nested ?? {};
    const keys = Object.keys(nested);

    const services = keys.map(key => {
        const node = nested[key];
        if (node.syntaxType == SyntaxType.ServiceDefinition) {
            return parseServiceType(factory, proto, node as ServiceDefinition);
        }

        return null;
    }).filter(x => !!x) as ObjectMemberTypeDefinition[];

    return factory.createObjectDefinition(services);
}

function parseFieldRuntime(document: ProtoDocument, fieldType: FieldType) {
    if (fieldType.syntaxType == SyntaxType.BaseType) {
        return {
            type: fieldType.value,
            isBaseType: true
        };
    } else if (fieldType.syntaxType == SyntaxType.Identifier) {
        return {
            type: fieldType.value,
            isBaseType: false
        };
    }

    throw new Error("unknown field type");
}


function parseServiceRuntime(document: ProtoDocument, service: ServiceDefinition) {
    const methods = service.methods;
    const methodNames = Object.keys(methods);

    const methodInfos: RawMethodDefinition[] = [];

    for (const methodName of methodNames) {
        const method = methods[methodName];
        const requestType = parseFieldRuntime(document, method.requestType);
        const responseType = parseFieldRuntime(document, method.responseType);

        methodInfos.push({
            name: methodName,
            fullName: method.fullName ?? `.${service.name}.${methodName}`,
            request: requestType,
            response: responseType
        })
    }

    const serviceInfo: RawServiceDefinition = {
        name: service.name,
        fullName: service.fullName ?? `.${service.name}`,
        methods: methodInfos
    };

    return serviceInfo;
}

function parseServicesRuntime(proto: ProtoDocument) {
    const nested = proto.root.nested ?? {};
    const keys = Object.keys(nested);

    const services = keys.map(key => {
        const node = nested[key];
        if (node.syntaxType == SyntaxType.ServiceDefinition) {
            return parseServiceRuntime(proto, node as ServiceDefinition);
        }

        return null;
    }).filter(x => !!x) as RawServiceDefinition[];

    return services;
}

export macro function proto(this: FunctionMacro, _protoPath: string): void {
    this.transform(({ node, sourceFile, factory }) => {
        const protoPathArg = node.arguments[0]!;
        if (!isStringLiteral(protoPathArg)) {
            throw new Error("protoPath must be a string literal");
        }

        const realtiveProtoPath = protoPathArg.text;
        const protoPath = Path.resolve(Path.dirname(sourceFile.fileName), realtiveProtoPath);
        const protoContent = Fs.readFileSync(protoPath, "utf8");

        const ast = parseProto(protoContent);

        if (ast.syntaxType !== SyntaxType.ProtoDocument) {
            throw new Error(`Proto error: Line ${ast.line}: ${ast.message}`);
        }

        const services = parseServicesRuntime(ast);

        node.replace(
            getGlobalInvokeExpression(factory, "raw_proto", [
                factory.createIdentifier("__dirname"),
                factory.createStringLiteral(realtiveProtoPath),
                factory.createStringLiteral(JSON.stringify(services))
            ])
        );
    });

    this.check(({ node, sourceFile, diagnostic, factory }) => {
        const protoPathArg = node.arguments[0]!;
        if (!isStringLiteral(protoPathArg)) {
            return diagnostic("error", "protoPath must be a string literal", protoPathArg);
        }

        const realtiveProtoPath = protoPathArg.text;
        const protoPath = Path.resolve(Path.dirname(sourceFile.fileName), realtiveProtoPath);
        const protoContent = Fs.readFileSync(protoPath, "utf8");

        const ast = parseProto(protoContent);

        if (ast.syntaxType !== SyntaxType.ProtoDocument) {
            diagnostic("error", `Proto error: Line ${ast.line}: ${ast.message}`);
            return factory.createIntrinsicDefinition(IntrinsicTypes.Never);
        }

        try {
            const servicesType = parseServicesType(factory, ast);

            return servicesType;
        } catch (ex) {
            if (ex instanceof Error) {
                diagnostic("error", `Proto error: ${ex.message}`);
                return factory.createIntrinsicDefinition(IntrinsicTypes.Never);
            }
        }
    });

}
