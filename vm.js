/*
 * Roo.js Bytecode Virtual Machine
 *
 */

"use strict";

const {
    Value,
    ConstantPool,
    VAL_INT,
    VAL_FLOAT,
    VAL_BOOLEAN,
    VAL_NULL,
    VAL_OBJECT,
    VAL_STRING,
    VAL_LIST,
    VAL_DICT,
    VAL_FUNCTION
} = require("./value");
const {
    Code,
    OP_ADD,
    OP_SUBTRACT,
    OP_MULTIPLY,
    OP_DIVIDE,
    OP_RETURN,
    OP_LOAD_CONST,
    OP_LOAD_NULL,
    OP_LOAD_TRUE,
    OP_LOAD_FALSE,
    OP_POSITIVE,
    OP_NEGATE,
    OP_BW_INVERT,
    OP_NOT,
    OP_GREATER,
    OP_LESS,
    OP_GREATER_OR_EQUAL,
    OP_LESS_OR_EQUAL,
    OP_EQUAL,
    OP_NOT_EQUAL,
    OP_BW_LSHIFT,
    OP_BW_RSHIFT,
    OP_POW,
    OP_MOD,
    OP_BW_AND,
    OP_BW_OR,
    OP_BW_XOR,
    OP_SHOW,
    OP_BUILD_LIST,
    OP_BUILD_RANGE,
    OP_SUBSCRIPT,
    OP_POP,
    OP_DEFINE_GLOBAL,
    OP_GET_GLOBAL,
    OP_SET_GLOBAL,
    OP_SET_SUBSCRIPT,
    OP_INC,
    OP_DEC,
    OP_DEFINE_LOCAL,
    OP_GET_LOCAL,
    OP_SET_LOCAL,
    OP_FORMAT,
    OP_JUMP,
    OP_JUMP_IF_FALSE,
    OP_LOOP,
    OP_POP_N,
    OP_JUMP_IF_FALSE_OR_POP,
    OP_SWAP_TWO,
    OP_BUILD_DICT,
    OP_CALL,
} = require("./opcode");
const { Disassembler } = require("./debug");
const { assert, out, print, unreachable, exitVM } = require("./utils");
const INTERPRET_RESULT_OK = 0, INTERPRET_RESULT_ERROR = 1;
const FRAME_STACK_SIZE = 0x1000;
const MAX_FRAMES_SIZE = 80;

function VM(func, debug = true) {
    // inits
    this.debug = debug;
    this.atError = false;
    this.stack = new Array(FRAME_STACK_SIZE * MAX_FRAMES_SIZE);
    this.frames = [];
    this.fp = null;         // frame pointer; current frame
    this.sp = 0;   // stack pointer
    this.globals = Object.create(null);

    // push 'script' function to stack
    this.pushStack(new Value(VAL_FUNCTION, func));
    // push 'script' frame
    this.pushFrame(func);
}

function CallFrame(func, retPoint, stack){
    this.func = func;
    this.ip = 0;  // instruction pointer
    this.returnIndex = retPoint;
    this.stack = stack;
}

VM.prototype.readByte = function() {
    return this.fp.func.code.bytes[this.fp.ip++];
};

VM.prototype.readShort = function() {
    const first = this.fp.func.code.bytes[this.fp.ip++];
    const second = this.fp.func.code.bytes[this.fp.ip++];
    return (first << 8) | second;
};

VM.prototype.readConst = function() {
    return this.fp.func.code.cp.pool[this.readShort()];
};

VM.prototype.pushStack = function(val) {
    this.stack[this.sp++] = val;
};

VM.prototype.popStack = function() {
    return this.stack[--this.sp];
};

VM.prototype.popStackN = function(n) {
    this.sp -= n;
};

VM.prototype.peekStack = function(n = 0) {
    return this.stack[this.sp - 1 - n];
};

VM.prototype.pushFrame = function (func){
    if (this.frames.length >= MAX_FRAMES_SIZE){
        this.runtimeError("Stack overflow");
        exitVM();
    }
    const retIndex = this.sp - 1 - func.arity;
    const frame = new CallFrame(func, retIndex, this.stack);
    this.frames.push(frame);
    this.fp = frame;
};

