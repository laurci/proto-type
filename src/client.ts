import { debug } from "./meta/debug";
import protobuf, { RPCImpl } from "protobufjs";

export type ClientService<T> = {
    [k in keyof T as T[k] extends { request: unknown, response: unknown } ? k : never]: T[k] extends { request: infer R, response: infer S } ? (request: R) => Promise<S> : never;
}

export type Client<T> = {
    [k in keyof T]: ClientService<T[k]>;
}


export interface RawMethodDefinition {
    name: string;
    fullName: string;
    request: {
        type: string;
        isBaseType: boolean;
    };
    response: {
        type: string;
        isBaseType: boolean;
    };
}

export interface RawServiceDefinition {
    name: string;
    fullName: string;
    methods: RawMethodDefinition[];
}

export interface RawProtoDefinition {
    path: string;
    services: RawServiceDefinition[]
}


export function client<T>(proto: T): Client<T> {
    const rawProto = proto as unknown as RawProtoDefinition;

    const protoInstance = protobuf.loadSync(rawProto.path);

    const fullClient: Record<string, unknown> = {};
    for (const service of rawProto.services) {
        const serviceClient: Record<string, (request: Record<string, any>) => Promise<unknown>> = {};
        for (const method of service.methods) {
            const requestTypeInstance = !method.request.isBaseType ? protoInstance.lookupType(method.request.type) : new protobuf.Type(method.request.type);
            const responseTypeInstance = !method.response.isBaseType ? protoInstance.lookupType(method.response.type) : new protobuf.Type(method.response.type);

            serviceClient[method.name] = async (request: Record<string, any>) => {
                const reqBuff = requestTypeInstance.encode(requestTypeInstance.create(request)).finish();

                // TODO: send the request;

                const respBuff = responseTypeInstance.encode(responseTypeInstance.create({
                    message: `hello!`
                })).finish();

                const response = responseTypeInstance.decode(respBuff);

                debug!(service.name, method.name, request, response);

                return response;
            }
        }

        fullClient[service.name] = serviceClient;
    }

    return fullClient as unknown as Client<T>;
}
