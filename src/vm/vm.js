/*
 * Roo.js Bytecode Virtual Machine
 *
 */

"use strict";

const {
  Value,
  getStringObj,
  createVMStringVal,
  createTrueVal,
  createFalseVal,
  createListVal,
  createDictVal,
  createInstanceVal,
  createBoundMethodVal,
  createFunctionVal,
  createModuleObj,
  createModuleVal,
  VAL_INT,
  VAL_FLOAT,
  VAL_BOOLEAN,
  VAL_NULL,
} = require("../constant/value");
const { createDefVal } = require("../rcore/types/def");
const {
  $ADD,
  $SUBTRACT,
  $MULTIPLY,
  $DIVIDE,
  $RETURN,
  $LOAD_CONST,
  $LOAD_NULL,
  $LOAD_TRUE,
  $LOAD_FALSE,
  $POSITIVE,
  $NEGATE,
  $BW_INVERT,
  $NOT,
  $GREATER,
  $LESS,
  $GREATER_OR_EQUAL,
  $LESS_OR_EQUAL,
  $EQUAL,
  $NOT_EQUAL,
  $BW_LSHIFT,
  $BW_RSHIFT,
  $POW,
  $MOD,
  $INSTOF,
  $BW_AND,
  $BW_OR,
  $BW_XOR,
  $SHOW,
  $BUILD_LIST,
  $BUILD_RANGE,
  $SUBSCRIPT,
  $POP,
  $DEFINE_GLOBAL,
  $GET_GLOBAL,
  $SET_GLOBAL,
  $SET_SUBSCRIPT,
  $INC,
  $DEC,
  $DEFINE_LOCAL,
  $GET_LOCAL,
  $SET_LOCAL,
  $FORMAT,
  $JUMP,
  $JUMP_IF_FALSE,
  $LOOP,
  $POP_N,
  $JUMP_IF_FALSE_OR_POP,
  $BUILD_DICT,
  $CALL,
  $GET_UPVALUE,
  $SET_UPVALUE,
  $DEF,
  $CLOSURE,
  $METHOD,
  $GET_PROPERTY,
  $SET_PROPERTY,
  $INVOKE,
  $DERIVE,
  $INVOKE_DEREF,
  $GET_DEREF_PROPERTY,
  $SETUP_EXCEPT,
  $POP_EXCEPT,
  $PANIC,
  $BUILD_LIST_UNPACK,
  $CALL_UNPACK,
  $INVOKE_DEREF_UNPACK,
  $IMPORT_MODULE,
  $DELETE_SUBSCRIPT,
  $DELETE_PROPERTY,
} = require("../code/opcode");
const {
  assert,
  out,
  print,
  unreachable,
  MAX_FUNCTION_PARAMS,
} = require("../utils");
const fs = require("fs");
const path = require("path");
const rcore = require("../rcore/core");
const exceptMod = require("../rcore/defs/except");
const { Compiler } = require("../compiler/compiler");
const { Disassembler } = require("../debug/disassembler");
const { parseSourceInternal } = require("../parser/parser");
const MAX_FRAMES_SIZE = 80;
const FRAME_STACK_SIZE = 0x1000;
const MAX_HANDLER_STACK_SIZE = 0x200;
const INTERPRET_RESULT_OK = 1,
  INTERPRET_RESULT_ERROR = 0;

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
  this.errorHandled = 0x01;
  this.stack = new Array(FRAME_STACK_SIZE * MAX_FRAMES_SIZE);
  this.frames = [];
  this.fp = null; // frame pointer; current frame
  this.sp = 0; // stack pointer
  this.envName = repl ? "(repl)" : "(module)";
  this.execFnNow = false;
  this.popCallback = null; // todo
  this.currentModule = null; // pointer to the current running module
  this.builtinsModule = null; // pointer to builtins module
  this.builtins = new Map();
  this.globals = new Map(); // vm's own globals
  this.modules = new Map(); // Map<StringObject, Value(ModuleObject)>
  this.internedStrings = strings || new Map();
  this.initializerMethodName = getStringObj("__init__", this.internedStrings);
  this.stringMethodName = getStringObj("__str__", this.internedStrings);

  // set the callback handler for $POP instruction
  this.setPopCallback(repl); // todo
  // push 'environment' function on the value stack
  this.pushStack(createFunctionVal(func));
  // push 'environment' frame
  this.pushFrame(func);
  // set disassembler
  this.dis = new Disassembler(this.fp.func, this.debug);
  // register all builtin/core functions
  rcore.initAll(this);
  // initialize the module as the entry point
  assert(func.module.name === null, "Entry module should have no name");
  this.initModule(func.module);
  this.gpath = "";
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
  // error handler pointer
  this.hp = null;
  // location/point where the function returns to, i.e.
  // where the function's return value is stored.
  this.returnIndex = retPoint;
  // the starting point of the stack from the function's window/perspective.
  // same as returnIndex, but with a more appropriate name for properly
  // indexing into the stack.
  this.stackStart = retPoint;
  // the error handler stack
  this.handlerStack = [];
  // the stack; yes, that 'stack'.
  this.stack = stack;
}

