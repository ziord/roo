"use strict";

const mod = require("../constant/value");
const register = require("../rcore/register");

/* * *String* * */

/*
 * Handlers
 */
function str__init(rvm, arity) {
    // str init takes 1 argument
    const val = rvm.peekStack();
    // stringify the value
    const str = val.stringify(false, rvm);
    // create and return a string object
    return mod.createVMStringVal(str, rvm);
}

function str__length(rvm, arity) {
    // str.length() - length takes 0 argument
    const strObj = rvm.peekStack().asString();
    return mod.createIntVal(strObj.raw.length);
}

function str__iter(rvm, arity) {
    // str.__iter__()  -  iter takes 0 argument
    // push the StringIterator def on the stack
    const itrVal = rvm.builtins.get(mod.getVMStringObj("StringIterator", rvm));
    rvm.pushStack(itrVal);
    // swap the StringIterator def's position with the str val, and call the
    // the definition
    rvm.swapLastTwo();
    // invoke and run the StringIterator's init() method - init() is run
    // immediately because the StringIterator's init method is a builtin method
    rvm.callDef(itrVal, 1);
    if (rvm.atFault()) return rvm.dummyVal();
    // the result would be the value on the stack
    return rvm.peekStack();
}

function str__capitalize(rvm, arity) {
    // str.capitalize() - takes 0 argument
    const strObj = rvm.peekStack().asString();
    if (!strObj.raw.length) return rvm.peekStack();
    const newStr = strObj.raw.charAt(0).toUpperCase() + strObj.raw.slice(1);
    return mod.createVMStringVal(newStr, rvm);
}

function str__contains(rvm, arity) {
    // takes 1 argument
    const strObj = rvm.peekStack(arity).asString();
    const arg = rvm.peekStack();
    if (!arg.isString()) {
        rvm.runtimeError("contains arg must be a string");
        return rvm.dummyVal();
    }
    return strObj.raw.includes(arg.asString().raw)
        ? mod.createTrueVal()
        : mod.createFalseVal();
}

function str__startswith(rvm, arity) {
    // takes 1 argument
    const strObj = rvm.peekStack(arity).asString();
    const arg = rvm.peekStack();
    if (!arg.isString()) {
        rvm.runtimeError("startsWith arg must be a string");
        return rvm.dummyVal();
    }
    return strObj.raw.startsWith(arg.asString().raw)
        ? mod.createTrueVal()
        : mod.createFalseVal();
}

function str__endswith(rvm, arity) {
    // takes 1 argument
    const strObj = rvm.peekStack(arity).asString();
    const arg = rvm.peekStack();
    if (!arg.isString()) {
        rvm.runtimeError("endsWith arg must be a string");
        return rvm.dummyVal();
    }
    return strObj.raw.endsWith(arg.asString().raw)
        ? mod.createTrueVal()
        : mod.createFalseVal();
}

function str__trim(rvm, arity) {
    // takes 0 argument
    const strObj = rvm.peekStack(arity).asString();
    return mod.createVMStringVal(strObj.raw.trim(), rvm);
}

function str__ltrim(rvm, arity) {
    // takes 0 argument
    const strObj = rvm.peekStack(arity).asString();
    return mod.createVMStringVal(strObj.raw.trimLeft(), rvm);
}

function str__rtrim(rvm, arity) {
    // takes 0 argument
    const strObj = rvm.peekStack(arity).asString();
    return mod.createVMStringVal(strObj.raw.trimRight(), rvm);
}

function str__upper(rvm, arity) {
    // takes 0 argument
    const strObj = rvm.peekStack(arity).asString();
    return mod.createVMStringVal(strObj.raw.toUpperCase(), rvm);
}

function str__lower(rvm, arity) {
    // takes 0 argument
    const strObj = rvm.peekStack(arity).asString();
    return mod.createVMStringVal(strObj.raw.toLowerCase(), rvm);
}

function str__find(rvm, arity) {
    // takes 1 argument
    const strObj = rvm.peekStack(arity).asString();
    const arg = rvm.peekStack();
    if (!arg.isString()) {
        rvm.runtimeError("find arg must be a string");
        return rvm.dummyVal();
    }
    return mod.createIntVal(strObj.raw.indexOf(arg.asString().raw));
}