VM.prototype.popFrame = function (){
    const frame = this.frames.pop();
    this.fp = this.frames[this.frames.length - 1];
    return frame;
};

VM.prototype.currentFrame = function() {
    return this.frames[this.frames.length - 1];
};

/*
 *   x  | int   | float | bool
 * ---------------------------
 * int  | int   | float | int
 * ----------------------------
 * float| float | float | float
 * ----------------------------
 * bool | int   | float | int
 * ----------------------------
 */

VM.prototype.computeNumType = function(leftType, rightType) {
    switch (leftType) {
        case VAL_FLOAT:
            return VAL_FLOAT;
        case VAL_BOOLEAN:
        case VAL_INT:
            switch (rightType) {
                case VAL_BOOLEAN:
                case VAL_INT:
                    return VAL_INT;
                case VAL_FLOAT:
                    return VAL_FLOAT;
                default:
                    unreachable("VM::computeNumType()");
            }
    }
    unreachable("VM::computeNumType()");
};

VM.prototype.getLineSrcCode = function(ip){
    let index = ip;
    while (index >= 0 && this.fp.func.code.srcLines[index] === 0xff){
        --index;
    }
    return this.fp.func.code.srcLines[index];
};

VM.prototype.runtimeError = function(...msg) {
    this.atError = true;
    let repeatingFrameCount = 0;
    let prevFrame = null;
    while (this.fp !== undefined){
        if (prevFrame && prevFrame.func.name === this.fp.func.name){ // todo
            repeatingFrameCount++;
            if (repeatingFrameCount >= 7){
                prevFrame = this.popFrame();
                continue;
            }
        }
        const srcAtLine = this.getLineSrcCode(this.fp.ip);
        if (srcAtLine && srcAtLine !== 0xff){
            const fnName = this.fp.func.name ? this.fp.func.name + '()' : "script";
            const lineNum = this.fp.func.code.lines[this.fp.ip];
            console.error(`<Line ${lineNum}: [${fnName}]>`);  // todo: decide best strategy
            console.error(`  ${srcAtLine.trim()}`);
        }
        prevFrame = this.popFrame();
    }
    console.error(`RuntimeError: ${msg.join(" ")}`);
    exitVM();
};

VM.prototype.dummyVal = () => new Value(VAL_NULL);

VM.prototype.printStack = function() {
    out("\t\t\t\t");
    if (this.sp){
        for (let i = 0; i < this.sp; ++i){
            out(`[ ${this.stack[i]} ]`);
        }
    }else{
        out("[ ]");
    }
    out("\n");
};

VM.prototype.binaryErrorMsg = function(leftVal, rightVal, opcode) {
    return `unsupported operand type(s) for '${this.opcodeToString(opcode)}'`
        + ` -> '${leftVal.typeToString()}' and '${rightVal.typeToString()}'`;
};

VM.prototype.unaryErrorMsg = function(val, op) {
    return `bad operand type for unary '${op}' -> ${val.typeToString()}`;
};

VM.prototype[OP_ADD] = function(leftVal, rightVal) {
    return (leftVal.value + rightVal.value);
};

VM.prototype[OP_SUBTRACT] = function(leftVal, rightVal) {
    return (leftVal.value - rightVal.value);
};

VM.prototype[OP_MULTIPLY] = function(leftVal, rightVal) {
    return (leftVal.value * rightVal.value);
};

VM.prototype[OP_DIVIDE] = function(leftVal, rightVal) {
    if (rightVal.value === 0) {
        this.runtimeError("Attempt to divide by zero");
        return this.dummyVal();
    }
    return (leftVal.value / rightVal.value);
};

VM.prototype.fastNegate = function() {
    const val = this.popStack();
    if (val.isNumber()) {
        this.pushStack(new Value(val.type, -val.value));
    } else {
        this.runtimeError(this.unaryErrorMsg(val, "-"));
    }
};

VM.prototype.fastInvert = function() {
    const val = this.popStack();
    if (val.isInt()) {
        this.pushStack(new Value(val.type, ~val.value));
    } else {
        this.runtimeError(this.unaryErrorMsg(val, "~"));
    }
};

