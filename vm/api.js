"use strict";

const { VM } = require("../vm/vm");
const { Disassembler } = require("../debug/disassembler");
const { parseSourceInternal } = require("../parser/parser");
const { Compiler } = require("../compiler/compiler");

exports.compileSourceCode = function(src) {
    let [root, parser] = parseSourceInternal(src);
    let compiler = new Compiler(parser);
    return [compiler.compile(root), compiler];
};

exports.runSourceCode = function(src) {
    const [fnObj, compiler] = compileSourceCode(src);
    const vm = new VM(fnObj, false, compiler.strings);
    return vm.run();
};

exports.disSourceCode = function(src) {
    const  [fnObj] = compileSourceCode(src);
    const dis = new Disassembler(fnObj, true);
    dis.disassembleCode();
};
