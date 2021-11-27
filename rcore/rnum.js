"use strict";

const mod = require("../constant/value");
const utils = require("../utils");
const register = require("../rcore/register");

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

/* * *Int* * */

/*
 * Handlers
 */
function int__init(rvm, arity) {
    // takes 1 argument
    const val = rvm.peekStack();
    switch (val.type) {
        case mod.VAL_INT:
            return val;
        case mod.VAL_FLOAT:
            return mod.createIntVal(Math.trunc(val.asFloat()));
        case mod.VAL_BOOLEAN:
            return mod.createIntVal(val.asBoolean());
        case mod.VAL_NULL:
            return mod.createIntVal(0);
        case mod.VAL_STRING: {
            const res = Number.parseInt(val.asString().raw);
            if (Number.isNaN(res)) {
                rvm.runtimeError("invalid literal for Int");
                return rvm.dummyVal();
            }
            return mod.createIntVal(res);
        }
        case mod.VAL_LIST:
        case mod.VAL_DICT:
        case mod.VAL_FUNCTION:
        case mod.VAL_DEFINITION:
        case mod.VAL_INSTANCE:
        case mod.VAL_BOUND_METHOD:
        case mod.VAL_BFUNCTION:
            rvm.runtimeError("invalid argument for Int");
            return rvm.dummyVal();
        case mod.VAL_OBJECT:
        default:
            utils.unreachable("core::int__init()");
    }
}

/* * *Float* * */

/*
 * Handlers
 */
function float__init(rvm, arity) {
    // takes 1 argument
    const val = rvm.peekStack();
    switch (val.type) {
        case mod.VAL_INT:
            return mod.createFloatVal(val.asInt());
        case mod.VAL_FLOAT:
            return val;
        case mod.VAL_BOOLEAN:
            return mod.createFloatVal(val.asBoolean());
        case mod.VAL_NULL:
            return mod.createFloatVal(0);
        case mod.VAL_STRING: {
            const res = Number.parseFloat(val.asString().raw);
            if (Number.isNaN(res)) {
                rvm.runtimeError("invalid literal for Float");
                return rvm.dummyVal();
            }
            return mod.createFloatVal(res);
        }
        case mod.VAL_LIST:
        case mod.VAL_DICT:
        case mod.VAL_FUNCTION:
        case mod.VAL_DEFINITION:
        case mod.VAL_INSTANCE:
        case mod.VAL_BOUND_METHOD:
        case mod.VAL_BFUNCTION:
            rvm.runtimeError("invalid argument for Float");
            return rvm.dummyVal();
        case mod.VAL_OBJECT:
        default:
            utils.unreachable("core::float__init()");
    }
}

exports.init = function (rvm) {
    // Bool
    register.registerDef(rvm, "Bool", [
        {
            methodName: "__init__",
            methodExec: bool__init,
            methodArity: 1,
            defaultParamsCount: 1,
            defaults: [{ pos: 1, val: mod.createFalseVal() }],
        },
    ]);

    // Int
    register.registerDef(rvm, "Int", [
        {
            methodName: "__init__",
            methodExec: int__init,
            methodArity: 1,
            defaultParamsCount: 1,
            defaults: [{ pos: 1, val: mod.createIntVal(0) }],
        },
    ]);

    // Float
    register.registerDef(rvm, "Float", [
        {
            methodName: "__init__",
            methodExec: float__init,
            methodArity: 1,
            defaultParamsCount: 1,
            defaults: [{ pos: 1, val: mod.createFloatVal(0) }],
        },
    ]);
};