VM.prototype[OP_BW_LSHIFT] = function(leftVal, rightVal) {
    if (rightVal.value < 0){
        this.runtimeError("negative shift count");
        return;
    }
    return leftVal.value << rightVal.value;
};

VM.prototype[OP_BW_RSHIFT] = function(leftVal, rightVal) {
    if (rightVal.value < 0){
        this.runtimeError("negative shift count");
        return;
    }
    return leftVal.value >> rightVal.value;
};

VM.prototype[OP_BW_AND] = function(leftVal, rightVal) {
    return leftVal.value & rightVal.value;
};

VM.prototype[OP_BW_OR] = function(leftVal, rightVal) {
    return leftVal.value | rightVal.value;
};

VM.prototype[OP_BW_XOR] = function(leftVal, rightVal) {
    return leftVal.value ^ rightVal.value;
};

VM.prototype[OP_MOD] = function(leftVal, rightVal) {
    if (rightVal.value === 0) {
        this.runtimeError("Attempt to divide by zero");
        return this.dummyVal();
    }
    return leftVal.value % rightVal.value;
};

VM.prototype[OP_POW] = function(leftVal, rightVal) {
    const val = leftVal.value ** rightVal.value;
    if (val === Infinity){
        this.runtimeError("Value too large"); // todo
        return this.dummyVal();
    }
    return val;
};

VM.prototype[OP_GREATER] = function(leftVal, rightVal) {
    return leftVal.value > rightVal.value;
};

VM.prototype[OP_LESS] = function(leftVal, rightVal) {
    return leftVal.value < rightVal.value;
};

VM.prototype[OP_GREATER_OR_EQUAL] = function(leftVal, rightVal) {
    return leftVal.value >= rightVal.value;
};

VM.prototype[OP_LESS_OR_EQUAL] = function(leftVal, rightVal) {
    return leftVal.value <= rightVal.value;
};

VM.prototype.opcodeToString = function(opcode) {
    switch (opcode) {
        case OP_ADD:
            return "+";
        case OP_SUBTRACT:
            return "-";
        case OP_DIVIDE:
            return "/";
        case OP_MULTIPLY:
            return "*";
        case OP_BW_LSHIFT:
            return "<<";
        case OP_BW_RSHIFT:
            return ">>";
        case OP_BW_AND:
            return "&";
        case OP_BW_OR:
            return "|";
        case OP_BW_XOR:
            return "^";
        case OP_MOD:
            return "%";
        case OP_POW:
            return "**";
        case OP_GREATER:
            return ">";
        case OP_LESS:
            return "<";
        case OP_GREATER_OR_EQUAL:
            return ">=";
        case OP_LESS_OR_EQUAL:
            return "<=";
        default:
            unreachable("VM::opcodeStr()");
    }
};

VM.prototype.add = function() {
    const rightVal = this.popStack();
    const leftVal = this.popStack();
    let result;
    if (leftVal.isNumber() && rightVal.isNumber()) {
        result = new Value(
            this.computeNumType(leftVal.type, rightVal.type)
        );
        result.value = this[OP_ADD](leftVal, rightVal);
        this.pushStack(result);
    } else if (leftVal.isString() && rightVal.isString()) {
        result = new Value(VAL_STRING, leftVal.value + rightVal.value);
        this.pushStack(result);
    } else if (leftVal.isList() && rightVal.isList()){
        let list = leftVal.value.slice();
        rightVal.value.forEach(item => list.push(item));
        result = new Value(VAL_LIST, list);
        this.pushStack(result);
    } else {
        // todo: hook other types here.
        this.runtimeError(this.binaryErrorMsg(leftVal, rightVal, OP_ADD));
    }
};

VM.prototype.binaryOp = function(opcode) {
    const rightVal = this.popStack();
    const leftVal = this.popStack();
    if (leftVal.isNumber() && rightVal.isNumber()) {
        let result = new Value(
            this.computeNumType(leftVal.type, rightVal.type)
        );
        result.value = this[opcode](leftVal, rightVal);
        this.pushStack(result);
        return;
    }
    // todo: hook other types here.
    this.runtimeError(this.binaryErrorMsg(leftVal, rightVal, opcode));
};

