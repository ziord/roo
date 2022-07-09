"use strict";

const mod = require("../../constant/value");
const utils = require("../../utils");
const register = require("../register");

/* * *Bool* * */

/*
 * Handlers
 */
function bool__init(rvm, arity) {
  // takes 1 argument
  const val = rvm.peekStack();
  switch (val.type) {
    case mod.VAL_INT:
    case mod.VAL_FLOAT:
      return val.as() ? mod.createTrueVal() : mod.createFalseVal();
    case mod.VAL_BOOLEAN:
      return val;
    case mod.VAL_NULL:
      return mod.createFalseVal();
    case mod.VAL_STRING: {
      return val.asString().raw.length
        ? mod.createTrueVal()
        : mod.createFalseVal();
    }
    case mod.VAL_LIST: {
      return val.asList().elements.length
        ? mod.createTrueVal()
        : mod.createFalseVal();
    }
    case mod.VAL_DICT: {
      return val.asDict().htable.size
        ? mod.createTrueVal()
        : mod.createFalseVal();
    }
    case mod.VAL_FUNCTION:
    case mod.VAL_DEFINITION:
    case mod.VAL_INSTANCE:
    case mod.VAL_BOUND_METHOD:
    case mod.VAL_BFUNCTION:
      return mod.createTrueVal();
    case mod.VAL_OBJECT:
    default:
      utils.unreachable("core::bool__init()");
  }
}

exports.init = function (rvm) {
  // Bool
  register.registerBuiltinDef(rvm, "Bool", [
    {
      methodName: "__init__",
      methodExec: bool__init,
      methodArity: 1,
      defaultParamsCount: 1,
      defaults: [{ pos: 1, val: mod.createFalseVal() }],
    },
  ]);
};
