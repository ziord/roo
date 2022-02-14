"use strict";

const readline = require("readline");
const { VM } = require("../vm/vm");
const vmApi = require("../vm/api");
const utils = require("../utils");

function showWelcome(version) {
    let msg = `Welcome to Roo v${version}.\n`;
    msg += "Type \":?help\" for more information.";
    console.log(msg);
}

function showHelp() {
    const msg = "Press Ctrl+C to exit the REPL";
    console.log(msg);
}

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

function isReplCommand(src) {
    src = src.trim();
    const predefineCommands = { ":?help": showHelp };
    if (!(src in predefineCommands)) {
        return false;
    }
    predefineCommands[src]();
    return true;
}

function inspectLine(line, mlStrStart, inMLString, inMLComment, depth) {
    let ch = null;
    for (let i = 0; i < line.length; ++i) {
        ch = line[i];
        if ((ch === '"' || ch === "'") && !inMLComment) {
            if (!mlStrStart) {
                mlStrStart = ch;
                inMLString = !inMLString;
            } else if (mlStrStart === ch) {
                inMLString = !inMLString;
                mlStrStart = null;
            }
        } else if (inMLString) {
            void 0;
        } else if (ch === "{" && !inMLComment) {
            depth++;
        } else if (ch === "}" && !inMLComment) {
            depth--;
        } else if (ch === "(" && !inMLComment) {
            depth++;
        } else if (ch === ")" && !inMLComment) {
            depth--;
        } else if (ch === "/" && line[i + 1] === "*") {
            inMLComment = true;
            i += 1;
        } else if (ch === "*" && line[i + 1] === "/") {
            inMLComment = false;
            i += 1;
        }
    }
    return [inMLString, inMLComment, mlStrStart, depth < 0 ? 0 : depth];
}

function execute(src, interned, rmodule, vm) {
    const [fnObj, compiler] = vmApi.compileSourceCodeFromRepl(
        src,
        interned,
        rmodule
    );
    interned = compiler.strings;
    if (vm) {
        vm.initFrom(fnObj);
    } else {
        vm = new VM(fnObj, false, interned, true);
    }
    if (vm.interpret() !== vm.iOK()) {
        // clear the error state, as this will prevent the VM from being
        // re-used (newer instructions will not be executed) if not cleared.
        vm.clearError();
    }
    return [vm, interned, compiler.module];
}

function repl(roo_version) {
    const cons = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    let src = "",
        depth = 0,
        inMLComment = false,
        inMLString = false,
        mlStrStart = null,
        interned = null,
        rmodule = null,
        vm = null;

    showWelcome(roo_version);
    showPrompt(cons, depth);

    cons.on("line", (line) => {
        [inMLString, inMLComment, mlStrStart, depth] = inspectLine(
            line,
            mlStrStart,
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
            // return if there's still a block depth
            if (depth) {
                showPrompt(cons, depth);
                return;
            }
        } else if (depth) {
            showPrompt(cons, depth);
            return;
        }
        if (!isReplCommand(src)) {
            // we make sure to reuse `interned` and `rmodule` objects so that they
            // won't be created again and again for every `src` execution.
            [vm, interned, rmodule] = execute(src, interned, rmodule, vm);
        }
        showPrompt(cons, depth);
        src = "";
    });

    cons.on("close", () => {
        utils.exit(0);
    });
}

module.exports = { repl };