function str__split(rvm, arity) {
    // takes 2 arguments
    const strObj = rvm.peekStack(arity).asString();
    const arg = rvm.peekStack(1);
    const arg2 = rvm.peekStack();
    let splitArg, limitArg;
    if (arg.isString()) {
        splitArg = arg.asString().raw;
    } else {
        rvm.runtimeError("split first arg must be a string or null");
        return rvm.dummyVal();
    }
    if (arg2.isInt()) {
        limitArg = arg2.asInt();
    } else {
        rvm.runtimeError("split second arg must be an int");
        return rvm.dummyVal();
    }
    const arr = strObj.raw.split(splitArg, limitArg);
    for (let i = 0; i < arr.length; ++i) {
        arr[i] = mod.createVMStringVal(arr[i], rvm);
    }
    return mod.createListVal(arr, rvm);
}

function str__isAlNum(rvm, arity) {
    // takes 0 argument
    const str = rvm.peekStack().asString().raw;
    let code;
    for (let i = 0; i < str.length; ++i) {
        code = str.charCodeAt(i);
        if (
            !(code > 47 && code < 58) && // 0 - 9
            !(code > 64 && code < 91) && // A - Z
            !(code > 96 && code < 123) // a - z
        ) {
            return mod.createFalseVal();
        }
    }
    return mod.createTrueVal();
}

function str__isDigit(rvm, arity) {
    // takes 0 argument
    const str = rvm.peekStack().asString().raw;
    let code;
    for (let i = 0; i < str.length; ++i) {
        code = str.charCodeAt(i);
        if (!(code > 47 && code < 58)) {
            return mod.createFalseVal();
        }
    }
    return mod.createTrueVal();
}

function str__isAlpha(rvm, arity) {
    // takes 0 argument
    const str = rvm.peekStack().asString().raw;
    let code;
    for (let i = 0; i < str.length; ++i) {
        code = str.charCodeAt(i);
        if (!(code > 64 && code < 91) && !(code > 96 && code < 123)) {
            return mod.createFalseVal();
        }
    }
    return mod.createTrueVal();
}

function isLower(str) {
    return str === str.toLowerCase() && str !== str.toUpperCase();
}

function isUpper(str) {
    return str === str.toUpperCase() && str !== str.toLowerCase();
}

function str__isUpper(rvm, arity) {
    const str = rvm.peekStack().asString().raw;
    return isUpper(str) ? mod.createTrueVal() : mod.createFalseVal();
}

function str__isLower(rvm, arity) {
    const str = rvm.peekStack().asString().raw;
    return isLower(str) ? mod.createTrueVal() : mod.createFalseVal();
}

function str__slice(rvm, arity) {
    // takes 2 args
    const str = rvm.peekStack(arity).asString().raw;
    const arg1 = rvm.peekStack(1);
    const arg2 = rvm.peekStack();
    let start, end;
    if (arg1.isInt()) {
        start = arg1.asInt();
    } else if (arg1.isNull()) {
        start = 0;
    } else {
        rvm.runtimeError("slice arg must be an integer or null");
        return rvm.dummyVal();
    }
    if (arg2.isInt()) {
        end = arg2.asInt();
    } else if (arg2.isNull()) {
        end = str.length;
    } else {
        rvm.runtimeError("slice arg must be an integer or null");
        return rvm.dummyVal();
    }
    return mod.createVMStringVal(str.slice(start, end), rvm);
}

/* * *StringIterator* * */

/*
 * Handlers
 */
function str_iterator__init(rvm, arity) {
    // the stack: [ ref StringIterator ][ string val ]
    const strItrInstVal = rvm.peekStack(arity);
    const strItrInst = strItrInstVal.asInstance();
    const refStr = mod.getVMStringObj("$__str_ref", rvm);
    const idxStr = mod.getVMStringObj("$__current_index", rvm);
    // set the string as the StringIterator instance's property
    strItrInst.setProperty(refStr, rvm.peekStack());
    // set the current index for use in the StringIterator's next() method
    strItrInst.setProperty(idxStr, mod.createIntVal(0));
    return strItrInstVal;
}

