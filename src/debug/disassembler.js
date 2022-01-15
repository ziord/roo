/*
 * disassembler.js
 *
 */

"use strict";

const opcode = require("../code/opcode");
const { out, print } = require("../utils");
const pad = 24;
const tab = "    ";

function Disassembler(func, showSrcLines = false, repl = false) {
    this.func = func;
    this.code = func.code;
    this.name = func.fname;
    this.envName = repl ? "(repl)" : "(module)";
    this.showSrcLines = showSrcLines;
    this.hasSrcLines = Boolean(this.code.srcLines.length);
}

Disassembler.prototype.reset = function (func, showSrcLines = false) {
    this.func = func;
    this.code = func.code;
    this.name = func.fname;
    this.showSrcLines = showSrcLines;
    this.hasSrcLines = Boolean(this.code.srcLines.length);
};

Disassembler.prototype.readShort = function (index) {
    const first = this.code.bytes[++index];
    const second = this.code.bytes[++index];
    return (first << 8) | second;
};

Disassembler.prototype.plainInstruction = (inst, index) => {
    print(inst);
    return ++index;
};

Disassembler.prototype.constantInstruction = function (inst, index) {
    // op args o1..o2 next-op
    const operandIdx = this.readShort(index);
    const constant = this.code.cp.pool[operandIdx]; // Value obj
    print(
        inst.padEnd(pad, " "),
        tab,
        `${operandIdx}`.padStart(4, " "),
        tab,
        `(${constant})`
    ); // implicit toString()
    return index + 3; // next-op
};

Disassembler.prototype.byteInstruction = function (inst, index) {
    const operand = this.code.bytes[++index];
    print(inst.padEnd(pad, " "), tab, `${operand}`.padStart(4, " "));
    return ++index;
};

Disassembler.prototype.shortInstruction = function (inst, index) {
    const operand = this.readShort(index);
    print(inst.padEnd(pad, " "), tab, `${operand}`.padStart(4, " "));
    return index + 3;
};

Disassembler.prototype.jumpInstruction = function (inst, index, sign) {
    // op_jmp  10 -> 5
    const jmpOffset = this.readShort(index);
    // sign -> +1 or -1 (determines forward or backwards jump)
    let jmpIndex = index + 3 + jmpOffset * sign;
    print(
        inst.padEnd(pad, " "),
        tab,
        index.toString().padStart(4, " "),
        "->",
        jmpIndex
    );
    return index + 3;
};

Disassembler.prototype.closureInstruction = function (inst, index) {
    const operandIdx = this.readShort(index);
    const constant = this.code.cp.readConstant(operandIdx);
    const fnObj = constant.asFunction();
    print(
        inst.padEnd(pad, " "),
        tab,
        `${operandIdx}`.padStart(4, " "),
        tab,
        `(${constant})` // implicit toString() for `constant`
    );
    index += 3;
    for (let i = 0; i < fnObj.upvalueCount; i++) {
        const slot = this.code.bytes[index++];
        const isLocal = this.code.bytes[index++];
        print(
            "   |   ",
            (index - 2).toString().padStart(4, "0"),
            tab,
            "  | ".padEnd(pad + pad / 2 + 1, " "),
            isLocal ? "l-upvalue" : "upvalue  ",
            slot.toString().padStart(4, " ")
        );
    }
    return index;
};

Disassembler.prototype.invokeInstruction = function (inst, index) {
    const opIndex = this.readShort(index);
    index += 2;
    const opArgsCount = this.code.bytes[++index];
    const propName = this.code.cp.readConstant(opIndex);
    // implicit toString() for `propName`
    print(
        inst.padEnd(pad, " "),
        tab,
        opArgsCount.toString().padStart(4, " "),
        tab,
        `(${propName})`
    );
    return ++index;
};

