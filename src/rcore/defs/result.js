"use strict";

const mod = require("../../constant/value");
const register = require("../register");

/* * *Result* * */

function getStatus(rvm, instance) {
  const statusStr = mod.getVMStringObj("$__status", rvm);
  return instance.getProperty(statusStr);
}

function getValue(rvm, instance) {
  const valStr = mod.getVMStringObj("$__value", rvm);
  return instance.getProperty(valStr);
}

/*
 * Handlers
 */

function result__init(rvm, arity) {
  // takes 2 argument: Result(type, val)
  // type -> 1/true ('Ok') | 0/false ('Err')
  const type = rvm.peekStack(1);
  const val = rvm.peekStack();
  const instance = rvm.peekStack(arity).asInstance();
  const statusStr = mod.getVMStringObj("$__status", rvm);
  const valStr = mod.getVMStringObj("$__value", rvm);
  instance.setProperty(statusStr, type);
  instance.setProperty(valStr, val);
  return rvm.peekStack(arity); // return the instance
}

function result__str(rvm, arity) {
  // takes no argument
  const instance = rvm.peekStack(arity).asInstance();
  const status = getStatus(rvm, instance).asInt();
  const str = status ? "Result(<Ok>)" : "Result(<Err>)";
  return mod.createVMStringVal(str, rvm);
}

function result__isOk(rvm, arity) {
  const instance = rvm.peekStack(arity).asInstance();
  const status = getStatus(rvm, instance);
  return status.asInt() ? mod.createTrueVal() : mod.createFalseVal();
}

function result__isErr(rvm, arity) {
  const instance = rvm.peekStack(arity).asInstance();
  const val = getStatus(rvm, instance);
  return !val.asInt() ? mod.createTrueVal() : mod.createFalseVal();
}

function result__unwrap(rvm, arity) {
  // takes an optional argument
  const instance = rvm.peekStack(arity).asInstance();
  const msgVal = rvm.peekStack();
  if (!msgVal.isString()) {
    rvm.runtimeError("arg must be a string");
    return rvm.dummyVal();
  }
  const status = getStatus(rvm, instance);
  // unwrap fails if the result is actually Err()
  if (!status.asInt()) {
    rvm.runtimeError(msgVal.asString().raw);
    return rvm.dummyVal();
  }
  return getValue(rvm, instance);
}

function result__unwrapError(rvm, arity) {
  // takes no argument
  const instance = rvm.peekStack(arity).asInstance();
  const status = getStatus(rvm, instance);
  // unwrapError fails if the result is actually Ok()
  if (status.asInt()) {
    rvm.runtimeError("Result is ok");
    return rvm.dummyVal();
  }
  return getValue(rvm, instance);
}

function result__match(rvm, arity) {
  // takes 2 arguments (errFn, okFn)
  const instance = rvm.peekStack(arity).asInstance();
  const errFn = rvm.peekStack(1);
  const okFn = rvm.peekStack();
  if (!errFn.isCallable() || !okFn.isCallable()) {
    rvm.runtimeError("argument must be a callable");
    return rvm.dummyVal();
  }
  const status = getStatus(rvm, instance);
  const fn = status.asInt() ? okFn : errFn;
  rvm.pushStack(fn);
  // function must take no arg
  // the result of the function call is topmost on the stack
  if (rvm.execNow(fn, 0)) return rvm.popStack();
  // return null if there's an error
  return rvm.dummyVal();
}

function result__matchResult(rvm, arity) {
  // takes 2 arguments (errFn, okFn) -> Result()
  const errFn = rvm.peekStack(1);
  const okFn = rvm.peekStack();
  const instance = rvm.peekStack(arity).asInstance();
  if (!errFn.isCallable() || !okFn.isCallable()) {
    rvm.runtimeError("argument must be a callable");
    return rvm.dummyVal();
  }
  const status = getStatus(rvm, instance);
  const fn = status.asInt() ? okFn : errFn;
  rvm.pushStack(fn);
  // function must take no arg
  if (!rvm.execNow(fn, 0)) {
    return rvm.dummyVal();
  }
  const resultStr = mod.getVMStringObj("Result", rvm);
  const statusStr = mod.getVMStringObj("$__status", rvm);
  const valStr = mod.getVMStringObj("$__value", rvm);
  // call Result() directly, instead of invoking its init:
  // create a new Result instance and wrap around the function call
  // return value
  const newInstance = mod.createInstanceVal(
    rvm.builtins.get(resultStr).asDef()
  );
  newInstance.asInstance().setProperty(statusStr, status);
  newInstance.asInstance().setProperty(valStr, rvm.popStack());
  return newInstance;
}

/* * *Ok* * */

function init_fn(rvm, arity, statusVal) {
  const resultStr = mod.getVMStringObj("Result", rvm);
  // push Result def on the stack
  const val = rvm.peekStack();
  const def = rvm.builtins.get(resultStr);
  rvm.pushStack(def);
  rvm.pushStack(statusVal);
  rvm.pushStack(val);
  rvm.callDef(def, 2); // init() is called automatically
  if (rvm.hasError()) return rvm.dummyVal();
  return rvm.popStack();
}
/*
 * Handlers
 */

function ok__init(rvm, arity) {
  return init_fn(rvm, arity, mod.createIntVal(1));
}

/* * *Err* * */

/*
 * Handlers
 */

function err__init(rvm, arity) {
  return init_fn(rvm, arity, mod.createIntVal(0));
}

exports.init = function (rvm) {
  // Result
  register.registerBuiltinDef(
    rvm,
    "Result",
    [
      {
        methodName: "__init__",
        methodExec: result__init,
        methodArity: 2,
      },
      {
        methodName: "__str__",
        methodExec: result__str,
        methodArity: 0,
      },
      {
        methodName: "isOk",
        methodExec: result__isOk,
        methodArity: 0,
      },
      {
        methodName: "isErr",
        methodExec: result__isErr,
        methodArity: 0,
      },
      {
        methodName: "unwrap",
        methodExec: result__unwrap,
        methodArity: 1,
        defaultParamsCount: 1,
        defaults: [
          {
            pos: 1,
            val: mod.createStringVal(
              "Failed. Result is error",
              rvm.internedStrings
            ),
          },
        ],
      },
      {
        methodName: "unwrapError",
        methodExec: result__unwrapError,
        methodArity: 0,
      },
      {
        methodName: "match",
        methodExec: result__match,
        methodArity: 2,
      },
      {
        methodName: "matchResult",
        methodExec: result__matchResult,
        methodArity: 2,
      },
    ],
    null,
    true
  );

  // Ok
  register.registerBuiltinDef(rvm, "Ok", [
    {
      methodName: "__init__",
      methodExec: ok__init,
      methodArity: 1,
    },
  ]);

  // Err
  register.registerBuiltinDef(rvm, "Err", [
    {
      methodName: "__init__",
      methodExec: err__init,
      methodArity: 1,
    },
  ]);
};
