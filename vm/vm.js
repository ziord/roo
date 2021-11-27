/*
 * Roo.js Bytecode Virtual Machine
 *
 */

"use strict";

const {
    Value,
    getStringObj,
    createVMStringVal,
    createListVal,
    createDictVal,
    createDefVal,
    createInstanceVal,
    createBoundMethodVal,
    createFunctionVal,
    VAL_INT,
    VAL_FLOAT,
    VAL_BOOLEAN,
    VAL_NULL,
} = require("../constant/value");
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
    OP_BUILD_DICT,
    OP_CALL,
    OP_GET_UPVALUE,
    OP_SET_UPVALUE,
    OP_DEF,
    OP_CLOSURE,
    OP_METHOD,
    OP_GET_PROPERTY,
    OP_SET_PROPERTY,
    OP_INVOKE,
    OP_DERIVE,
    OP_INVOKE_DEREF,
    OP_GET_DEREF_PROPERTY,
} = require("../code/opcode");
const { Disassembler } = require("../debug/disassembler");
const { assert, out, print, unreachable, exit } = require("../utils");
const rcore = require("../rcore/core");
const INTERPRET_RESULT_OK = 0, INTERPRET_RESULT_ERROR = -1;
const FRAME_STACK_SIZE = 0x1000;
const MAX_FRAMES_SIZE = 80;
const MAX_RANGE_LENGTH = 10000000;  // todo

/**
 * @param {FunctionObject} func
 * @param {boolean} debug
 * @param {Map<string, StringObject>} strings
 * @param {boolean} repl: flag indicating if the VM is invoked in a repl
 * @constructor
 */
function VM(func, debug = true, strings = null, repl = false) {
    // inits
    this.debug = debug;
    this.atError = false;
    this.stack = new Array(FRAME_STACK_SIZE * MAX_FRAMES_SIZE);
    this.frames = [];
    this.fp = null; // frame pointer; current frame
    this.sp = 0; // stack pointer
    this.popCallback = null;  // todo
    this.setPopCallback(repl);  // todo
    this.builtins = new Map();
    this.globals = new Map();
    this.internedStrings = strings || new Map();
    this.initializerMethodName = getStringObj("__init__", this.internedStrings);
    this.stringMethodName = getStringObj("__str__", this.internedStrings);

    // push 'script' function to stack
    this.pushStack(createFunctionVal(func));
    // push 'script' frame
    this.pushFrame(func);
    // register all builtin/core functions
    rcore.initAll(this);
}

/**
 * @param {FunctionObject} func
 * @param {number} retPoint
 * @param {Array} stack
 * @constructor
 */
function CallFrame(func, retPoint, stack) {
    // function object
    this.func = func;
    // instruction pointer
    this.ip = 0;
    // location/point where the function returns to, i.e.
    // where the function's return value is stored.
    this.returnIndex = retPoint;
    // the starting point of the stack from the function's window/perspective.
    // same as returnIndex, but with a more appropriate name for properly
    // indexing into the stack.
    this.stackStart = retPoint;
    // the stack; yes, that 'stack'.
    this.stack = stack;
}

/**
 * Re-initialize the VM with a new FunctionObject, after it
 * has originally been created.
 * @param {FunctionObject} fnObj
 */
VM.prototype.initFrom = function (fnObj) {
    // push 'script' function to stack
    this.pushStack(createFunctionVal(fnObj));
    // push 'script' frame
    this.pushFrame(fnObj);
    rcore.initInternedStrings(this, null);
};

VM.prototype.setPopCallback = function (repl) {
    // set the callback used in handling an OP_POP instruction; this
    // allows the VM to overload the pop instruction depending
    // on the environment the VM is being invoked in.
    this.popCallback = repl
        ? (val) => print(val.stringify(true, this))
        : () => {};
};

VM.prototype.iOK = function () {
    return INTERPRET_RESULT_OK;
};

VM.prototype.iERR = function () {
    return INTERPRET_RESULT_ERROR;
};

VM.prototype.atFault = function () {
    return this.atError;
};

VM.prototype.clearError = function () {
    this.atError = false;
};

VM.prototype.readByte = function () {
    return this.fp.func.code.bytes[this.fp.ip++];
};

VM.prototype.readShort = function () {
    const first = this.fp.func.code.bytes[this.fp.ip++];
    const second = this.fp.func.code.bytes[this.fp.ip++];
    return (first << 8) | second;
};

VM.prototype.readConst = function () {
    return this.fp.func.code.cp.pool[this.readShort()];
};

VM.prototype.readString = function () {
    return this.readConst().asString();
};

VM.prototype.pushStack = function (val) {
    this.stack[this.sp++] = val;
};

VM.prototype.popStack = function () {
    return this.stack[--this.sp];
};

VM.prototype.popStackN = function (n) {
    this.sp -= n;
};