Disassembler.prototype.importInstruction = function (inst, index) {
    // op args o1..o2..o3 next-op
    const operandIdx = this.readShort(index);
    const constant = this.code.cp.pool[operandIdx]; // Value obj
    index += 2;
    const isRelativeImport = this.code.bytes[++index];
    print(
        inst.padEnd(pad, " "),
        tab,
        `${operandIdx}`.padStart(4, " "),
        tab,
        `(${constant})`, // implicit toString()
        `(${isRelativeImport})`
    );
    return ++index; // next-op
};

Disassembler.prototype.disassembleInstruction = function (index, code) {
    code !== undefined ? (this.code = code) : void 0;
    if (this.showSrcLines && this.hasSrcLines) {
        const srcLine = this.code.srcLines[index];
        if (srcLine !== 0xff) {
            const lineNum = this.code.lines[index];
            print(`\n<line: ${lineNum}>${tab}${srcLine}`);
        }
    }
    const byteIndex = tab + index.toString().padStart(4, "0") + tab;
    if (this.code.lines[index - 1] === this.code.lines[index]) {
        out("   |" + byteIndex);
    } else {
        out(`${this.code.lines[index]}`.padStart(4, " ") + byteIndex);
    }
    const byte = this.code.bytes[index];
    switch (byte) {
        case opcode.$ADD:
            return this.plainInstruction("$ADD", index);
        case opcode.$SUBTRACT:
            return this.plainInstruction("$SUBTRACT", index);
        case opcode.$MULTIPLY:
            return this.plainInstruction("$MULTIPLY", index);
        case opcode.$DIVIDE:
            return this.plainInstruction("$DIVIDE", index);
        case opcode.$RETURN:
            return this.plainInstruction("$RETURN", index);
        case opcode.$LOAD_FALSE:
            return this.plainInstruction("$LOAD_FALSE", index);
        case opcode.$LOAD_TRUE:
            return this.plainInstruction("$LOAD_TRUE", index);
        case opcode.$LOAD_NULL:
            return this.plainInstruction("$LOAD_NULL", index);
        case opcode.$BW_INVERT:
            return this.plainInstruction("$BW_INVERT", index);
        case opcode.$POSITIVE:
            return this.plainInstruction("$POSITIVE", index);
        case opcode.$NOT:
            return this.plainInstruction("$NOT", index);
        case opcode.$NEGATE:
            return this.plainInstruction("$NEGATE", index);
        case opcode.$GREATER:
            return this.plainInstruction("$GREATER", index);
        case opcode.$LESS:
            return this.plainInstruction("$LESS", index);
        case opcode.$GREATER_OR_EQUAL:
            return this.plainInstruction("$GREATER_OR_EQUAL", index);
        case opcode.$LESS_OR_EQUAL:
            return this.plainInstruction("$LESS_OR_EQUAL", index);
        case opcode.$EQUAL:
            return this.plainInstruction("$EQUAL", index);
        case opcode.$NOT_EQUAL:
            return this.plainInstruction("$NOT_EQUAL", index);
        case opcode.$BW_LSHIFT:
            return this.plainInstruction("$BW_LSHIFT", index);
        case opcode.$BW_RSHIFT:
            return this.plainInstruction("$BW_RSHIFT", index);
        case opcode.$POW:
            return this.plainInstruction("$POW", index);
        case opcode.$MOD:
            return this.plainInstruction("$MOD", index);
        case opcode.$BW_AND:
            return this.plainInstruction("$BW_AND", index);
        case opcode.$BW_OR:
            return this.plainInstruction("$BW_OR", index);
        case opcode.$BW_XOR:
            return this.plainInstruction("$BW_XOR", index);
        case opcode.$SUBSCRIPT:
            return this.plainInstruction("$SUBSCRIPT", index);
        case opcode.$SET_SUBSCRIPT:
            return this.plainInstruction("$SET_SUBSCRIPT", index);
        case opcode.$POP:
            return this.plainInstruction("$POP", index);
        case opcode.$BUILD_RANGE:
            return this.plainInstruction("$BUILD_RANGE", index);
        case opcode.$DEC:
            return this.plainInstruction("$DEC", index);
        case opcode.$INC:
            return this.plainInstruction("$INC", index);
        case opcode.$METHOD:
            return this.plainInstruction("$METHOD", index);
        case opcode.$DERIVE:
            return this.plainInstruction("$DERIVE", index);
        case opcode.$POP_EXCEPT:
            return this.plainInstruction("$POP_EXCEPT", index);
        case opcode.$PANIC:
            return this.plainInstruction("$PANIC", index);
        case opcode.$INSTOF:
            return this.plainInstruction("$INSTOF", index);
        case opcode.$SHOW:
            return this.byteInstruction("$SHOW", index);
        case opcode.$CALL:
            return this.byteInstruction("$CALL", index);
        case opcode.$CALL_UNPACK:
            return this.byteInstruction("$CALL_UNPACK", index);
        case opcode.$GET_UPVALUE:
            return this.byteInstruction("$GET_UPVALUE", index);
        case opcode.$SET_UPVALUE:
            return this.byteInstruction("$SET_UPVALUE", index);
        case opcode.$BUILD_LIST:
            return this.shortInstruction("$BUILD_LIST", index);
        case opcode.$BUILD_LIST_UNPACK:
            return this.shortInstruction("$BUILD_LIST_UNPACK", index);
        case opcode.$BUILD_DICT:
            return this.shortInstruction("$BUILD_DICT", index);
        case opcode.$GET_LOCAL:
            return this.shortInstruction("$GET_LOCAL", index);
        case opcode.$SET_LOCAL:
            return this.shortInstruction("$SET_LOCAL", index);
        case opcode.$SET_PROPERTY:
            return this.shortInstruction("$SET_PROPERTY", index);
        case opcode.$GET_PROPERTY:
            return this.shortInstruction("$GET_PROPERTY", index);
        case opcode.$GET_DEREF_PROPERTY:
            return this.shortInstruction("$GET_DEREF_PROPERTY", index);
        case opcode.$DEFINE_LOCAL:
            return this.shortInstruction("$DEFINE_LOCAL", index);
        case opcode.$FORMAT:
            return this.shortInstruction("$FORMAT", index);
        case opcode.$SET_GLOBAL:
            return this.shortInstruction("$SET_GLOBAL", index);
        case opcode.$POP_N:
            return this.shortInstruction("$POP_N", index);
        case opcode.$DEF:
            return this.shortInstruction("$DEF", index);
        case opcode.$SETUP_EXCEPT:
            return this.shortInstruction("$SETUP_EXCEPT", index);
        case opcode.$LOAD_CONST:
            return this.constantInstruction("$LOAD_CONST", index);
        case opcode.$DEFINE_GLOBAL:
            return this.constantInstruction("$DEFINE_GLOBAL", index);
        case opcode.$GET_GLOBAL:
            return this.constantInstruction("$GET_GLOBAL", index);
        case opcode.$JUMP:
            return this.jumpInstruction("$JUMP", index, +1);
        case opcode.$JUMP_IF_FALSE:
            return this.jumpInstruction("$JUMP_IF_FALSE", index, +1);
        case opcode.$JUMP_IF_FALSE_OR_POP:
            return this.jumpInstruction("$JUMP_IF_FALSE_OR_POP", index, +1);
        case opcode.$LOOP:
            return this.jumpInstruction("$LOOP", index, -1);
        case opcode.$CLOSURE:
            return this.closureInstruction("$CLOSURE", index);
        case opcode.$INVOKE:
            return this.invokeInstruction("$INVOKE", index);
        case opcode.$INVOKE_DEREF:
            return this.invokeInstruction("$INVOKE_DEREF", index);
        case opcode.$INVOKE_DEREF_UNPACK:
            return this.invokeInstruction("$INVOKE_DEREF_UNPACK", index);
        case opcode.$IMPORT_MODULE:
            return this.importInstruction("$IMPORT_MODULE", index);
        default:
            return this.plainInstruction("OP_UNKNOWN", index);
    }
};

