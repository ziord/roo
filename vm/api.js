"use strict";

const { VM } = require("../vm/vm");
const { Disassembler } = require("../debug/disassembler");
const { parseSourceInternal } = require("../parser/parser");
const { Compiler } = require("../compiler/compiler");

exports.compileSourceCode = function(src) {
    const [root, parser] = parseSourceInternal(src);
    const compiler = new Compiler(parser);
    return [compiler.compile(root), compiler];
};

exports.compileSourceCodeFromRepl = function(src, interned) {
    const [root, parser] = parseSourceInternal(src);
    const compiler = new Compiler(parser);
    return [compiler.compile(root, interned), compiler];
};

exports.runSourceCode = function(src) {
    const [fnObj, compiler] = exports.compileSourceCode(src);
    const vm = new VM(fnObj, false, compiler.strings);
    return vm.run();
};

exports.disSourceCode = function(src) {
    const  [fnObj] = exports.compileSourceCode(src);
    const dis = new Disassembler(fnObj, true);
    dis.disassembleCode();
};
