/*
 * Roo.js Bytecode Virtual Machine
 *
 */

"use strict";

const {
    Value,
    createListVal,
    createDefVal,
    createInstanceVal,
    createBoundMethodVal,
    createFunctionVal,
    createBFunctionVal,
    ConstantPool,
    VAL_INT,
    VAL_FLOAT,
    VAL_BOOLEAN,
    VAL_NULL,
    VAL_STRING,
    VAL_LIST,
    VAL_DICT,
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
    OP_GET_DEREF_PROPERTY
} = require("./opcode");
const { Disassembler } = require("./debug");
const { assert, out, print, unreachable, exitVM } = require("./utils");
const rcore = require("./rcore");
const INTERPRET_RESULT_OK = 0, INTERPRET_RESULT_ERROR = -1;
const FRAME_STACK_SIZE = 0x1000;
const MAX_FRAMES_SIZE = 80;

function VM(func, debug = true) {
    // inits
    this.debug = debug;
    this.atError = false;
    this.stack = new Array(FRAME_STACK_SIZE * MAX_FRAMES_SIZE);
    this.frames = [];
    this.fp = null; // frame pointer; current frame
    this.sp = 0; // stack pointer
    this.globals = Object.create(null);
    this.initializerMethodName = "init";

    // push 'script' function to stack
    this.pushStack(createFunctionVal(func));
    // push 'script' frame
    this.pushFrame(func);
    // register all builtin/core functions
    rcore.initAll(this);
}

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

VM.prototype.iOK = function () {
    return INTERPRET_RESULT_OK;
};

