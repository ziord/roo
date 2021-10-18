/*
 * debug.js
 *
 */

"use strict";

const opcode = require("./opcode");
const {out, print} = require("./utils");
const pad = 24;

function Disassembler(func, showSrcLines=false) {
    this.code = func.code;
    this.name = func.name;
    this.showSrcLines = showSrcLines;
}

Disassembler.prototype.readShort = function (index){
    const first = this.code.bytes[++index];
    const second = this.code.bytes[++index];
    return ((first << 8) | second);
};

Disassembler.prototype.plainInstruction = (inst, index) => {
    print(inst);
    return ++index;
};

Disassembler.prototype.constantInstruction = function (inst, index) {
    // op args o1..o2 next-op
    const operandIdx = this.readShort(index);
    const operand = this.code.cp.pool[operandIdx]; // Value obj
    print(inst.padEnd(pad, " "), "\t",
        `${operandIdx}`.padStart(4, ' '), "\t",
        `(${operand})`);  // implicit toString()
    return index + 3; // next-op
};

Disassembler.prototype.byteInstruction = function (inst, index){
    const operand = this.code.bytes[++index];
    print(inst.padEnd(pad, " "), "\t", `${operand}`.padStart(4, ' '));
    return ++index;
};

Disassembler.prototype.shortInstruction = function (inst, index){
    const operand = this.readShort(index);
    print(inst.padEnd(pad, " "), "\t", `${operand}`.padStart(4, ' '));
    return index + 3;
};

Disassembler.prototype.jumpInstruction = function (inst, index, sign){
    // op_jmp  10 -> 5
    const jmpOffset = this.readShort(index);
    // sign -> +1 or -1 (useful for loop instruction)
    let jmpIndex = index + 3 + jmpOffset * sign;
    print(inst.padEnd(pad, " "), "\t",
        index.toString().padStart(4, " "), "->",
        jmpIndex);
    return index + 3;
};

Disassembler.prototype.disassembleInstruction = function(index, code) {
    code !== undefined ? this.code = code : void 0;
    if (this.showSrcLines){
        const srcLine = this.code.srcLines[index];
        if (srcLine !== 0xff){
            const lineNum = this.code.lines[index];
            print(`\n<line: ${lineNum}>\t${srcLine}`);
        }
    }
    const byteIndex = "\t" + index.toString().padStart(4, "0") + "\t";
    if (this.code.lines[index - 1] === this.code.lines[index]) {
        out("   |" + byteIndex);
    } else {
        out(`${this.code.lines[index]}`.padStart(4, " ") + byteIndex);
    }
    const byte = this.code.bytes[index];
    switch (byte) {
        case opcode.OP_ADD:
            return this.plainInstruction("OP_ADD", index);
        case opcode.OP_SUBTRACT:
            return this.plainInstruction("OP_SUBTRACT", index);
        case opcode.OP_MULTIPLY:
            return this.plainInstruction("OP_MULTIPLY", index);
        case opcode.OP_DIVIDE:
            return this.plainInstruction("OP_DIVIDE", index);
        case opcode.OP_RETURN:
            return this.plainInstruction("OP_RETURN", index);
        case opcode.OP_LOAD_FALSE:
            return this.plainInstruction("OP_LOAD_FALSE", index);
        case opcode.OP_LOAD_TRUE:
            return this.plainInstruction("OP_LOAD_TRUE", index);
        case opcode.OP_LOAD_NULL:
            return this.plainInstruction("OP_LOAD_NULL", index);
        case opcode.OP_LOAD_CONST:
            return this.constantInstruction("OP_LOAD_CONST", index);
        case opcode.OP_BW_INVERT:
            return this.plainInstruction("OP_BW_INVERT", index);
        case opcode.OP_POSITIVE:
            return this.plainInstruction("OP_POSITIVE", index);
        case opcode.OP_NOT:
            return this.plainInstruction("OP_NOT", index);
        case opcode.OP_NEGATE:
            return this.plainInstruction("OP_NEGATE", index);
        case opcode.OP_GREATER:
            return this.plainInstruction("OP_GREATER", index);
        case opcode.OP_LESS:
            return this.plainInstruction("OP_LESS", index);
        case opcode.OP_GREATER_OR_EQUAL:
            return this.plainInstruction("OP_GREATER_OR_EQUAL", index);
        case opcode.OP_LESS_OR_EQUAL:
            return this.plainInstruction("OP_LESS_OR_EQUAL", index);
        case opcode.OP_EQUAL:
            return this.plainInstruction("OP_EQUAL", index);
        case opcode.OP_NOT_EQUAL:
            return this.plainInstruction("OP_NOT_EQUAL", index);
        case opcode.OP_BW_LSHIFT:
            return this.plainInstruction("OP_BW_LSHIFT", index);
        case opcode.OP_BW_RSHIFT:
            return this.plainInstruction("OP_BW_RSHIFT", index);
        case opcode.OP_POW:
            return this.plainInstruction("OP_POW", index);
        case opcode.OP_MOD:
            return this.plainInstruction("OP_MOD", index);
        case opcode.OP_BW_AND:
            return this.plainInstruction("OP_BW_AND", index);
        case opcode.OP_BW_OR:
            return this.plainInstruction("OP_BW_OR", index);
        case opcode.OP_BW_XOR:
            return this.plainInstruction("OP_BW_XOR", index);
        case opcode.OP_SHOW:
            return this.byteInstruction("OP_SHOW", index);
        case opcode.OP_BUILD_LIST:
            return this.shortInstruction("OP_BUILD_LIST", index);
        case opcode.OP_BUILD_DICT:
            return this.shortInstruction("OP_BUILD_DICT", index);
        case opcode.OP_BUILD_RANGE:
            return this.plainInstruction("OP_BUILD_RANGE", index);
        case opcode.OP_SUBSCRIPT:
            return this.plainInstruction("OP_SUBSCRIPT", index);
        case opcode.OP_SET_SUBSCRIPT:
            return this.plainInstruction("OP_SET_SUBSCRIPT", index);
        case opcode.OP_POP:
            return this.plainInstruction("OP_POP", index);
        case opcode.OP_DEFINE_GLOBAL:
            return this.constantInstruction("OP_DEFINE_GLOBAL", index);
        case opcode.OP_SET_GLOBAL:
            return this.shortInstruction("OP_SET_GLOBAL", index);
        case opcode.OP_GET_GLOBAL:
            return this.constantInstruction("OP_GET_GLOBAL", index);
        case opcode.OP_DEC:
            return this.plainInstruction("OP_DEC", index);
        case opcode.OP_SWAP_TWO:
            return this.plainInstruction("OP_SWAP_TWO", index);
        case opcode.OP_INC:
            return this.plainInstruction("OP_INC", index);
        case opcode.OP_GET_LOCAL:
            return this.shortInstruction("OP_GET_LOCAL", index);
        case opcode.OP_SET_LOCAL:
            return this.shortInstruction("OP_SET_LOCAL", index);
        case opcode.OP_DEFINE_LOCAL:
            return this.shortInstruction("OP_DEFINE_LOCAL", index);
        case opcode.OP_FORMAT:
            return this.shortInstruction("OP_FORMAT", index);
        case opcode.OP_JUMP:
            return this.jumpInstruction("OP_JUMP", index, +1);
        case opcode.OP_JUMP_IF_FALSE:
            return this.jumpInstruction("OP_JUMP_IF_FALSE", index, +1);
        case opcode.OP_JUMP_IF_FALSE_OR_POP:
            return this.jumpInstruction("OP_JUMP_IF_FALSE_OR_POP", index, +1);
        case opcode.OP_LOOP:
            return this.jumpInstruction("OP_LOOP", index, -1);
        case opcode.OP_POP_N:
            return this.shortInstruction("OP_POP_N", index);
        case opcode.OP_CALL:
            return this.byteInstruction("OP_CALL", index);
        default:
            return this.plainInstruction("OP_UNKNOWN", index);
    }
};

