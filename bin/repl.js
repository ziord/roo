"use strict";

const readline = require("readline");
const { VM } = require("../vm/vm");
const vmApi = require("../vm/api");
const utils = require("../utils");

function repl() {
    let vm = null;
    const console = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.setPrompt(">>> ");
    console.prompt();
    console.on("close", () => {
        utils.exit(0);
    });
    console.on("line", (line) => {
        const [fnObj, compiler] = vmApi.compileSourceCode(line);
        if (vm) {
            vm.initFrom(fnObj);  // todo: update
        } else {
            vm = new VM(fnObj, false, compiler.strings);
        }
        vm.run();
        console.prompt();
    });
}

module.exports = { repl };