VM.prototype.bwBinaryOp = function(opcode) {
    const rightVal = this.popStack();
    const leftVal = this.popStack();
    if (leftVal.isInt() && rightVal.isInt()) {
        let result = new Value(
            this.computeNumType(leftVal.type, rightVal.type)
        );
        result.value = this[opcode](leftVal, rightVal);
        this.pushStack(result);
        return;
    }
    this.runtimeError(this.binaryErrorMsg(leftVal, rightVal, opcode));
};

VM.prototype.isFalsy = function(valObj) {
    // todo: update
    return (valObj.isNumber() && !valObj.value) // covers boolean
        || valObj.isString() && !valObj.value.length
        || valObj.isList() && !valObj.value.length
        || valObj.isDict() && !valObj.value.size
        || valObj.isNull();
};

VM.prototype.buildListFromRange = function (start, stop, step){
    let arr = [];
    if (start > stop){
        if (step > 0) return arr;
        // start -> 5, stop -> 1
        for (let i = start; i >= stop; i += step){
            arr.push(new Value(VAL_INT, i));
        }
    }else{
        if (step < 0) return arr;
        // start -> 1, stop -> 5
        for (let i = start; i <= stop; i += step){
            arr.push(new Value(VAL_INT, i));
        }
    }
    return arr;
};

VM.prototype.validateListIndexExpr = function(list, idx){
    if (!list.isList()){
        this.runtimeError(
            `'${list.typeToString()}' object is not subscriptable`
        );
        return undefined;
    }
    if (!idx.isInt()){
        this.runtimeError(
            `list indices must be an integer, not ${idx.typeToString()}`
        );
        return undefined;
    }
    let index = idx.value < 0 ? list.value.length + idx.value : idx.value;
    if (Math.abs(index) >= list.value.length){
        this.runtimeError("list index out of range");
        return undefined;
    }
    return index;
};

VM.prototype.performSubscript = function (object, subscript){
    if (object.isList()){
        const index = this.validateListIndexExpr(object, subscript);
        if (index === undefined){
            this.atError = true;
            return;
        }
        this.pushStack(object.value[index]);
    }else if (object.isDict()){
        const val = object.asDict().get(subscript.toString());
        if (val === undefined){
            this.runtimeError(
                `dict has no key ${subscript.toString()}`
            );
            return;
        }
        this.pushStack(val);
    }
};

VM.prototype.setSubscript = function (object, subscript){
    if (object.isList()){
        const index = this.validateListIndexExpr(object, subscript);
        if (index === undefined){
            this.atError = true;
            return;
        }
        object.value[index] = this.peekStack();
    }else if (object.isDict()){
        const val = this.peekStack();
        if (val === object){
            this.runtimeError(
                "Attempt to set dict object to itself"
            );
            return;
        }
        object.value.set(subscript.toString(), this.peekStack());
    }
};


VM.prototype.getFunctionObj = function(start){
    // try to obtain a function within a byte range on the stack
    // `start` determines where we begin the count, and is also included
    // in the byte range
    let val;
    for (let i = start; i < (0xff - start); ++i){
        val = this.peekStack(i);
        if (val.isFunction()) return val;
    }
};

VM.prototype.argumentError = function (fnObj, got){
    // todo: enhance
    const arity = fnObj.arity;
    const argsWord = arity > 1 ? "arguments" : "argument";
    const gotWord = got > 1 ? got : "none";
    return `${fnObj.name}() expected ${arity} ${argsWord} but got ${gotWord}`;
};

VM.prototype.callValue = function (arity){
    let fnVal = this.peekStack(arity);
    if (!fnVal){
        fnVal = this.getFunctionObj(arity);
        assert(fnVal.isFunction(), "VM::callValue()");
        this.runtimeError( this.argumentError(fnVal.asFunction(), arity));
        return false;
    }else if (!fnVal.isFunction()){
        this.runtimeError( `'${fnVal.typeToString()}' type is not callable`);
        return false;
    }
    const fnObj = fnVal.asFunction();
    if (fnObj.arity !== arity){
        this.runtimeError( this.argumentError(fnObj, arity));
        return false;
    }
    this.pushFrame(fnObj);
    return true;
};

