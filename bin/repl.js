"use strict";

const readline = require("readline");
const { VM } = require("../vm/vm");
const vmApi = require("../vm/api");
const utils = require("../utils");

function showPrompt(cons, depth) {
    let prompt;
    if (depth) {
        prompt = "...";
        for (let i = 0; i < depth - 1; ++i) prompt += "..";
        prompt += " ";
    } else {
        prompt = ">> ";
    }
    cons.setPrompt(prompt);
    cons.prompt();
}

function inspectLine(line, inMLString, inMLComment, depth) {
    let strStart = null,
        ch = null;
    for (let i = 0; i < line.length; ++i) {
        ch = line[i];
        if ((ch === '"' || ch === "'") && !inMLComment) {
            if (strStart) {
                if (strStart === ch) {
                    inMLString = !inMLString;
                    strStart = null;
                }
            } else {
                strStart = ch;
                inMLString = !inMLString;
            }
        } else if (inMLString) {
            void 0;
        } else if (ch === "{" && !inMLComment) {
            depth++;
        } else if (ch === "}" && !inMLComment) {
            depth--;
        } else if (ch === "/" && line[i + 1] === "*") {
            inMLComment = true;
            i += 1;
        } else if (ch === "*" && line[i + 1] === "/") {
            inMLComment = false;
            i += 1;
        }
    }
    return [inMLString, inMLComment, (depth < 0 ? 0 : depth)];
}

function execute(src, interned, vm) {
    const [fnObj, compiler] = vmApi.compileSourceCodeFromRepl(src, interned);
    interned = compiler.strings;
    if (vm) {
        vm.initFrom(fnObj);
    } else {
        vm = new VM(fnObj, false, interned, true); // todo
    }
    if (vm.run() !== vm.iOK()) {
        // clear the error state, as this will prevent the VM from being
        // re-used (newer instructions will not be executed) if not cleared.
        vm.clearError();
    }
    return [vm, interned];
}

function repl() {
    const cons = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    let src = "",
        depth = 0,
        inMLComment = false,
        inMLString = false,
        interned = null,
        vm = null;

    showPrompt(cons, depth);

    cons.on("line", (line) => {
        [inMLString, inMLComment, depth] = inspectLine(
            line,
            inMLString,
            inMLComment,
            depth
        );
        src += line + "\n";
        if (inMLComment || inMLString) {
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