function str_iterator__next(rvm, arity) {
    const strItrInst = rvm.peekStack().asInstance();
    const refStr = mod.getVMStringObj("$__str_ref", rvm);
    const idxStr = mod.getVMStringObj("$__current_index", rvm);
    const doneStr = mod.createVMStringVal("done", rvm);
    const valStr = mod.createVMStringVal("value", rvm);
    const strObj = strItrInst.getProperty(refStr).asString();
    let index = strItrInst.getProperty(idxStr).asInt();
    let map = new Map();
    if (index < strObj.raw.length) {
        map.set(valStr, mod.createVMStringVal(strObj.raw[index++], rvm));
        map.set(doneStr, mod.createFalseVal());
        strItrInst.setProperty(idxStr, mod.createIntVal(index));
    } else {
        map.set(valStr, mod.createVMStringVal("", rvm));
        map.set(doneStr, mod.createTrueVal());
    }
    return mod.createDictVal(map, rvm);
}

exports.init = function (rvm) {
    // String
    register.registerDef(rvm, "String", [
        {
            methodName: "__init__",
            methodExec: str__init,
            methodArity: 1,
            defaultParamsCount: 1,
            defaults: [
                { pos: 1, val: mod.createStringVal("", rvm.internedStrings) },
            ],
        },
        {
            methodName: "length",
            methodExec: str__length,
            methodArity: 0,
        },
        {
            methodName: "__iter__",
            methodExec: str__iter,
            methodArity: 0,
        },
        {
            methodName: "capitalize",
            methodExec: str__capitalize,
            methodArity: 0,
        },
        {
            methodName: "contains",
            methodExec: str__contains,
            methodArity: 1,
        },
        {
            methodName: "startsWith",
            methodExec: str__startswith,
            methodArity: 1,
        },
        {
            methodName: "endsWith",
            methodExec: str__endswith,
            methodArity: 1,
        },
        {
            methodName: "trim",
            methodExec: str__trim,
            methodArity: 0,
        },
        {
            methodName: "ltrim",
            methodExec: str__ltrim,
            methodArity: 0,
        },
        {
            methodName: "rtrim",
            methodExec: str__rtrim,
            methodArity: 0,
        },
        {
            methodName: "lower",
            methodExec: str__lower,
            methodArity: 0,
        },
        {
            methodName: "upper",
            methodExec: str__upper,
            methodArity: 0,
        },
        {
            methodName: "find",
            methodExec: str__find,
            methodArity: 1,
        },
        {
            methodName: "split",
            methodExec: str__split,
            methodArity: 2,
            defaultParamsCount: 2,
            defaults: [
                { pos: 1, val: mod.createStringVal(" ", rvm.internedStrings) },
                { pos: 2, val: mod.createIntVal(-1) },
            ],
        },
        {
            methodName: "isAlNum",
            methodExec: str__isAlNum,
            methodArity: 0,
        },
        {
            methodName: "isDigit",
            methodExec: str__isDigit,
            methodArity: 0,
        },
        {
            methodName: "isAlpha",
            methodExec: str__isAlpha,
            methodArity: 0,
        },
        {
            methodName: "isLower",
            methodExec: str__isLower,
            methodArity: 0,
        },
        {
            methodName: "isUpper",
            methodExec: str__isUpper,
            methodArity: 0,
        },
        {
            methodName: "slice",
            methodExec: str__slice,
            methodArity: 2,
            defaultParamsCount: 2,
            defaults: [
                { pos: 1, val: mod.createNullVal() },
                { pos: 2, val: mod.createNullVal() },
            ],
        },
    ]);

    // StringIterator
    register.registerDef(
        rvm,
        "StringIterator",
        [
            {
                methodName: "__init__",
                methodExec: str_iterator__init,
                methodArity: 1,
            },
            {
                methodName: "__next__",
                methodExec: str_iterator__next,
                methodArity: 0,
            },
        ],
        null,
        true
    );
};