VM.prototype.peekStack = function (n = 0) {
    return this.stack[this.sp - 1 - n];
};

VM.prototype.swapLastTwo = function () {
    const tmp = this.stack[this.sp - 1];
    this.stack[this.sp - 1] = this.stack[this.sp - 2];
    this.stack[this.sp - 2] = tmp;
};

VM.prototype.stackSize = function () {
    return this.sp;
};

VM.prototype.pushFrame = function (func) {
    if (this.frames.length >= MAX_FRAMES_SIZE) {
        this.runtimeError("Stack overflow");
        exit();
    }
    const retIndex = this.sp - 1 - func.arity;
    const frame = new CallFrame(func, retIndex, this.stack);
    this.frames.push(frame);
    this.fp = frame;
};

VM.prototype.popFrame = function () {
    const frame = this.frames.pop();
    this.fp = this.frames[this.frames.length - 1];
    return frame;
};

VM.prototype.currentFrame = function () {
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

// todo: rework this method
VM.prototype.computeNumType = function (leftType, rightType, opcode) {
    // int -> 0 | float -> 1 | bool -> 2 (see value.js)
    assert(
        leftType <= 2 && rightType <= 2,
        "VM::computeNumType() - num types changed"
    );
    if (opcode === OP_DIVIDE) {
        return VAL_FLOAT;
    } else {
        const types = [];
        types[VAL_INT] = [VAL_INT, VAL_FLOAT, VAL_INT];
        types[VAL_FLOAT] = [VAL_FLOAT, VAL_FLOAT, VAL_FLOAT];
        types[VAL_BOOLEAN] = [VAL_INT, VAL_FLOAT, VAL_INT];
        return types[leftType][rightType];
    }
};

VM.prototype.getLineSrcCode = function (ip) {
    let index = ip;
    while (index >= 0 && this.fp.func.code.srcLines[index] === 0xff) {
        --index;
    }
    return this.fp.func.code.srcLines[index];
};

/*
 * Errors
 */
VM.prototype.runtimeError = function (...msg) {
    this.atError = true;
    let repeatingFrameCount = 0;
    let prevFrame = null;
    while (this.fp !== undefined) {
        if (prevFrame && prevFrame.func.fname === this.fp.func.fname) {
            // todo
            repeatingFrameCount++;
            if (repeatingFrameCount >= 7) {
                prevFrame = this.popFrame();
                continue;
            }
        }
        const srcAtLine = this.getLineSrcCode(this.fp.ip);
        if (srcAtLine && srcAtLine !== 0xff) {
            const fnName = this.fp.func.fname
                ? this.fp.func.fname.raw + "()"
                : "script";
            const lineNum = this.fp.func.code.lines[this.fp.ip];
            console.error(`<Line ${lineNum}: [${fnName}]>`); // todo: decide best strategy
            console.error(`  ${srcAtLine.trim()}`);
        }
        prevFrame = this.popFrame();
    }
    console.error(`RuntimeError: ${msg.join(" ")}`);
    // we cannot exit in order to allow roo to be embeddable
};

VM.prototype.argumentError = function (fnObj, got) {
    // todo: enhance
    const arity = fnObj.arity - fnObj.isVariadic - fnObj.defaultParamsCount;
    const argsWord = arity > 1 ? "arguments" : "argument";
    const gotWord = got >= 1 ? got : "none.";
    let diagnosis = `${fnObj.fname.raw}() takes ${arity} positional ${argsWord}`;
    let stress =
        fnObj.defaultParamsCount || fnObj.isVariadic ? " at least " : " ";
    if (fnObj.defaultParamsCount) {
        const argsWord =
            fnObj.defaultParamsCount > 1 ? "arguments" : "argument";
        diagnosis += `, has ${fnObj.defaultParamsCount} default ${argsWord}`;
    }
    if (fnObj.isVariadic) {
        diagnosis += `, and an (optional) variadic/spread argument`;
    }
    diagnosis += `.\n${fnObj.fname.raw}() expected${stress}${arity} ${argsWord} but got ${gotWord}`;
    return diagnosis;
};

VM.prototype.propertyAccessError = function (val, prop, defName) {
    let error;
    if (defName) {
        // `defName` is provided when the error happens on the instance
        // but the instance isn't available to be passed to this method.
        // so, we handle it as if the instance was passed.
        error = `ref of '${defName.raw}' has no property '${prop.raw}'`;
        this.runtimeError(error);
    } else if (val.isInstance()) {
        error = `ref of '${
            val.asInstance().def.dname.raw
        }' has no property '${prop.raw}'`;
        this.runtimeError(error);
    } else if (val.isDef()) {
        error = `'${val.asDef().dname.raw}' has no property '${prop.raw}'`;
        this.runtimeError(error);
    } else {
        error = `'${val.typeToString()}' has no property '${prop.raw}'`;
        this.runtimeError(error);
    }
    // todo: handle other val types
};

VM.prototype.propertyAssignError = function (val, prop) {
    this.runtimeError(
        `Cannot set property '${prop.raw}' on '${val.typeToString()}' type.`
    );
};

VM.prototype.subscriptError = function (val) {
    this.runtimeError(`'${val.typeToString()}' value is not subscriptable`);
};

VM.prototype.dummyVal = () => new Value(VAL_NULL);

VM.prototype.printStack = function () {
    out("\t\t\t\t");
    if (this.sp) {
        for (let i = 0; i < this.sp; ++i) {
            out(`[ ${this.stack[i]} ]`);
        }
    } else {
        out("[ ]");
    }
    out("\n");
};

VM.prototype.binaryErrorMsg = function (leftVal, rightVal, opcode) {
    return (
        `unsupported operand type(s) for '${this.opcodeToString(opcode)}'` +
        ` -> '${leftVal.typeToString()}' and '${rightVal.typeToString()}'`
    );
};

VM.prototype.unaryErrorMsg = function (val, op) {
    return `bad operand type for unary '${op}' -> ${val.typeToString()}`;
};

VM.prototype[OP_ADD] = function (leftVal, rightVal) {
    return leftVal.value + rightVal.value;
};

VM.prototype[OP_SUBTRACT] = function (leftVal, rightVal) {
    return leftVal.value - rightVal.value;
};

VM.prototype[OP_MULTIPLY] = function (leftVal, rightVal) {
    return leftVal.value * rightVal.value;
};

VM.prototype[OP_DIVIDE] = function (leftVal, rightVal) {
    if (rightVal.value === 0) {
        this.runtimeError("Attempt to divide by zero");
        return this.dummyVal();
    }
    return leftVal.value / rightVal.value;
};

VM.prototype.fastNegate = function () {
    const val = this.popStack();
    if (val.isNumber()) {
        this.pushStack(new Value(val.type, -val.value));
    } else {
        this.runtimeError(this.unaryErrorMsg(val, "-"));
    }
};

VM.prototype.fastInvert = function () {
    const val = this.popStack();
    if (val.isInt()) {
        this.pushStack(new Value(val.type, ~val.value));
    } else {
        this.runtimeError(this.unaryErrorMsg(val, "~"));
    }
};

VM.prototype[OP_BW_LSHIFT] = function (leftVal, rightVal) {
    if (rightVal.value < 0) {
        this.runtimeError("negative shift count");
        return;
    }
    return leftVal.value << rightVal.value;
};

VM.prototype[OP_BW_RSHIFT] = function (leftVal, rightVal) {
    if (rightVal.value < 0) {
        this.runtimeError("negative shift count");
        return;
    }
    return leftVal.value >> rightVal.value;
};

VM.prototype[OP_BW_AND] = function (leftVal, rightVal) {
    return leftVal.value & rightVal.value;
};

VM.prototype[OP_BW_OR] = function (leftVal, rightVal) {
    return leftVal.value | rightVal.value;
};

VM.prototype[OP_BW_XOR] = function (leftVal, rightVal) {
    return leftVal.value ^ rightVal.value;
};

VM.prototype[OP_MOD] = function (leftVal, rightVal) {
    if (rightVal.value === 0) {
        this.runtimeError("Attempt to divide by zero");
        return this.dummyVal();
    }
    return leftVal.value % rightVal.value;
};

VM.prototype[OP_POW] = function (leftVal, rightVal) {
    // todo: handle infinity on all number operations
    // if (val === Infinity) {
    //     this.runtimeError("Value too large");
    //     return this.dummyVal();
    // }
    return leftVal.value ** rightVal.value;
};

VM.prototype[OP_GREATER] = function (leftVal, rightVal) {
    return leftVal.value > rightVal.value;
};

VM.prototype[OP_LESS] = function (leftVal, rightVal) {
    return leftVal.value < rightVal.value;
};

VM.prototype[OP_GREATER_OR_EQUAL] = function (leftVal, rightVal) {
    return leftVal.value >= rightVal.value;
};

VM.prototype[OP_LESS_OR_EQUAL] = function (leftVal, rightVal) {
    return leftVal.value <= rightVal.value;
};

VM.prototype.opcodeToString = function (opcode) {
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

VM.prototype.add = function () {
    const rightVal = this.popStack();
    const leftVal = this.popStack();
    if (leftVal.isNumber() && rightVal.isNumber()) {
        this.pushStack(
            new Value(
                this.computeNumType(leftVal.type, rightVal.type),
                this[OP_ADD](leftVal, rightVal)
            )
        );
    } else if (leftVal.isString() && rightVal.isString()) {
        this.pushStack(
            createVMStringVal(
                leftVal.asString().raw + rightVal.asString().raw,
                this
            )
        );
    } else if (leftVal.isList() && rightVal.isList()) {
        this.pushStack(
            createListVal(
                leftVal.asList().elements.concat(rightVal.asList().elements),
                this
            )
        );
    } else {
        // todo: hook other types here. for starters, instance type
        this.runtimeError(this.binaryErrorMsg(leftVal, rightVal, OP_ADD));
    }
};

VM.prototype.binaryOp = function (opcode) {
    const rightVal = this.popStack();
    const leftVal = this.popStack();
    if (leftVal.isNumber() && rightVal.isNumber()) {
        this.pushStack(
            new Value(
                this.computeNumType(leftVal.type, rightVal.type, opcode),
                this[opcode](leftVal, rightVal)
            )
        );
    } else {
        // todo: hook other types here.
        this.runtimeError(this.binaryErrorMsg(leftVal, rightVal, opcode));
    }
};

VM.prototype.bwBinaryOp = function (opcode) {
    const rightVal = this.popStack();
    const leftVal = this.popStack();
    if (leftVal.isInt() && rightVal.isInt()) {
        let result = new Value(
            this.computeNumType(leftVal.type, rightVal.type)
        );
        result.value = this[opcode](leftVal, rightVal);
        this.pushStack(
            new Value(
                this.computeNumType(leftVal.type, rightVal.type),
                this[opcode](leftVal, rightVal)
            )
        );
    } else {
        // todo: hook other types here.
        this.runtimeError(this.binaryErrorMsg(leftVal, rightVal, opcode));
    }
};

VM.prototype.isFalsy = function (valObj) {
    // todo: update
    return (valObj.isNumber() && !valObj.value) || // covers boolean
        (valObj.isString() && !valObj.asString().raw.length) ||
        (valObj.isList() && !valObj.asList().elements.length) ||
        (valObj.isDict() && !valObj.asDict().htable.size) ||
        valObj.isNull()
        ? 1
        : 0;
};

VM.prototype.buildListFromRange = function (start, stop, step) {
    let arr = [];
    if (start > stop) {
        if (step > 0) return arr;
        // start -> 5, stop -> 1
        for (let i = start; i >= stop; i += step) {
            arr.push(new Value(VAL_INT, i));
        }
    } else {
        if (step < 0) return arr;
        // start -> 1, stop -> 5
        for (let i = start; i <= stop; i += step) {
            arr.push(new Value(VAL_INT, i));
        }
    }
    return arr;
};

VM.prototype.validateIndexExpr = function (length, idx, type) {
    if (!idx.isInt()) {
        this.runtimeError(
            `${type} indices must be an integer, not ${idx.typeToString()}`
        );
        return undefined;
    }
    let index = idx.value < 0 ? length + idx.value : idx.value;
    if (Math.abs(index) >= length) {
        this.runtimeError(`${type} index out of range`);
        return undefined;
    }
    return index;
};

VM.prototype.performSubscript = function (object, subscript) {
    // todo: string and user defined types
    if (object.isList()) {
        const index = this.validateIndexExpr(
            object.asList().elements.length,
            subscript,
            object.typeToString()
        );
        if (index === undefined) {
            return;
        }
        this.pushStack(object.asList().elements[index]);
    } else if (object.isDict()) {
        const val = object.asDict().getVal(subscript);
        if (!val) {
            this.runtimeError(`dict has no key ${subscript.stringify(true)}`);
            return;
        }
        this.pushStack(val);
    } else if (object.isString()) {
        const index = this.validateIndexExpr(
            object.asString().raw.length,
            subscript,
            object.typeToString()
        );
        if (index === undefined) {
            return;
        }
        this.pushStack(createVMStringVal(object.asString().raw[index], this));
    } else {
        this.subscriptError(object);
    }
};

VM.prototype.setSubscript = function (object, subscript) {
    // todo: string and user defined types
    if (object.isList()) {
        const index = this.validateIndexExpr(
            object,
            subscript,
            object.typeToString()
        );
        if (index === undefined) {
            return;
        }
        object.asList().elements[index] = this.peekStack();
    } else if (object.isDict()) {
        object.asDict().setVal(subscript, this.peekStack());
    } else {
        this.runtimeError(
            `'${object.typeToString()}' type does not support index assignment`
        );
    }
};

VM.prototype.getValueProperty = function (prop, val) {
    let propVal;
    if (val.isInstance()) {
        const inst = val.asInstance();
        // try to obtain the property from the instance's `props`
        if ((propVal = inst.getProperty(prop))) {
            this.popStack();
            this.pushStack(propVal);
        } else {
            // if not in there, check the instances' `def`'s 'dmethods'
            this.bindMethod(inst.def, prop);
        }
    } else if (val.isDef()) {
        const def = val.asDef();
        if (
            (propVal = def.getMethod(prop)) &&
            propVal.asFunction().isStaticMethod
        ) {
            this.popStack();
            this.pushStack(propVal);
        } else {
            this.propertyAccessError(val, prop);
        }
    } else if (val.isBuiltinObject()) {
        this.bindMethod(val.getBuiltinDef(), prop);
    } else {
        this.propertyAccessError(val, prop);
    }
    return !this.atError;
};

VM.prototype.captureUpvalue = function (index) {
    return this.stack[this.fp.stackStart + index];
};

VM.prototype.variadicCall = function (fnObj, arity) {
    const arr = [];
    if (arity > fnObj.arity) {
        // Pack all extra args, starting
        // from the arg matching the arity, into a list.
        for (let i = 0, count = arity - fnObj.arity; i <= count; ++i) {
            arr.unshift(this.popStack());
        }
        this.pushStack(createListVal(arr, this));
    } else if (fnObj.arity - arity === 1) {
        // the function is missing only the variadic/spread argument
        // we cater for this by passing an empty list
        this.pushStack(createListVal([], this));
    } else {
        // trouble. The function is missing so much more.
        // Can't handle this, just err.
        this.runtimeError(this.argumentError(fnObj, arity));
    }
};

VM.prototype.defaultCall = function (fnObj, arity) {
    if (arity < fnObj.arity) {
        // less arity, but defaults are available
        const stackSize = this.stackSize();
        // push args on stack, with respect to the original
        // function's definition
        for (let i = arity + 1, arg; i <= fnObj.arity; ++i) {
            // is there a default arg at this argument position?
            // if not, exit the loop.
            arg = fnObj.defaults[i];
            if (!arg) break;
            this.pushStack(arg);
        }
        /*
         * the new arity should be arity + number of args pushed
         * on the stack. If it still isn't, try to determine if it's
         * a variadic call as well.
         */
        const newArity = this.stackSize() - stackSize + arity;
        if (newArity !== fnObj.arity) {
            this.variadicCall(fnObj, newArity);
        }
    } else {
        // arity > fnObj.arity
        this.variadicCall(fnObj, arity);
    }
};

VM.prototype.callFn = function (fnVal, callArity) {
    const fnObj = fnVal.asFunction();
    if (fnObj.arity !== callArity) {
        // first, handle default params if available, to enable easy
        // shell out to variadicCall()
        if (fnObj.defaultParamsCount) {
            this.defaultCall(fnObj, callArity);
        } else if (fnObj.isVariadic) {
            // handle a variadic call
            this.variadicCall(fnObj, callArity);
        } else {
            this.runtimeError(this.argumentError(fnObj, callArity));
        }
    } else if (fnObj.isVariadic) {
        // function is variadic, but arity matches.
        // Make the last argument a list
        const listVal = createListVal([this.popStack()], this);
        this.pushStack(listVal);
    }
    // return if an error was encountered above.
    if (this.atError) return;
    // does this function have a builtin executable (callable)?
    if (fnObj.builtinMethod) {
        // handle builtin methods
        this.callBuiltinMethod(fnObj, fnObj.arity);
    } else {
        // if not, just push the frame
        this.pushFrame(fnObj);
    }
};

VM.prototype.callBuiltinMethod = function (fnObj, arity) {
    // call and set the return value directly
    this.stack[this.sp - 1 - arity] = fnObj.builtinMethod(this, arity);
    // trim the stack pointer - to reflect the return of the builtinMethod
    this.sp -= arity;
};

VM.prototype.callBuiltinFn = function (val, arity) {
    const bFn = val.asBFunction();
    // todo: enhance
    if (bFn.arity !== arity) {
        const argsWord = bFn.arity > 1 ? "arguments" : "argument";
        const arityWord = arity >= 1 ? arity : "none";
        const error = `${bFn.fname.raw}() takes ${bFn.arity} ${argsWord} but got ${arityWord}`;
        this.runtimeError(error);
    } else {
        // `bFn.builtinFn` returns a Value() obj
        this.stack[this.sp - 1 - arity] = bFn.builtinFn(this);
        this.sp -= arity;
    }
};

VM.prototype.callDef = function (val, arity) {
    const defObj = val.asDef();
    // insert instance object at `def`s position
    this.stack[this.sp - 1 - arity] = createInstanceVal(defObj);
    let init;
    if ((init = defObj.getMethod(this.initializerMethodName))) {
        this.callFn(init, arity);
    } else if (arity) {
        this.runtimeError(
            `${defObj.dname.raw} ` + `takes no argument but got ${arity}.`
        );
    }
};

VM.prototype.callBoundMethod = function (val, arity) {
    const bm = val.asBoundMethod();
    this.stack[this.sp - 1 - arity] = bm.instance;
    this.callFn(bm.method, arity);
};

VM.prototype.callValue = function (arity) {
    let val = this.peekStack(arity);
    if (val.isFunction()) {
        this.callFn(val, arity);
    } else if (val.isDef()) {
        this.callDef(val, arity);
    } else if (val.isBoundMethod()) {
        this.callBoundMethod(val, arity);
    } else if (val.isBFunction()) {
        this.callBuiltinFn(val, arity);
    } else {
        this.runtimeError(`'${val.typeToString()}' type is not callable`);
    }
    return !this.atError;
};

VM.prototype.bindMethod = function (defObj, prop) {
    let method;
    if ((method = defObj.getMethod(prop))) {
        if (!method.asFunction().isStaticMethod) {
            this.pushStack(createBoundMethodVal(this.popStack(), method));
        } else {
            // pop the instance off the stack
            this.popStack();
            // do not bind static methods, since they are regular functions.
            this.pushStack(method);
        }
    } else {
        this.propertyAccessError(null, prop, defObj.dname);
    }
    return !this.atError;
};

VM.prototype.invokeFromDef = function (defObj, prop, arity) {
    let fnVal;
    if ((fnVal = defObj.getMethod(prop))) {
        this.callFn(fnVal, arity);
    } else {
        this.propertyAccessError(null, prop, defObj.dname);
    }
    return !this.atError;
};

VM.prototype.invokeValue = function (prop, arity) {
    const val = this.peekStack(arity);
    // todo: improve this
    let propVal;
    if (val.isInstance()) {
        const inst = val.asInstance();
        if ((propVal = inst.getProperty(prop))) {
            /*
             * simulate `OP_GET_PROPERTY idx` by placing the property
             * on the stack at the instance's position, and allowing
             * callValue() handle the call
             */
            this.stack[this.sp - 1 - arity] = propVal;
            this.callValue(arity);
        } else {
            // try to obtain the property/attribute from the def
            this.invokeFromDef(inst.def, prop, arity);
        }
    } else if (val.isDef()) {
        const def = val.asDef();
        if (
            (propVal = def.getMethod(prop)) &&
            propVal.asFunction().isStaticMethod
        ) {
            this.stack[this.sp - 1 - arity] = propVal;
            /*
             * we're certain that this is a Value(FunctionObject),
             * since a def's `dmethods` can contain only Value(FunctionObject)
             * values. So we call the function directly, instead of going
             * through callValue().
             */
            this.callFn(propVal, arity);
        } else {
            this.propertyAccessError(val, prop);
        }
    } else if (val.isBuiltinObject()) {
        this.invokeFromDef(val.getBuiltinDef(), prop, arity);
    } else {
        this.propertyAccessError(val, prop);
    }
    return !this.atError;
};

VM.prototype.isBuiltinDef = function (defVal) {
    return rcore.builtinDefs.includes(defVal.asDef().dname.raw);
};

VM.prototype.run = function (externCaller) {
    let dis = new Disassembler(this.fp.func, this.debug);
    for (;;) {
        if (this.debug) {
            this.printStack();
            dis.disassembleInstruction(this.fp.ip, this.fp.func.code);
        }
        const bytecode = this.readByte();
        switch (bytecode) {
            case OP_LOAD_NULL: {
                this.pushStack(new Value(VAL_NULL));
                break;
            }
            case OP_LOAD_TRUE: {
                this.pushStack(new Value(VAL_BOOLEAN, 1));
                break;
            }
            case OP_LOAD_FALSE: {
                this.pushStack(new Value(VAL_BOOLEAN, 0));
                break;
            }
            case OP_LOAD_CONST: {
                this.pushStack(this.readConst());
                break;
            }
            case OP_POSITIVE:
                break;
            case OP_NEGATE: {
                this.fastNegate();
                if (this.atError) return this.iERR();
                break;
            }
            case OP_NOT: {
                const valObj = this.popStack();
                let newValObj = new Value(VAL_BOOLEAN, this.isFalsy(valObj));
                this.pushStack(newValObj);
                break;
            }
            case OP_BW_INVERT: {
                this.fastInvert();
                if (this.atError) return this.iERR();
                break;
            }
            case OP_ADD: {
                this.add();
                if (this.atError) return this.iERR();
                break;
            }
            case OP_MOD:
            case OP_DIVIDE: {
                this.binaryOp(bytecode);
                if (this.atError) return this.iERR();
                break;
            }
            case OP_BW_LSHIFT:
            case OP_BW_RSHIFT:
            case OP_BW_AND:
            case OP_BW_OR:
            case OP_BW_XOR: {
                this.bwBinaryOp(bytecode);
                if (this.atError) return this.iERR();
                break;
            }
            case OP_POW:
            case OP_GREATER:
            case OP_LESS:
            case OP_GREATER_OR_EQUAL:
            case OP_LESS_OR_EQUAL:
            case OP_SUBTRACT:
            case OP_MULTIPLY: {
                this.binaryOp(bytecode);
                if (this.atError) return this.iERR();
                break;
            }
            case OP_EQUAL: {
                const rightValObj = this.popStack();
                const leftValObj = this.popStack();
                this.pushStack(
                    new Value(VAL_BOOLEAN, leftValObj.equals(rightValObj) | 0)
                );
                break;
            }
            case OP_NOT_EQUAL: {
                const rightValObj = this.popStack();
                const leftValObj = this.popStack();
                this.pushStack(
                    new Value(VAL_BOOLEAN, !leftValObj.equals(rightValObj) | 0)
                );
                break;
            }
            case OP_SHOW: {
                const argCount = this.readByte();
                let str;
                for (let i = argCount - 1; i >= 0; i--) {
                    // try to stringify the value. we also pass the vm (`this`)
                    // so that instances with a special str*() method can be
                    // invoked from stringify()
                    str = this.peekStack(i).stringify(false, this);
                    if (this.atError) return this.iERR();
                    out(str);
                    if (i > 0) out(" ");
                }
                out("\n");
                this.popStackN(argCount);
                break;
            }
            case OP_BUILD_LIST: {
                const size = this.readShort();
                const arr = [];
                for (let i = 0; i < size; ++i) {
                    arr.unshift(this.peekStack(i));
                }
                this.popStackN(size);
                this.pushStack(createListVal(arr, this));
                break;
            }
            case OP_BUILD_RANGE: {
                const step = this.popStack();
                const end = this.popStack();
                const start = this.popStack();
                if (!start.isInt() || !step.isInt() || !end.isInt()) {
                    this.runtimeError(
                        "Range expression sequences only with integers"
                    );
                    return this.iERR();
                }
                let valObj = createListVal(
                    this.buildListFromRange(start.value, end.value, step.value),
                    this
                );
                this.pushStack(valObj);
                break;
            }
            case OP_BUILD_DICT: {
                const length = this.readShort();
                const map = new Map();
                let key, value;
                for (let i = length * 2 - 1; i >= 0; i -= 2) {
                    value = this.peekStack(i - 1);
                    key = this.peekStack(i);
                    map.set(key, value);
                }
                this.popStackN(length * 2);
                this.pushStack(createDictVal(map, this));
                break;
            }
            case OP_SUBSCRIPT: {
                const subscript = this.popStack();
                const object = this.popStack();
                this.performSubscript(object, subscript);
                if (this.atError) return this.iERR();
                break;
            }
            case OP_SET_SUBSCRIPT: {
                const subscript = this.popStack();
                const object = this.popStack();
                this.setSubscript(object, subscript);
                if (this.atError) return this.iERR();
                break;
            }
            case OP_POP: {
                this.popCallback(this.popStack()); // todo
                break;
            }
            case OP_DEFINE_GLOBAL: {
                const val = this.popStack();
                const name = this.readString();
                this.globals.set(name, val);
                break;
            }
            case OP_GET_GLOBAL: {
                const name = this.readString();
                const val = this.globals.get(name);
                if (val === undefined) {
                    this.runtimeError(`'${name.raw}' is not defined`);
                    return this.iERR();
                }
                this.pushStack(val);
                break;
            }
            case OP_SET_GLOBAL: {
                const name = this.readString();
                if (!this.globals.has(name)) {
                    this.runtimeError(
                        `Cannot assign value to ` +
                            `undefined variable '${name.raw}'`
                    );
                    return this.iERR();
                }
                this.globals.set(name, this.peekStack());
                break;
            }
            case OP_INC: {
                const v = this.popStack();
                this.pushStack(new Value(v.type, v.value + 1));
                break;
            }
            case OP_DEC: {
                const v = this.popStack();
                this.pushStack(new Value(v.type, v.value - 1));
                break;
            }
            case OP_DEFINE_LOCAL: {
                // NOP
                this.readConst();
                break;
            }
            case OP_SET_LOCAL: {
                const index = this.readShort();
                // stackStart is the frame's stack starting point
                this.stack[this.fp.stackStart + index] = this.peekStack();
                break;
            }
            case OP_GET_LOCAL: {
                const index = this.readShort();
                this.pushStack(this.stack[this.fp.stackStart + index]);
                break;
            }
            case OP_FORMAT: {
                const size = this.readShort();
                let string = "";
                for (let i = size - 1; i >= 0; i--) {
                    string += this.peekStack(i).stringify(false, this);
                    if (this.atError) return this.iERR();
                }
                this.popStackN(size);
                this.pushStack(createVMStringVal(string, this));
                break;
            }
            case OP_JUMP: {
                const offset = this.readShort();
                this.fp.ip += offset;
                break;
            }
            case OP_JUMP_IF_FALSE: {
                const offset = this.readShort();
                if (this.isFalsy(this.peekStack())) {
                    this.fp.ip += offset;
                }
                break;
            }
            case OP_JUMP_IF_FALSE_OR_POP: {
                const offset = this.readShort();
                if (this.isFalsy(this.peekStack())) {
                    this.fp.ip += offset;
                } else {
                    this.popStack();
                }
                break;
            }
            case OP_LOOP: {
                const offset = this.readShort();
                this.fp.ip -= offset;
                break;
            }
            case OP_POP_N: {
                this.popStackN(this.readShort());
                break;
            }
            case OP_CALL: {
                if (!this.callValue(this.readByte())) {
                    return this.iERR();
                }
                break;
            }
            case OP_CLOSURE: {
                const val = this.readConst();
                const fnObj = val.asFunction();
                // store defaults if available
                for (let i = fnObj.defaultParamsCount; i > 0; --i) {
                    const index = this.popStack().asInt();
                    fnObj.defaults[index] = this.popStack();
                }
                this.pushStack(val);
                let index, isLocal;
                // handle upvalues if available
                for (let i = 0; i < fnObj.upvalueCount; i++) {
                    index = this.readByte();
                    isLocal = this.readByte();
                    if (isLocal) {
                        fnObj.upvalues[i] = this.captureUpvalue(index);
                    } else {
                        fnObj.upvalues[i] = this.fp.func.upvalues[i];
                    }
                }
                break;
            }
            case OP_GET_UPVALUE: {
                const idx = this.readByte();
                this.pushStack(this.fp.func.upvalues[idx]);
                break;
            }
            case OP_SET_UPVALUE: {
                const idx = this.readByte();
                this.fp.func.upvalues[idx] = this.peekStack();
                break;
            }
            case OP_DEF: {
                const defVal = createDefVal(this.readString());
                this.pushStack(defVal);
                break;
            }
            case OP_METHOD: {
                const method = this.popStack();
                this.peekStack()
                    .asDef()
                    .setMethod(method.asFunction().fname, method);
                break;
            }
            case OP_GET_PROPERTY: {
                // [ ref ] or [ Def ]
                const prop = this.readString();
                const val = this.peekStack();
                if (!this.getValueProperty(prop, val)) {
                    return this.iERR();
                }
                break;
            }
            case OP_SET_PROPERTY: {
                const prop = this.readString();
                const val = this.popStack();
                if (!val.isInstance()) {
                    this.propertyAssignError(val, prop);
                    return this.iERR();
                }
                const inst = val.asInstance();
                inst.setProperty(prop, this.peekStack());
                break;
            }
            case OP_GET_DEREF_PROPERTY: {
                // [ ref ][ Def ]
                const prop = this.readString();
                if (!this.bindMethod(this.popStack().asDef(), prop)) {
                    return this.iERR();
                }
                break;
            }
            case OP_INVOKE: {
                // [ ref ][ arg1 ][ arg2 ] or
                // [ Def ][ arg1 ][ arg2 ]
                const prop = this.readString();
                const arity = this.readByte();
                if (!this.invokeValue(prop, arity)) {
                    return this.iERR();
                }
                break;
            }
            case OP_INVOKE_DEREF: {
                /*
                 * the stack would be like so:
                 * [ ref ][ arg1 ][ arg2 ]...[ argn ][ Def ]
                 */
                const prop = this.readString();
                const argc = this.readByte();
                const baseVal = this.popStack();
                if (!this.invokeFromDef(baseVal.asDef(), prop, argc)) {
                    return this.iERR();
                }
                break;
            }
            case OP_DERIVE: {
                // [ base Def ][ child Def ]
                const child = this.popStack().asDef();
                const baseVal = this.peekStack();
                // todo: ensure builtin defs are sealed i.e. they can't be derived
                if (!baseVal.isDef()) {
                    this.runtimeError(
                        `'${baseVal.typeToString()}' can't be interpreted as a definition`
                    );
                    return this.iERR();
                } else if (this.isBuiltinDef(baseVal)) {
                    // todo: okay?
                    this.runtimeError(
                        `Can't derive from built-in type '${
                            baseVal.asDef().dname.raw
                        }'`
                    );
                    return this.iERR();
                }
                baseVal
                    .asDef()
                    .dmethods.forEach((v, k) => child.setMethod(k, v));
                // create a link to the base def in the child def.
                child.baseDef = baseVal.asDef();
                break;
            }
            case OP_RETURN: {
                const frame = this.popFrame();
                const val = this.popStack();
                if (!this.fp) {
                    // !this.fp indicates that we've just popped the top-level
                    // frame, which is the 'script' frame.
                    return this.iOK();
                }
                /* if the frame popped isn't the top-level frame, then return
                 * the value just popped off the stack for use by the now
                 * current frame.
                 */
                this.stack[frame.returnIndex] = val;
                this.sp = frame.returnIndex + 1;
                /* if `externCaller` is provided, then it means the vm is
                 * being invoked in an external method/function,
                 * (for example in a str*() special method).
                 * So we return the result, and give back control to the
                 * externCaller.
                 */
                if (externCaller) return this.iOK();
                break;
            }
        }
    }
};

module.exports = {
    VM,
    INTERPRET_RESULT_OK,
    INTERPRET_RESULT_ERROR,
};
