import "./node-globals";

import { client } from "./client";
import { proto } from "./meta/proto";
import { debug } from "./meta/debug";

console.log("hello world!");

const cl = client(proto!("../test.proto"));

async function main() {
    const { message } = await cl.Hello.say({
        firstName: "John",
        lastName: "Doe"
    });

    debug!(message);
}

main();
