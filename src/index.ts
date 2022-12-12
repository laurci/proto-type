import { bootstrap as bootstrapUtils } from "utils";
bootstrapUtils({
    all: true
});

import { bootstrap } from "./lib";
bootstrap();

import { debug } from "utils/debug";

import { client } from "./client";
import { proto } from "./meta/proto";

const cl = client(proto!("../test.proto"));

async function main() {
    const { message } = await cl.Hello.say({
        firstName: "John",
        lastName: "Doe"
    });

    debug!(message);
}

main();