CallFrame.prototype.pushHandler = function (handlerIndex, currentStackTop) {
  if (this.handlerStack.length >= MAX_HANDLER_STACK_SIZE) {
    this.fatalError("Stack Overflow: too many try-except blocks");
    return;
  }
  // we need to have a snapshot of where the stack pointer currently
  // is before the try-except handler was setup i.e. `currentStackTop`.
  // `handlerIndex` is where the ip jumps to if an exception occurs.
  this.hp = [handlerIndex, currentStackTop];
  this.handlerStack.push(this.hp);
};

CallFrame.prototype.popHandler = function () {
  this.handlerStack.pop();
  this.hp = this.handlerStack[this.handlerStack.length - 1] || null;
};

/**
 * Re-initialize the VM with a new FunctionObject, after it
 * has originally been created.
 * @param {FunctionObject} fnObj
 */
VM.prototype.initFrom = function (fnObj) {
  // push 'environment' function on the value stack
  this.pushStack(createFunctionVal(fnObj));
  // push 'environment' frame
  this.pushFrame(fnObj);
  // reset the disassembler for the new function
  this.dis.reset(this.fp.func, this.debug);
  rcore.initInternedStrings(this, null);
};

/**
 * Initialize a module
 * @param {ModuleObject} module
 * @returns {Value|*}
 */
VM.prototype.initModule = function (module) {
  // store the module as a Value object, and
  // initialize it with the VM globals
  const mod = createModuleVal(module);
  this.modules.set(module.name, mod); // Map<StringObject, Value(ModuleObject)>
  module.globals = new Map(this.globals);
  return mod;
};

VM.prototype.iOK = function () {
  return INTERPRET_RESULT_OK;
};

VM.prototype.iERR = function () {
  return INTERPRET_RESULT_ERROR;
};

VM.prototype.hasError = function () {
  return this.atError;
};

VM.prototype.errorIsHandled = function () {
  return this.errorHandled & (1 << 1);
};

VM.prototype.clearError = function () {
  this.atError = false;
  this.errorHandled = 1;
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
    this.fatalError("Stack overflow");
    return;
  }
  const retIndex = this.sp - 1 - func.arity;
  const frame = new CallFrame(func, retIndex, this.stack);
  this.frames.push(frame);
  this.fp = frame;
  this.currentModule = this.fp.func.module;
};

VM.prototype.popFrame = function () {
  const frame = this.frames.pop();
  this.fp = this.frames[this.frames.length - 1];
  this.currentModule = this.fp ? this.fp.func.module : null;
  return frame;
};

VM.prototype.addFrame = function (frame) {
  this.frames.push(frame);
  this.fp = frame;
};

VM.prototype.currentFrame = function () {
  return this.frames[this.frames.length - 1];
};

VM.prototype.setPopCallback = function (repl) {
  // set the callback used in handling an $POP instruction; this
  // allows the VM to overload the pop instruction depending
  // on the environment the VM is being invoked in.
  this.popCallback = repl
    ? (val) => print(val.stringify(true, this))
    : (_) => {};
};

VM.prototype.execNow = function (value, arity) {
  this.execFnNow = true;
  this.callValue(arity, value);
  this.execFnNow = false;
  return !this.hasError();
};

VM.prototype.handleException = function (msgStr, msgVal) {
  // set ip to the exception handler point
  this.fp.ip = this.fp.hp[0];
  // reset the stack to the last known valid point using the
  // stack snapshot. see pushHandler() for more info
  this.sp = this.fp.hp[1];
  // pop the handler off the handler stack
  this.fp.popHandler();
  this.errorHandled = (this.errorHandled << 0x1) | 0x1;
  // push an exception instance (with the error msg) on the stack
  this.pushStack(exceptMod.getErrorValue(this, msgStr, msgVal));
};