VM.prototype.run = function() {
    let dis = new Disassembler(this.fp.func, this.debug);
    for (; ;) {
        if (this.debug){
            this.printStack();
            dis.disassembleInstruction(this.fp.ip, this.fp.func.code);
        }
        const bytecode = this.readByte();
        switch (bytecode) {
            case OP_LOAD_NULL:
                this.pushStack(new Value(VAL_NULL));
                break;
            case OP_LOAD_TRUE:
                this.pushStack(new Value(VAL_BOOLEAN, 1));
                break;
            case OP_LOAD_FALSE:
                this.pushStack(new Value(VAL_BOOLEAN, 0));
                break;
            case OP_LOAD_CONST:
                this.pushStack(this.readConst());
                break;
            case OP_POSITIVE:
                break;
            case OP_NEGATE:
                this.fastNegate();
                if (this.atError) return INTERPRET_RESULT_ERROR;
                break;
            case OP_NOT:
                const valObj = this.popStack();
                let newValObj = new Value(VAL_BOOLEAN, this.isFalsy(valObj));
                this.pushStack(newValObj);
                break;
            case OP_BW_INVERT:
                this.fastInvert();
                break;
            case OP_ADD:
                this.add();
                if (this.atError) return INTERPRET_RESULT_ERROR;
                break;
            case OP_MOD:
            case OP_DIVIDE:
                this.binaryOp(bytecode);
                if (this.atError) return INTERPRET_RESULT_ERROR;
                break;
            case OP_BW_LSHIFT:
            case OP_BW_RSHIFT:
            case OP_BW_AND:
            case OP_BW_OR:
            case OP_BW_XOR:
                this.bwBinaryOp(bytecode);
                if (this.atError) return INTERPRET_RESULT_ERROR;
                break;
            case OP_POW:
            case OP_GREATER:
            case OP_LESS:
            case OP_GREATER_OR_EQUAL:
            case OP_LESS_OR_EQUAL:
            case OP_SUBTRACT:
            case OP_MULTIPLY:
                this.binaryOp(bytecode);
                if (this.atError) return INTERPRET_RESULT_ERROR;
                break;
            case OP_EQUAL: {
                const rightValObj = this.popStack();
                const leftValObj = this.popStack();
                this.pushStack(
                    new Value(VAL_BOOLEAN,
                        leftValObj.equals(rightValObj))
                );
                break;
            }
            case OP_NOT_EQUAL: {
                const rightValObj = this.popStack();
                const leftValObj = this.popStack();
                this.pushStack(
                    new Value(VAL_BOOLEAN,
                        !leftValObj.equals(rightValObj))
                );
                break;
            }
            case OP_SHOW:
                const argCount = this.readByte();
                for (let i = argCount - 1; i >= 0; i--) {
                    out(this.peekStack(i).stringify(true));
                    if (i > 0) out(" ");
                }
                out("\n");
                this.popStackN(argCount);
                break;
            case OP_BUILD_LIST: {
                const size = this.readShort();
                let valObj = new Value(VAL_LIST);
                valObj.value = [];
                for (let i = 0; i < size; ++i){
                    valObj.value.unshift(this.peekStack(i));
                }
                this.popStackN(size);
                this.pushStack(valObj);
                break;
            }
            case OP_BUILD_RANGE: {
                const step = this.popStack();
                const end = this.popStack();
                const start = this.popStack();
                if (!start.isInt() || !step.isInt() || !end.isInt()){
                    this.runtimeError(
                        "Range expression sequences only with integers");
                    return INTERPRET_RESULT_ERROR;
                }
                let valObj = new Value(
                    VAL_LIST, this.buildListFromRange(
                        start.value, end.value, step.value));
                this.pushStack(valObj);
                break;
            }
            case OP_BUILD_DICT: {
                const length = this.readShort();
                const map = new Map();
                let key, value;
                for (let i = length * 2 - 1; i >= 0; i -= 2){
                    value = this.peekStack(i - 1);
                    key = this.peekStack(i);
                    map.set(key.toString(), value);
                }
                this.popStackN(length * 2);
                this.pushStack(new Value(VAL_DICT, map));
                break;
            }
            case OP_SUBSCRIPT: {
                const subscript = this.popStack();
                const object = this.popStack();
                this.performSubscript(object, subscript);
                if (this.atError) return INTERPRET_RESULT_ERROR;
                break;
            }
            case OP_SET_SUBSCRIPT: {
                const subscript = this.popStack();
                const object = this.popStack();
                this.setSubscript(object, subscript);
                if (this.atError) return INTERPRET_RESULT_ERROR;
                break;
            }
            case OP_POP:
                this.popStack();
                break;
            case OP_DEFINE_GLOBAL: {
                const val = this.popStack();
                const name = this.readConst();
                this.globals[name.asString()] = val;
                break;
            }
            case OP_GET_GLOBAL: {
                const name = this.readConst();
                const val = this.globals[name.asString()];
                if (val === undefined){
                    this.runtimeError(`${name} is not defined`);
                    return INTERPRET_RESULT_ERROR;
                }
                this.pushStack(val);
                break;
            }
            case OP_SET_GLOBAL: {
                const name = this.readConst().asString();
                if (!(name in this.globals)){
                    this.runtimeError(
                        `Cannot assign value to undefined variable '${name}'`);
                    return INTERPRET_RESULT_ERROR;
                }
                this.globals[name] = this.peekStack();
                break;
            }
            case OP_INC: {
                const v = this.popStack();
                this.pushStack(new Value(v.type, (v.value + 1)));
                break;
            }
            case OP_DEC: {
                const v = this.popStack();
                this.pushStack(new Value(v.type, (v.value - 1)));
                break;
            }
            case OP_DEFINE_LOCAL:
                // NOP
                this.readConst();
                break;
            case OP_SET_LOCAL: {
                const index = this.readShort();
                // returnIndex is the frame's stack starting point
                this.stack[this.fp.returnIndex + index] = this.peekStack();
                break;
            }
            case OP_GET_LOCAL: {
                const index = this.readShort();
                this.pushStack(this.stack[this.fp.returnIndex + index]);
                break;
            }
            case OP_FORMAT: { // todo: for user defined objects
                const size = this.readShort();
                let string = new Value(VAL_STRING, "");
                for (let i = size - 1; i >= 0; i--){
                    string.value += this.peekStack(i).stringify(true);
                }
                this.popStackN(size);
                this.pushStack(string);
                break;
            }
            case OP_JUMP:
                const offset = this.readShort();
                this.fp.ip += offset;
                break;
            case OP_JUMP_IF_FALSE: {
                const offset = this.readShort();
                if (this.isFalsy(this.peekStack())){
                    this.fp.ip += offset;
                }
                break;
            }
            case OP_JUMP_IF_FALSE_OR_POP: {
                const offset = this.readShort();
                if (this.isFalsy(this.peekStack())){
                    this.fp.ip += offset;
                }else{
                    this.popStack();
                }
                break;
            }
            case OP_LOOP: {
                const offset = this.readShort();
                this.fp.ip -= offset;
                break;
            }
            case OP_POP_N:
                this.popStackN(this.readShort());
                break;
            case OP_SWAP_TWO: {
                const top = this.peekStack();
                this.stack[this.sp - 1] = this.peekStack(1);
                this.stack[this.sp - 2] = top;
                break;
            }
            case OP_CALL:
                if (!this.callValue(this.readByte())){
                    return INTERPRET_RESULT_ERROR;
                }
                break;
            case OP_RETURN: {
                const frame = this.popFrame();
                const val = this.popStack();
                if (!this.fp){
                    // indicates that we've just popped the top-level frame,
                    // which is the 'script' frame
                    return INTERPRET_RESULT_OK;
                }
                // if the frame popped isn't the script frame
                // then return the value currently on top of the stack for use
                // by the current frame
                this.stack[frame.returnIndex] = val;
                this.sp = frame.returnIndex + 1;
                break;
            }
        }
    }
};

module.exports = {
    VM,
    INTERPRET_RESULT_OK,
    INTERPRET_RESULT_ERROR
};
