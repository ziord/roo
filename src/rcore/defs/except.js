"use strict";

const mod = require("../../constant/value");
const register = require("../register");

/* * *Exception* * */

/*Utils*/

/**
 * @param {VM} rvm: the vm
 * @param {string} msgStr: the message as a JS string if available
 * @param {Value} msgVal: the message as a Value object if available
 * @returns {Value} Exception instance
 */
exports.getErrorValue = function (rvm, msgStr, msgVal) {
    if (!msgVal) {
        msgVal = mod.createVMStringVal(msgStr, rvm);
    }
    return msgVal;
};

/**
 * @param {VM} rvm: the vm
 * @param {string} msgStr: the message as a JS string if available
 * @param {Value} msgVal: the message as a Value object if available
 * @returns {Value} Exception instance
 */
exports.createExceptionInstance = function (rvm, msgStr, msgVal) {
    msgVal = exports.getErrorValue(rvm, msgStr, msgVal);
    const except = mod.getVMStringObj("Exception", rvm);
    const str = mod.getVMStringObj("$__msg", rvm);
    const inst = mod.createInstanceVal(rvm.builtins.get(except).asDef());
    inst.asInstance().setProperty(str, msgVal);
    return inst;
};


/*
 * Handlers
 */
function except__init(rvm, arity) {
    // takes 1 argument.
    const instance = rvm.peekStack(arity).asInstance();
    const val = rvm.peekStack();
    const msgStr = mod.getVMStringObj("$__msg", rvm);
    instance.setProperty(msgStr, val);
    return rvm.peekStack(arity); // return the instance
}

function except__str(rvm, arity) {
    // takes no argument.
    const instance = rvm.peekStack(arity).asInstance();
    const msgStr = mod.getVMStringObj("$__msg", rvm);
    const val = instance.getProperty(msgStr);
    if (val) {
        return mod.createVMStringVal(
            instance.def.dname.raw + ": " + val.stringify(),
            rvm
        );
    }
    return mod.createVMStringVal(instance.def.dname.raw, rvm);
}

function except__message(rvm, arity) {
    // takes no argument.
    const instance = rvm.peekStack(arity).asInstance();
    const msgStr = mod.getVMStringObj("$__msg", rvm);
    return instance.getProperty(msgStr);
}

exports.init = function (rvm) {
    register.registerBuiltinDef(rvm, "Exception", [
        {
            methodName: "__init__",
            methodExec: except__init,
            methodArity: 1,
        },
        {
            methodName: "__str__",
            methodExec: except__str,
            methodArity: 0,
        },
        {
            methodName: "message",
            methodExec: except__message,
            methodArity: 0,
        },
    ]);
};