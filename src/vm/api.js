"use strict";

const { VM } = require("./vm");
const { Disassembler } = require("../debug/disassembler");
const { parseSourceInternal } = require("../parser/parser");
const { Compiler } = require("../compiler/compiler");

exports.compileSourceCodeFromRepl = function(src, interned, rmodule) {
    const [root, parser] = parseSourceInternal(src, "repl");
    const compiler = new Compiler(parser, rmodule);
    return [compiler.compile(root, interned), compiler];
};

exports.compileSourceCode = function(src, fpath = null) {
    const [root, parser] = parseSourceInternal(src, fpath);
    if (parser.parsingFailed()) return null;
    const compiler = new Compiler(parser);
    return [compiler.compile(root), compiler];
};

exports.runSourceCode = function(src, fpath = null) {
    const result = exports.compileSourceCode(src, fpath);
    if (!result) return null;
    const [fnObj, compiler] = result;
    const vm = new VM(fnObj, false, compiler.strings);
    return vm.interpret();
};

exports.disSourceCode = function(src, fpath = null) {
    const  result = exports.compileSourceCode(src, fpath);
    if (!result) return;
    const [fnObj] = result;
    const dis = new Disassembler(fnObj, true);
    dis.disassembleCode();
};