VM.prototype.iERR = function () {
    return INTERPRET_RESULT_ERROR;
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

VM.prototype.stackSize = function () {
    return this.sp;
};

VM.prototype.pushFrame = function (func) {
    if (this.frames.length >= MAX_FRAMES_SIZE) {
        this.runtimeError("Stack overflow");
        exitVM();
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
    switch (opcode) {
        case OP_DIVIDE:
            return VAL_FLOAT;
        default:
            break;
    }
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
                ? this.fp.func.fname + "()"
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
    let diagnosis = `${fnObj.fname}() takes ${arity} positional ${argsWord}`;
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
    diagnosis += `.\n${fnObj.fname}() expected${stress}${arity} ${argsWord} but got ${gotWord}`;
    return diagnosis;
};

VM.prototype.propertyAccessError = function (val, prop, defName) {
    let error;
    if (defName) {
        error = `def ${defName} has no property '${prop}'`;
        this.runtimeError(error);
    } else if (val.isInstance()) {
        error = `ref of ${val.asInstance().def.dname} has no property '${prop}'`;
        this.runtimeError(error);
    } else if (val.isDef()) {
        error = `def ${val.asDef().dname} has no property '${prop}'`;
        this.runtimeError(error);
    }
};

VM.prototype.propertyAssignError = function (val, prop) {
    this.runtimeError(
        `Cannot set property '${prop}' on '${val.typeToString()}' type.`
    );
};

VM.prototype.subscriptError = function (val) {
    this.runtimeError(
        `'${val.typeToString()}' value is not subscriptable`
    );
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
    const val = leftVal.value ** rightVal.value;
    if (val === Infinity) {
        this.runtimeError("Value too large"); // todo
        return this.dummyVal();
    }
    return val;
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
    let result;
    if (leftVal.isNumber() && rightVal.isNumber()) {
        result = new Value(this.computeNumType(leftVal.type, rightVal.type));
        result.value = this[OP_ADD](leftVal, rightVal);
        this.pushStack(result);
    } else if (leftVal.isString() && rightVal.isString()) {
        result = new Value(VAL_STRING, leftVal.value + rightVal.value);
        this.pushStack(result);
    } else if (leftVal.isList() && rightVal.isList()) {
        let list = leftVal.value.slice();
        rightVal.value.forEach((item) => list.push(item));
        result = new Value(VAL_LIST, list);
        this.pushStack(result);
    } else {
        // todo: hook other types here. for starters, instance type
        this.runtimeError(this.binaryErrorMsg(leftVal, rightVal, OP_ADD));
    }
};

VM.prototype.binaryOp = function (opcode) {
    const rightVal = this.popStack();
    const leftVal = this.popStack();
    if (leftVal.isNumber() && rightVal.isNumber()) {
        let result = new Value(
            this.computeNumType(leftVal.type, rightVal.type, opcode)
        );
        result.value = this[opcode](leftVal, rightVal);
        this.pushStack(result);
        return;
    }
    // todo: hook other types here.
    this.runtimeError(this.binaryErrorMsg(leftVal, rightVal, opcode));
};

VM.prototype.bwBinaryOp = function (opcode) {
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

VM.prototype.isFalsy = function (valObj) {
    // todo: update
    return (
        (valObj.isNumber() && !valObj.value) || // covers boolean
        (valObj.isString() && !valObj.value.length) ||
        (valObj.isList() && !valObj.value.length) ||
        (valObj.isDict() && !valObj.value.size) ||
        valObj.isNull()
    );
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

VM.prototype.validateListIndexExpr = function (list, idx) {
    if (!list.isList()) {
        this.subscriptError(list);
        return undefined;
    }
    if (!idx.isInt()) {
        this.runtimeError(
            `list indices must be an integer, not ${idx.typeToString()}`
        );
        return undefined;
    }
    let index = idx.value < 0 ? list.value.length + idx.value : idx.value;
    if (Math.abs(index) >= list.value.length) {
        this.runtimeError("list index out of range");
        return undefined;
    }
    return index;
};

VM.prototype.performSubscript = function (object, subscript) {
    // todo: string and user defined types
    if (object.isList()) {
        const index = this.validateListIndexExpr(object, subscript);
        if (index === undefined) {
            return;
        }
        this.pushStack(object.value[index]);
    } else if (object.isDict()) {
        const val = object.asDict().get(subscript.toString());
        if (val === undefined) {
            this.runtimeError(`dict has no key ${subscript.toString()}`);
            return;
        }
        this.pushStack(val);
    } else {
        this.subscriptError(object);
    }
};

VM.prototype.setSubscript = function (object, subscript) {
    // todo: string and user defined types
    if (object.isList()) {
        const index = this.validateListIndexExpr(object, subscript);
        if (index === undefined) {
            return;
        }
        object.value[index] = this.peekStack();
    } else if (object.isDict()) {
        const val = this.peekStack();
        if (val === object) {
            this.runtimeError("Cannot set dict object to itself");
            return;
        }
        object.value.set(subscript.toString(), this.peekStack());
    }
};

VM.prototype.getValProperty = function (prop, val) {
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
    } else {
        this.propertyAccessError(val, prop);
    }
    return !this.atError;
};

VM.prototype.captureUpvalue = function (index) {
    return this.stack[this.fp.stackStart + index];
};

VM.prototype.variadicCall = function (fnObj, arity) {
    const listObj = createListVal();
    if (arity > fnObj.arity) {
        // Pack all extra args, starting
        // from the arg matching the arity, into a list.
        for (let i = 0, count = (arity - fnObj.arity); i <= count; ++i) {
            listObj.value.unshift(this.popStack());
        }
        this.pushStack(listObj);
    } else if ((fnObj.arity - arity) === 1) {
        // the function is missing only the variadic/spread argument
        // we cater for this by passing an empty list
        this.pushStack(listObj);
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

VM.prototype.callFn = function (fnVal, arity) {
    const fnObj = fnVal.asFunction();
    if (fnObj.arity !== arity) {
        // first, handle default params if available, to enable easy
        // shell out to variadicCall()
        if (fnObj.defaultParamsCount) {
            this.defaultCall(fnObj, arity);
        } else if (fnObj.isVariadic) {
            // handle a variadic call
            this.variadicCall(fnObj, arity);
        } else {
            this.runtimeError(this.argumentError(fnObj, arity));
        }
    } else if (fnObj.isVariadic) {
        // function is variadic, but arity matches.
        // Make the last argument a list
        let listObj = createListVal();
        listObj.value.push(this.popStack());
        this.pushStack(listObj);
    }
    // does this function have a builtin executable (callable)?
    if (fnObj.builtinExec) {
        // handle builtin methods
        this.callBuiltinMethod(fnObj);
    } else {
        // if not, just push the frame
        this.pushFrame(fnObj);
    }
};

VM.prototype.callBuiltinMethod = function (fnObj, arity) {
    // call and set the return value directly
    this.stack[this.sp - 1 - arity] = fnObj.builtinExec(this);
    // trim the stack pointer - to reflect the return of the builtinExec
    this.sp -= arity;
};

VM.prototype.callBuiltinFn = function (val, arity) {
    const bFn = val.asBFunction();
    // todo: enhance
    if (bFn.arity !== arity) {
        const argsWord = bFn.arity > 1 ? "arguments" : "argument";
        const arityWord = arity >= 1 ? arity : "none";
        const error = `${bFn.fname}() takes ${bFn.arity} ${argsWord} but got ${arityWord}`;
        this.runtimeError(error);
    }
    this.stack[this.sp - 1 - arity] = bFn.builtinFn(this); // returns a Value() obj
    this.sp -= arity;
};

VM.prototype.callDef = function (val, arity) {
    const defObj = val.asDef();
    // insert instance object at `def`s position
    this.stack[this.sp - 1 - arity] = createInstanceVal(defObj);
    let init;
    if (
        (init = defObj.getMethod(this.initializerMethodName)) &&
        init.asFunction().isSpecialMethod
    ) {
        this.callFn(init, arity);
    } else if (arity) {
        this.runtimeError(
            `${defObj.dname} ` + `takes no argument but got ${arity}.`
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
            // simulate `OP_GET_PROPERTY idx` by placing the property
            // on the stack at the instance's position, and allowing
            // callValue() handle the call
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
            // we're certain that this is a Value(FunctionObject), since a def's
            // `dmethods` can contain only Value(FunctionObject) values. So we
            // call the function directly, instead of going through callValue().
            this.callFn(propVal, arity);
        } else {
            this.propertyAccessError(val, prop);
        }
    } else {
        this.propertyAccessError(val, prop);
    }
    return !this.atError;
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
                    new Value(VAL_BOOLEAN, leftValObj.equals(rightValObj))
                );
                break;
            }
            case OP_NOT_EQUAL: {
                const rightValObj = this.popStack();
                const leftValObj = this.popStack();
                this.pushStack(
                    new Value(VAL_BOOLEAN, !leftValObj.equals(rightValObj))
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
                let valObj = createListVal();
                for (let i = 0; i < size; ++i) {
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
                if (!start.isInt() || !step.isInt() || !end.isInt()) {
                    this.runtimeError(
                        "Range expression sequences only with integers"
                    );
                    return this.iERR();
                }
                let valObj = new Value(
                    VAL_LIST,
                    this.buildListFromRange(start.value, end.value, step.value)
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
                this.popStack();
                break;
            }
            case OP_DEFINE_GLOBAL: {
                const val = this.popStack();
                const name = this.readString();
                this.globals[name] = val;
                break;
            }
            case OP_GET_GLOBAL: {
                const name = this.readString();
                const val = this.globals[name];
                if (val === undefined) {
                    this.runtimeError(`'${name}' is not defined`);
                    return this.iERR();
                }
                this.pushStack(val);
                break;
            }
            case OP_SET_GLOBAL: {
                const name = this.readString();
                if (!(name in this.globals)) {
                    this.runtimeError(
                        `Cannot assign value to` +
                            `undefined variable '${name}'`
                    );
                    return this.iERR();
                }
                this.globals[name] = this.peekStack();
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
                let string = new Value(VAL_STRING, "");
                for (let i = size - 1; i >= 0; i--) {
                    string.value += this.peekStack(i).stringify(false, this);
                    if (this.atError) return this.iERR();
                }
                this.popStackN(size);
                this.pushStack(string);
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
                    const index = this.popStack();
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
                if (!this.getValProperty(prop, val)) {
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
                if (!baseVal.isDef()) {
                    this.runtimeError(
                        `'${baseVal.typeToString()}' can't be interpreted as a definition`
                    );
                    return this.iERR();
                }
                baseVal.asDef().dmethods.forEach(
                    (v, k) => child.setMethod(k, v)
                );
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