// todo: rework this method
VM.prototype.computeNumType = function (leftType, rightType, opcode) {
  /*
   *   x  | int   | float | bool
   * ---------------------------
   * int  | int   | float | int
   * ----------------------------
   * float| float | float | float
   * ----------------------------
   * bool | int   | float | int
   * ----------------------------
   * int -> 0 | float -> 1 | bool -> 2 (see value.js)
   */
  assert(
    leftType <= 2 && rightType <= 2,
    "VM::computeNumType() - num types changed"
  );
  if (opcode === $DIVIDE) {
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
/**
 * @param {string} msgStr: the message as a JS string if available
 * @param {Value} msgVal: the message as a Value object if available
 * @param isFatal: flag indicating if the error is recoverable or not
 */
VM.prototype.runtimeError = function (msgStr, msgVal = null, isFatal = false) {
  this.atError = true;
  let repeatingFrameCount = 0;
  let prevFrame = null;
  let stackTrace = "";
  let srcAtLine;
  while (this.fp !== undefined) {
    // check for exception handlers
    if (!isFatal && this.fp.hp !== null) {
      this.handleException(msgStr, msgVal);
      stackTrace = null;
      return;
    }
    // handle consecutive repeating frames
    if (prevFrame && prevFrame.func.fname === this.fp.func.fname) {
      repeatingFrameCount++;
      if (repeatingFrameCount >= 4) {
        prevFrame = this.popFrame();
        continue;
      }
    }
    // gather the stack trace
    // ( -1 since ip points at the _next_ instruction)
    srcAtLine = this.getLineSrcCode(this.fp.ip - 1);
    if (srcAtLine && srcAtLine !== 0xff) {
      const fnName = this.fp.func.fname
        ? this.fp.func.fname.raw + "()"
        : this.envName;
      const fpath = this.fp.func.module.fpath || this.envName;
      const lineNum = this.fp.func.code.lines[this.fp.ip - 1];
      stackTrace += `<File "${fpath}", Line ${lineNum}: in ${fnName}>\n`;
      stackTrace += `  ${srcAtLine.trim()}\n`;
    }
    prevFrame = this.popFrame();
  }

  // if a Value() object is provided as the message, obtain the
  // stringified form of the object.
  if (msgVal) {
    // reuse the last frame
    this.addFrame(prevFrame);
    // temporarily clear the error state
    this.atError = false;
    // obtain the string value of `msgVal` - this might invoke a function,
    // which is why the error state had to be cleared above
    msgStr = msgVal.stringify(false, this);
    // reset error state to its previous value
    this.atError = true;
    // pop off the reused frame
    this.popFrame();
  }
  console.error(stackTrace.trimEnd());
  console.error(`RuntimeError: ${msgStr}`);
};

VM.prototype.fatalError = function (msgStr) {
  this.runtimeError(msgStr, null, true);
};

VM.prototype.argumentError = function (fnObj, got) {
  // todo: enhance
  const arity = fnObj.arity - fnObj.isVariadic - fnObj.defaultParamsCount;
  const argsWord = arity > 1 ? "arguments" : "argument";
  const gotWord = got >= 1 ? got : "none.";
  const arityWord = arity || "no";
  let diagnosis = `${fnObj.fname.raw}() takes ${arityWord} positional ${argsWord}`;
  let stress =
    fnObj.defaultParamsCount || fnObj.isVariadic ? " at least " : " ";
  if (fnObj.defaultParamsCount) {
    const argsWord = fnObj.defaultParamsCount > 1 ? "arguments" : "argument";
    diagnosis += `, has ${fnObj.defaultParamsCount} default ${argsWord}`;
  }
  if (fnObj.isVariadic) {
    diagnosis += `, and an (optional) variadic/spread argument`;
  }
  diagnosis += `.\n${fnObj.fname.raw}() expected${stress}${arityWord} ${argsWord} but got ${gotWord}`;
  return diagnosis;
};

VM.prototype.propertyAccessError = function (val, prop, defName) {
  let error;
  if (defName) {
    // `defName` is provided when the error happens on the instance
    // but the instance isn't available to be passed to this method.
    // so, we handle it as if the instance was passed.
    error = `ref of '${defName.raw}' has no property '${prop.raw}'`;
  } else if (val.isInstance()) {
    error = `ref of '${val.asInstance().def.dname.raw}' has no property '${
      prop.raw
    }'`;
  } else if (val.isDef()) {
    error = `'${val.asDef().dname.raw}' has no property '${prop.raw}'`;
  } else if (val.isModuleObject()) {
    error = `module '${val.asModule().name.raw}' has no property '${prop.raw}'`;
  } else if (val.isDict()) {
    error = `dict has no key '${prop.raw}'`;
  } else {
    error = `'${val.typeToString()}' has no property '${prop.raw}'`;
  }
  this.runtimeError(error);
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

VM.prototype[$ADD] = function (leftVal, rightVal) {
  return leftVal.value + rightVal.value;
};

VM.prototype[$SUBTRACT] = function (leftVal, rightVal) {
  return leftVal.value - rightVal.value;
};

VM.prototype[$MULTIPLY] = function (leftVal, rightVal) {
  return leftVal.value * rightVal.value;
};

VM.prototype[$DIVIDE] = function (leftVal, rightVal) {
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

VM.prototype[$BW_LSHIFT] = function (leftVal, rightVal) {
  if (rightVal.value < 0) {
    this.runtimeError("negative shift count");
    return;
  }
  return leftVal.value << rightVal.value;
};

VM.prototype[$BW_RSHIFT] = function (leftVal, rightVal) {
  if (rightVal.value < 0) {
    this.runtimeError("negative shift count");
    return;
  }
  return leftVal.value >> rightVal.value;
};

VM.prototype[$BW_AND] = function (leftVal, rightVal) {
  return leftVal.value & rightVal.value;
};

VM.prototype[$BW_OR] = function (leftVal, rightVal) {
  return leftVal.value | rightVal.value;
};

VM.prototype[$BW_XOR] = function (leftVal, rightVal) {
  return leftVal.value ^ rightVal.value;
};

VM.prototype[$MOD] = function (leftVal, rightVal) {
  if (rightVal.value === 0) {
    this.runtimeError("Attempt to divide by zero");
    return this.dummyVal();
  }
  return leftVal.value % rightVal.value;
};

VM.prototype[$POW] = function (leftVal, rightVal) {
  // todo: handle infinity on all number operations
  return leftVal.value ** rightVal.value;
};

VM.prototype[$GREATER] = function (leftVal, rightVal) {
  return leftVal.value > rightVal.value;
};

VM.prototype[$LESS] = function (leftVal, rightVal) {
  return leftVal.value < rightVal.value;
};

VM.prototype[$GREATER_OR_EQUAL] = function (leftVal, rightVal) {
  return leftVal.value >= rightVal.value;
};

VM.prototype[$LESS_OR_EQUAL] = function (leftVal, rightVal) {
  return leftVal.value <= rightVal.value;
};

VM.prototype.opcodeToString = function (opcode) {
  switch (opcode) {
    case $ADD:
      return "+";
    case $SUBTRACT:
      return "-";
    case $DIVIDE:
      return "/";
    case $MULTIPLY:
      return "*";
    case $BW_LSHIFT:
      return "<<";
    case $BW_RSHIFT:
      return ">>";
    case $BW_AND:
      return "&";
    case $BW_OR:
      return "|";
    case $BW_XOR:
      return "^";
    case $MOD:
      return "%";
    case $POW:
      return "**";
    case $GREATER:
      return ">";
    case $LESS:
      return "<";
    case $GREATER_OR_EQUAL:
      return ">=";
    case $LESS_OR_EQUAL:
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
        this[$ADD](leftVal, rightVal)
      )
    );
  } else if (leftVal.isString() && rightVal.isString()) {
    this.pushStack(
      createVMStringVal(leftVal.asString().raw + rightVal.asString().raw, this)
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
    this.runtimeError(this.binaryErrorMsg(leftVal, rightVal, $ADD));
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
    let result = new Value(this.computeNumType(leftVal.type, rightVal.type));
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

VM.prototype.instanceOf = function () {
  const obj2 = this.popStack();
  const obj1 = this.popStack();
  if (!obj2.isDef()) {
    this.runtimeError(`second arg must be a definition`);
  }
  const defName = obj2.asDef().dname.raw;
  if (obj1.isInt() && defName === "Int") {
    this.pushStack(createTrueVal());
  } else if (obj1.isFloat() && defName === "Float") {
    this.pushStack(createTrueVal());
  } else if (!obj1.as().def) {
    this.pushStack(createFalseVal());
  } else if (obj1.asInstance().def === obj2.asDef()) {
    this.pushStack(createTrueVal());
  } else {
    let def = obj1.asInstance().def.baseDef,
      desc = obj2.asDef();
    while (def) {
      if (def === desc) {
        this.pushStack(createTrueVal());
        break;
      }
      def = def.baseDef;
    }
    this.pushStack(createFalseVal());
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
    const list = object.asList().elements;
    const index = this.validateIndexExpr(
      list.length,
      subscript,
      object.typeToString()
    );
    if (index === undefined) {
      return;
    }
    list[index] = this.peekStack();
  } else if (object.isDict()) {
    object.asDict().setVal(subscript, this.peekStack());
  } else {
    this.runtimeError(
      `'${object.typeToString()}' type does not support index assignment`
    );
  }
};

VM.prototype.deleteSubscript = function (object, subscript) {
  if (object.isList()) {
    const list = object.asList().elements;
    const index = this.validateIndexExpr(
      list.length,
      subscript,
      object.typeToString()
    );
    if (index === undefined) {
      return;
    }
    list.splice(index, 1);
  } else if (object.isDict()) {
    if (!object.asDict().delVal(subscript)) {
      this.runtimeError(`dict has no key ${subscript.stringify(true)}`);
    }
  } else {
    this.subscriptError(object);
  }
};

VM.prototype.deleteProperty = function (object, propVal) {
  const prop = propVal.asString();
  if (object.isInstance()) {
    const inst = object.asInstance();
    if (!inst.delProperty(prop)) {
      this.propertyAccessError(null, prop, inst.def.dname);
    }
  } else if (object.isDict()) {
    const dict = object.asDict();
    if (!dict.delVal(propVal)) {
      this.runtimeError(`dict has no key '${prop.raw}'`);
    }
  } else {
    this.runtimeError(
      `Cannot delete property '${prop.raw}' of ${object.typeToString()}`
    );
  }
};

/**
 * Get the Value property of a Value object
 * @param {StringObject} prop: the property
 * @param {Value} objVal: the object from which the property is to be obtained
 * @param {Value} propVal: the property as a Value object
 * @returns {boolean}
 */
VM.prototype.getValueProperty = function (prop, objVal, propVal) {
  let found;
  if (objVal.isInstance()) {
    const inst = objVal.asInstance();
    // try to obtain the property from the instance's `props`
    if ((found = inst.getProperty(prop))) {
      this.popStack();
      this.pushStack(found);
    } else {
      // if not in there, check the instances' `def`'s 'dmethods'
      this.bindMethod(inst.def, prop);
    }
  } else if (objVal.isDict()) {
    const dict = objVal.asDict();
    if ((found = dict.getVal(propVal))) {
      this.popStack();
      this.pushStack(found);
    } else {
      // delegate to the dict's def if propVal isn't found
      this.bindMethod(dict.def, prop);
    }
  } else if (objVal.isDef()) {
    const def = objVal.asDef();
    if ((found = def.getMethod(prop)) && found.asFunction().isStaticMethod) {
      this.popStack();
      this.pushStack(found);
    } else {
      this.propertyAccessError(objVal, prop);
    }
  } else if (objVal.isBuiltinObject()) {
    this.bindMethod(objVal.getBuiltinDef(), prop);
  } else if (objVal.isModuleObject()) {
    const foundVal = objVal.asModule().getItem(prop);
    if (foundVal) {
      this.popStack();
      this.pushStack(foundVal);
    } else {
      this.propertyAccessError(objVal, prop);
    }
  } else {
    this.propertyAccessError(objVal, prop);
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
  } else if (fnObj.isVariadic) {
    // arity > fnObj.arity
    this.variadicCall(fnObj, arity);
  } else {
    this.runtimeError(this.argumentError(fnObj, arity));
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
  if (fnObj.builtinFn) {
    // handle builtin methods
    this.callBuiltinFnOrMethod(fnObj, fnObj.arity);
  } else {
    // if not, just push the frame
    this.pushFrame(fnObj);
    if (this.execFnNow) {
      return this.run(fnVal);
    }
  }
};

VM.prototype.callBuiltinFnOrMethod = function (fnObj, arity) {
  // call and set the return value directly
  const result = fnObj.builtinFn(this, arity);
  if (this.atError) return;
  this.stack[this.sp - 1 - arity] = result;
  // trim the stack pointer - to reflect the return of the builtinFn
  this.sp -= arity;
};

VM.prototype.callBuiltinFn = function (val, arity) {
  const bFn = val.asBFunction();
  if (bFn.arity !== arity) {
    const argsWord = bFn.arity > 1 ? "arguments" : "argument";
    const arityWord = arity >= 1 ? arity : "none";
    const error = `${bFn.fname.raw}() takes ${bFn.arity} ${argsWord} but got ${arityWord}`;
    this.runtimeError(error);
  } else {
    // `bFn.builtinFn` returns a Value() obj
    const result = bFn.builtinFn(this, arity);
    if (this.atError) return;
    this.stack[this.sp - 1 - arity] = result;
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

VM.prototype.callValue = function (arity, value = null) {
  let val = value || this.peekStack(arity);
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

/**
 * Invoke a Value object
 * @param {StringObject} prop: the property to be invoked on the object
 * @param {number} arity: the number of arguments passed
 * @param {Value} propVal: the property as a Value object
 * @returns {boolean}
 */
VM.prototype.invokeValue = function (prop, arity, propVal) {
  const val = this.peekStack(arity);
  // todo: improve this
  let found;
  if (val.isInstance()) {
    const inst = val.asInstance();
    if ((found = inst.getProperty(prop))) {
      /*
       * simulate `$GET_PROPERTY index` by placing the property
       * on the stack at the instance's position, and allowing
       * callValue() handle the call
       */
      this.stack[this.sp - 1 - arity] = found;
      this.callValue(arity);
    } else {
      // try to obtain the property/attribute from the def
      this.invokeFromDef(inst.def, prop, arity);
    }
  } else if (val.isDict()) {
    const dict = val.asDict();
    if ((found = dict.getVal(propVal))) {
      /*
       * simulate `$GET_PROPERTY index` by placing the property
       * on the stack at the dict's position, and allowing
       * callValue() handle the call
       */
      this.stack[this.sp - 1 - arity] = found;
      this.callValue(arity);
    } else {
      // try to obtain the property/attribute from the def
      this.invokeFromDef(dict.def, prop, arity);
    }
  } else if (val.isDef()) {
    const def = val.asDef();
    if ((found = def.getMethod(prop)) && found.asFunction().isStaticMethod) {
      this.stack[this.sp - 1 - arity] = found;
      /*
       * we're certain that this is a Value(FunctionObject),
       * since a def's `dmethods` can contain only Value(FunctionObject)
       * values. So we call the function directly, instead of going
       * through callValue().
       */
      this.callFn(found, arity);
    } else {
      this.propertyAccessError(val, prop);
    }
  } else if (val.isBuiltinObject()) {
    this.invokeFromDef(val.getBuiltinDef(), prop, arity);
  } else if (val.isModuleObject()) {
    const propVal = val.asModule().getItem(prop);
    if (propVal) {
      /*
       * simulate `$GET_PROPERTY index` by placing the property
       * on the stack at the module's position, and allowing
       * callValue() handle the call
       */
      this.stack[this.sp - 1 - arity] = propVal;
      this.callValue(arity);
    } else {
      this.propertyAccessError(val, prop);
    }
  } else {
    this.propertyAccessError(val, prop);
  }
  return !this.atError;
};

VM.prototype.unpackArgs = function (arity) {
  // all potential args are lists
  let arr = this.peekStack(arity - 1).asList().elements;
  for (let i = arity - 2; i >= 0; --i) {
    arr = arr.concat(this.peekStack(i).asList().elements);
  }
  if (arr.length > MAX_FUNCTION_PARAMS) {
    this.runtimeError(
      `Too many arguments to unpack. Max number of arguments is ${MAX_FUNCTION_PARAMS}`
    );
    return null;
  }
  this.popStackN(arity);
  for (let i = 0; i < arr.length; ++i) this.pushStack(arr[i]);
  return arr.length;
};

/**
 * Resolve the module path
 * @param {StringObject} modulePath
 * @param {boolean} isRelativeImport
 * @returns {boolean}
 */
VM.prototype.resolvePath = function (modulePath, isRelativeImport) {
  // currently, we're assuming the module exists in the current directory
  // as the current running module.
  let filename;
  if (isRelativeImport) {
    filename = modulePath.raw;
  } else {
    filename = modulePath.raw.replace(/\./g, path.sep);
  }
  filename += ".rk";
  if (fs.existsSync(filename)) {
    return filename;
  }
  let fpath = path.resolve(path.dirname(this.currentModule.fpath), filename);
  if (fs.existsSync(fpath)) {
    return fpath;
  }
  // check for other expected places where the module could be [todo: ok?]
  this.gpath = this.gpath || path.dirname(path.dirname(__dirname));
  fpath = path.join(this.gpath, "src", "stdlib", filename);
  if (fs.existsSync(fpath)) {
    return fpath;
  }
  return null;
};

/**
 * compile a module given its path
 * @param {StringObject} modulePath: original specified path / module name
 * @param {string} resolvedPath: resolved path to the module, a js string
 * @returns {null|Value}
 */
VM.prototype.compileModule = function (modulePath, resolvedPath) {
  // read and parse the module file
  const src = fs.readFileSync(resolvedPath).toString();
  const [root, parser] = parseSourceInternal(src, resolvedPath);
  if (parser.parsingFailed()) return null;

  // store & initialize the module with VM globals
  const moduleObj = createModuleObj(modulePath, resolvedPath);
  const moduleVal = this.initModule(moduleObj);

  // compile the module
  const compiler = new Compiler(parser, moduleObj);
  const fnObj = compiler.compile(root, this.internedStrings);
  if (compiler.compilationFailed()) return null;
  assert(
    fnObj.module === moduleObj,
    "VM::compileModule::Failed to assign module"
  );

  // push the module on the stack. This will be returned by the
  // module 'function' (environment function containing all the module's code)
  // when its execution completes
  this.pushStack(moduleVal);
  // push the module's function frame, for execution of the module.
  this.pushFrame(fnObj);
  return moduleVal;
};

/**
 * Import a module, given its syntactic path
 * @param {Value} modulePath: StringObject type indicating the
 * module's syntactic path
 * @param {boolean} isRelativeImport
 */
VM.prototype.importModule = function (modulePath, isRelativeImport) {
  // check if this module has already been imported
  const fp = modulePath.asString();
  let module = this.modules.get(fp);
  if (module) {
    // place the module on the stack for use
    this.pushStack(module);
    return module;
  }
  // if not, try to import it
  const resolvedPath = this.resolvePath(fp, isRelativeImport);
  if (!resolvedPath) {
    // check if it's a core module
    module = rcore.getModule(fp.raw, this);
    if (!module) {
      this.runtimeError(`Could not find module '${fp.raw}'`);
      return null;
    }
    // cache the module
    this.modules.set(module.name, module);
    // place the module on the stack for use
    this.pushStack(module);
    return module;
  }
  return this.compileModule(fp, resolvedPath);
};

VM.prototype.isCoreDef = function (defVal) {
  return rcore.coreDefs.includes(defVal.asDef().dname.raw);
};

VM.prototype.interpret = function () {
  let res;
  while (1) {
    res = this.run();
    if (this.hasError() && this.errorIsHandled()) {
      this.clearError();
    } else {
      return res;
    }
  }
};

VM.prototype.run = function (externCaller) {
  for (;;) {
    if (this.debug) {
      this.printStack();
      this.dis.disassembleInstruction(this.fp.ip, this.fp.func.code);
    }
    const bytecode = this.readByte();
    switch (bytecode) {
      case $LOAD_NULL: {
        this.pushStack(new Value(VAL_NULL));
        break;
      }
      case $LOAD_TRUE: {
        this.pushStack(new Value(VAL_BOOLEAN, 1));
        break;
      }
      case $LOAD_FALSE: {
        this.pushStack(new Value(VAL_BOOLEAN, 0));
        break;
      }
      case $LOAD_CONST: {
        this.pushStack(this.readConst());
        break;
      }
      case $POSITIVE:
        break;
      case $NEGATE: {
        this.fastNegate();
        if (this.atError) return this.iERR();
        break;
      }
      case $NOT: {
        const valObj = this.popStack();
        let newValObj = new Value(VAL_BOOLEAN, this.isFalsy(valObj));
        this.pushStack(newValObj);
        break;
      }
      case $BW_INVERT: {
        this.fastInvert();
        if (this.atError) return this.iERR();
        break;
      }
      case $ADD: {
        this.add();
        if (this.atError) return this.iERR();
        break;
      }
      case $BW_LSHIFT:
      case $BW_RSHIFT:
      case $BW_AND:
      case $BW_OR:
      case $BW_XOR: {
        this.bwBinaryOp(bytecode);
        if (this.atError) return this.iERR();
        break;
      }
      case $MOD:
      case $DIVIDE:
      case $POW:
      case $GREATER:
      case $LESS:
      case $GREATER_OR_EQUAL:
      case $LESS_OR_EQUAL:
      case $SUBTRACT:
      case $MULTIPLY: {
        this.binaryOp(bytecode);
        if (this.atError) return this.iERR();
        break;
      }
      case $INSTOF: {
        this.instanceOf();
        break;
      }
      case $EQUAL: {
        const rightValObj = this.popStack();
        const leftValObj = this.popStack();
        this.pushStack(
          new Value(VAL_BOOLEAN, leftValObj.equals(rightValObj) | 0)
        );
        break;
      }
      case $NOT_EQUAL: {
        const rightValObj = this.popStack();
        const leftValObj = this.popStack();
        this.pushStack(
          new Value(VAL_BOOLEAN, !leftValObj.equals(rightValObj) | 0)
        );
        break;
      }
      case $SHOW: {
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
      case $IMPORT_MODULE: {
        if (!this.importModule(this.readConst(), this.readByte()))
          return this.iERR();
        break;
      }
      case $BUILD_LIST: {
        const size = this.readShort();
        const arr = [];
        for (let i = 0; i < size; ++i) {
          arr.unshift(this.peekStack(i));
        }
        this.popStackN(size);
        this.pushStack(createListVal(arr, this));
        break;
      }
      case $BUILD_LIST_UNPACK: {
        // all potential elements of the list are themselves lists
        const size = this.readShort();
        let arr = this.peekStack(size - 1).asList().elements;
        for (let i = size - 2; i >= 0; --i) {
          arr = arr.concat(this.peekStack(i).asList().elements);
        }
        this.popStackN(size);
        this.pushStack(createListVal(arr, this));
        break;
      }
      case $BUILD_RANGE: {
        const step = this.popStack();
        const end = this.popStack();
        const start = this.popStack();
        if (!start.isInt() || !step.isInt() || !end.isInt()) {
          this.runtimeError("Range expression sequences only with integers");
          return this.iERR();
        } else {
          const valObj = createListVal(
            this.buildListFromRange(start.value, end.value, step.value),
            this
          );
          this.pushStack(valObj);
        }
        break;
      }
      case $BUILD_DICT: {
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
      case $SUBSCRIPT: {
        const subscript = this.popStack();
        const object = this.popStack();
        this.performSubscript(object, subscript);
        if (this.atError) return this.iERR();
        break;
      }
      case $SET_SUBSCRIPT: {
        const subscript = this.popStack();
        const object = this.popStack();
        this.setSubscript(object, subscript);
        if (this.atError) return this.iERR();
        break;
      }
      case $DELETE_SUBSCRIPT: {
        const subscript = this.popStack();
        const object = this.popStack();
        this.deleteSubscript(object, subscript);
        if (this.atError) return this.iERR();
        break;
      }
      case $POP: {
        this.popCallback(this.popStack()); // todo
        break;
      }
      case $DEFINE_GLOBAL: {
        const val = this.popStack();
        const name = this.readString();
        this.currentModule.globals.set(name, val);
        break;
      }
      case $GET_GLOBAL: {
        const name = this.readString();
        const val = this.currentModule.globals.get(name);
        if (val === undefined) {
          this.runtimeError(`'${name.raw}' is not defined`);
          return this.iERR();
        }
        this.pushStack(val);
        break;
      }
      case $SET_GLOBAL: {
        const name = this.readString();
        if (!this.currentModule.globals.has(name)) {
          this.runtimeError(
            `Cannot assign value to ` + `undefined variable '${name.raw}'`
          );
          return this.iERR();
        }
        this.currentModule.globals.set(name, this.peekStack());
        break;
      }
      case $INC: {
        const v = this.popStack();
        this.pushStack(new Value(v.type, v.value + 1));
        break;
      }
      case $DEC: {
        const v = this.popStack();
        this.pushStack(new Value(v.type, v.value - 1));
        break;
      }
      case $DEFINE_LOCAL: {
        // NOP
        this.readConst();
        break;
      }
      case $SET_LOCAL: {
        const index = this.readShort();
        // stackStart is the frame's stack starting point
        this.stack[this.fp.stackStart + index] = this.peekStack();
        break;
      }
      case $GET_LOCAL: {
        const index = this.readShort();
        this.pushStack(this.stack[this.fp.stackStart + index]);
        break;
      }
      case $FORMAT: {
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
      case $JUMP: {
        const offset = this.readShort();
        this.fp.ip += offset;
        break;
      }
      case $JUMP_IF_FALSE: {
        const offset = this.readShort();
        if (this.isFalsy(this.peekStack())) {
          this.fp.ip += offset;
        }
        break;
      }
      case $JUMP_IF_FALSE_OR_POP: {
        const offset = this.readShort();
        if (this.isFalsy(this.peekStack())) {
          this.fp.ip += offset;
        } else {
          this.popStack();
        }
        break;
      }
      case $LOOP: {
        const offset = this.readShort();
        this.fp.ip -= offset;
        break;
      }
      case $POP_N: {
        this.popStackN(this.readShort());
        break;
      }
      case $CALL: {
        if (!this.callValue(this.readByte())) {
          return this.iERR();
        }
        break;
      }
      case $CALL_UNPACK: {
        let arity = this.readByte();
        if ((arity = this.unpackArgs(arity)) === null) {
          return this.iERR();
        }
        if (!this.callValue(arity)) {
          return this.iERR();
        }
        break;
      }
      case $CLOSURE: {
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
      case $GET_UPVALUE: {
        const idx = this.readByte();
        this.pushStack(this.fp.func.upvalues[idx]);
        break;
      }
      case $SET_UPVALUE: {
        const idx = this.readByte();
        this.fp.func.upvalues[idx] = this.peekStack();
        break;
      }
      case $DEF: {
        const defVal = createDefVal(this.readString(), this);
        this.pushStack(defVal);
        break;
      }
      case $METHOD: {
        const method = this.popStack();
        this.peekStack().asDef().setMethod(method.asFunction().fname, method);
        break;
      }
      case $GET_PROPERTY: {
        // [ ref ] or [ Def ] or [ obj ]
        const prop = this.readConst();
        const val = this.peekStack();
        if (!this.getValueProperty(prop.asString(), val, prop)) {
          return this.iERR();
        }
        break;
      }
      case $SET_PROPERTY: {
        const val = this.popStack();
        if (val.isInstance()) {
          const inst = val.asInstance();
          const prop = this.readString();
          inst.setProperty(prop, this.peekStack());
        } else if (val.isDict()) {
          const dict = val.asDict();
          const prop = this.readConst();
          dict.setVal(prop, this.peekStack());
        } else {
          this.propertyAssignError(val, this.readString());
          return this.iERR();
        }
        break;
      }
      case $GET_DEREF_PROPERTY: {
        // [ ref ][ Def ]
        const prop = this.readString();
        if (!this.bindMethod(this.popStack().asDef(), prop)) {
          return this.iERR();
        }
        break;
      }
      case $DELETE_PROPERTY: {
        // [ ref ] or [ Def ] or [ obj ]
        const prop = this.readConst();
        const val = this.peekStack();
        this.deleteProperty(val, prop);
        if (this.atError) return this.iERR();
        break;
      }
      case $INVOKE: {
        // [ ref ][ arg1 ][ arg2 ] or
        // [ Def ][ arg1 ][ arg2 ]
        const prop = this.readConst();
        const arity = this.readByte();
        if (!this.invokeValue(prop.asString(), arity, prop)) {
          return this.iERR();
        }
        break;
      }
      case $INVOKE_DEREF: {
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
      case $INVOKE_DEREF_UNPACK: {
        /*
         * the stack would be like so:
         * [ ref ][ arg1 ][ arg2 ]...[ argn ][ Def ]
         */
        const prop = this.readString();
        let argc = this.readByte();
        const baseDefVal = this.popStack();
        if ((argc = this.unpackArgs(argc)) === null) {
          return this.iERR();
        }
        if (!this.invokeFromDef(baseDefVal.asDef(), prop, argc)) {
          return this.iERR();
        }
        break;
      }
      case $DERIVE: {
        // [ base Def ][ child Def ]
        const child = this.popStack().asDef();
        const baseVal = this.peekStack();
        if (!baseVal.isDef()) {
          this.runtimeError(
            `'${baseVal.typeToString()}' can't be interpreted as a definition`
          );
          return this.iERR();
        } else if (this.isCoreDef(baseVal)) {
          // todo: okay?
          this.runtimeError(
            `Can't derive from core type '${baseVal.asDef().dname.raw}'`
          );
          return this.iERR();
        } else {
          baseVal.asDef().dmethods.forEach((v, k) => child.setMethod(k, v));
          // create a link to the base def in the child def.
          child.baseDef = baseVal.asDef();
        }
        break;
      }
      case $SETUP_EXCEPT: {
        this.fp.pushHandler(this.readShort(), this.sp);
        break;
      }
      case $POP_EXCEPT: {
        this.fp.popHandler();
        break;
      }
      case $PANIC: {
        this.runtimeError(null, this.popStack());
        return this.iERR();
      }
      case $RETURN: {
        const frame = this.popFrame();
        const val = this.popStack();
        if (!this.fp) {
          // !this.fp indicates that we've just popped the top-level
          // frame, which is the 'environment' frame.
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
