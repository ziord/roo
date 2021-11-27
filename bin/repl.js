"use strict";

const readline = require("readline");
const { VM } = require("../vm/vm");
const vmApi = require("../vm/api");
const utils = require("../utils");

function showPrompt(cons, depth) {
    let prompt;
    if (depth) {
        prompt = "...";
        for (let i = 0; i < depth; ++i) prompt += "..";
        prompt += " ";
    } else {
        prompt = ">>> ";
    }
    cons.setPrompt(prompt);
    cons.prompt();
}

function execute(src, interned, vm) {
    const [fnObj, compiler] = vmApi.compileSourceCodeFromRepl(src, interned);
    if (vm) {
        vm.initFrom(fnObj);
    } else {
        vm = new VM(fnObj, false, compiler.strings, true);
    }
    if (vm.run() !== vm.iOK()) {
        // clear the error state, as this will prevent the VM from being
        // re-used (newer instructions will not be executed) if not cleared.
        vm.clearError();
    }
    return [vm, compiler.strings];
}

function repl() {
    const cons = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    let src = "",
        depth = 0,
        inMLComment = false,
        interned = null,
        vm = null;

    showPrompt(cons, depth);

    cons.on("line", (line) => {
        for (let i = 0; i < line.length; ++i) {
            let ch = line[i];
            if (ch === "{" && !inMLComment) depth++;
            else if (ch === "}" && !inMLComment) depth--;
            else if (ch === "/" && line[i + 1] === "*") {
                inMLComment = true;
                i += 1;
            } else if (ch === "*" && line[i + 1] === "/") {
                inMLComment = false;
                i += 1;
            }
        }
        src += line + "\n";
        if (inMLComment) {
            // display the prompt using the current depth,
            // if available or a depth of 1
            showPrompt(cons, depth || 1);
            return;
        } else if (line.endsWith("{")) {
            showPrompt(cons, depth);
            return;
        } else if (line.endsWith("}")) {
            showPrompt(cons, depth);
            // return if there's still a block depth
            if (depth) return;
        } else if (depth) {
            showPrompt(cons, depth);
            return;
        }
        [vm, interned] = execute(src, interned, vm);
        showPrompt(cons, depth);
        src = "";
    });

    cons.on("close", () => {
        utils.exit(0);
    });
}

module.exports = { repl };