Disassembler.prototype.getInstructionOffset = function (index) {
    const byte = this.code.bytes[index];
    switch (byte) {
        case opcode.$ADD:
        case opcode.$SUBTRACT:
        case opcode.$MULTIPLY:
        case opcode.$DIVIDE:
        case opcode.$RETURN:
        case opcode.$LOAD_FALSE:
        case opcode.$LOAD_TRUE:
        case opcode.$LOAD_NULL:
        case opcode.$BW_INVERT:
        case opcode.$POSITIVE:
        case opcode.$NOT:
        case opcode.$NEGATE:
        case opcode.$GREATER:
        case opcode.$LESS:
        case opcode.$GREATER_OR_EQUAL:
        case opcode.$LESS_OR_EQUAL:
        case opcode.$EQUAL:
        case opcode.$NOT_EQUAL:
        case opcode.$BW_LSHIFT:
        case opcode.$BW_RSHIFT:
        case opcode.$POW:
        case opcode.$MOD:
        case opcode.$BW_AND:
        case opcode.$BW_OR:
        case opcode.$BW_XOR:
        case opcode.$BUILD_RANGE:
        case opcode.$SUBSCRIPT:
        case opcode.$SET_SUBSCRIPT:
        case opcode.$POP:
        case opcode.$DEC:
        case opcode.$INC:
        case opcode.$METHOD:
        case opcode.$DERIVE:
        case opcode.$POP_EXCEPT:
        case opcode.$PANIC:
        case opcode.$INSTOF:
            return index + 1;
        case opcode.$SHOW:
        case opcode.$CALL:
        case opcode.$CALL_UNPACK:
        case opcode.$GET_UPVALUE:
        case opcode.$SET_UPVALUE:
            return index + 2;
        case opcode.$DEFINE_GLOBAL:
        case opcode.$LOAD_CONST:
        case opcode.$GET_GLOBAL:
        case opcode.$BUILD_LIST:
        case opcode.$BUILD_LIST_UNPACK:
        case opcode.$BUILD_DICT:
        case opcode.$SET_GLOBAL:
        case opcode.$GET_LOCAL:
        case opcode.$SET_LOCAL:
        case opcode.$DEFINE_LOCAL:
        case opcode.$FORMAT:
        case opcode.$POP_N:
        case opcode.$JUMP:
        case opcode.$JUMP_IF_FALSE:
        case opcode.$JUMP_IF_FALSE_OR_POP:
        case opcode.$LOOP:
        case opcode.$DEF:
        case opcode.$GET_PROPERTY:
        case opcode.$SET_PROPERTY:
        case opcode.$GET_DEREF_PROPERTY:
        case opcode.$SETUP_EXCEPT:
            return index + 3;
        case opcode.$CLOSURE:
            // 2 bytes per 'upvalue'
            return index + 3 + this.func.upvalues.length * 2;
        case opcode.$INVOKE:
        case opcode.$INVOKE_DEREF:
        case opcode.$INVOKE_DEREF_UNPACK:
        case opcode.$IMPORT_MODULE:
            return index + 4;
        default:
            return this.plainInstruction("OP_UNKNOWN", index);
    }
};

Disassembler.prototype.disassembleCode = function () {
    print(`==Disassembly of ${this.name ? this.name.raw : this.envName}==`);
    for (let index = 0; index < this.code.length; ) {
        index = this.disassembleInstruction(index);
    }
    out("\n");
    // disassemble functions found earlier
    for (let index = 0; index < this.code.length; ) {
        if (this.code.bytes[index] === opcode.$CLOSURE) {
            const c = this.code.cp.readConstant(this.readShort(index));
            if (c.isFunction()) {
                // todo: find a better way of handling this
                const dis = new Disassembler(c.asFunction(), this.showSrcLines);
                dis.disassembleCode();
            }
        }
        // next instruction offset
        index = this.getInstructionOffset(index);
    }
};

exports.Disassembler = Disassembler;