Disassembler.prototype.getInstructionOffset = function (index){
    const byte = this.code.bytes[index];
    switch (byte) {
        case opcode.OP_ADD:
        case opcode.OP_SUBTRACT:
        case opcode.OP_MULTIPLY:
        case opcode.OP_DIVIDE:
        case opcode.OP_RETURN:
        case opcode.OP_LOAD_FALSE:
        case opcode.OP_LOAD_TRUE:
        case opcode.OP_LOAD_NULL:
        case opcode.OP_BW_INVERT:
        case opcode.OP_POSITIVE:
        case opcode.OP_NOT:
        case opcode.OP_NEGATE:
        case opcode.OP_GREATER:
        case opcode.OP_LESS:
        case opcode.OP_GREATER_OR_EQUAL:
        case opcode.OP_LESS_OR_EQUAL:
        case opcode.OP_EQUAL:
        case opcode.OP_NOT_EQUAL:
        case opcode.OP_BW_LSHIFT:
        case opcode.OP_BW_RSHIFT:
        case opcode.OP_POW:
        case opcode.OP_MOD:
        case opcode.OP_BW_AND:
        case opcode.OP_BW_OR:
        case opcode.OP_BW_XOR:
        case opcode.OP_BUILD_RANGE:
        case opcode.OP_SUBSCRIPT:
        case opcode.OP_SET_SUBSCRIPT:
        case opcode.OP_POP:
        case opcode.OP_DEC:
        case opcode.OP_SWAP_TWO:
        case opcode.OP_INC:
            return (index + 1);
        case opcode.OP_SHOW:
        case opcode.OP_CALL:
            return (index + 2);
        case opcode.OP_DEFINE_GLOBAL:
        case opcode.OP_LOAD_CONST:
        case opcode.OP_GET_GLOBAL:
        case opcode.OP_BUILD_LIST:
        case opcode.OP_BUILD_DICT:
        case opcode.OP_SET_GLOBAL:
        case opcode.OP_GET_LOCAL:
        case opcode.OP_SET_LOCAL:
        case opcode.OP_DEFINE_LOCAL:
        case opcode.OP_FORMAT:
        case opcode.OP_POP_N:
        case opcode.OP_JUMP:
        case opcode.OP_JUMP_IF_FALSE:
        case opcode.OP_JUMP_IF_FALSE_OR_POP:
        case opcode.OP_LOOP:
            return (index + 3);
        default:
            return this.plainInstruction("OP_UNKNOWN", index);
    }
};

Disassembler.prototype.disassembleCode = function () {
    print(`==Disassembly of ${this.name ? this.name : "script"}==`);
    for (let index = 0; index < this.code.length; ) {
        index = this.disassembleInstruction(index);
    }
    out("\n");
    // disassemble functions found earlier
    for (let index = 0; index < this.code.length; ) {
        if (this.code.bytes[index] === opcode.OP_LOAD_CONST){
            const c = this.code.cp.readConstant(this.readShort(index));
            if (c.isFunction()){
                const dis = new Disassembler(c.asFunction(), this.showSrcLines);
                dis.disassembleCode();
            }
        }
        index = this.getInstructionOffset(index);
    }
};

exports.Disassembler = Disassembler;