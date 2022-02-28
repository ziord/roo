"use strict";

const mod = require("../../constant/value");

/* * *Function* * */

/*
 * Handlers
 */
function function__init(rvm, arity) {
    // takes no argument.
    return mod.createNullVal();
}

function function__code(rvm, arity) {
    // takes no argument.
    const fnObj = rvm.peekStack().asFunction();
    const code = fnObj.code.getCode();
    const arr = [];
    code.forEach((byte) => arr.push(mod.createIntVal(byte)));
    return mod.createListVal(arr);
}

function function__name(rvm, arity) {}
