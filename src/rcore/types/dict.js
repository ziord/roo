"use strict";

const mod = require("../../constant/value");
const register = require("../register");

/* * *Dict* * */

/*
 * Handlers
 */
function dict__init(rvm, arity) {
    // takes no argument.
    return mod.createDictVal(new Map(), rvm);
}

function dict__keys(rvm, arity) {
    // takes no argument.
    const dictObj = rvm.peekStack().asDict();
    return mod.createListVal(Array.from(dictObj.htable.keys()), rvm);
}

function dict__values(rvm, arity) {
    // takes no argument.
    const dictObj = rvm.peekStack().asDict();
    return mod.createListVal(Array.from(dictObj.htable.values()), rvm);
}

function dict__entries(rvm, arity) {
    // takes no argument.
    const dictObj = rvm.peekStack().asDict();
    const arr = [];
    for (let [k, v] of dictObj.htable) {
        arr.push(mod.createListVal([k, v], rvm));
    }
    return mod.createListVal(arr, rvm);
}

function dict__length(rvm, arity) {
    // takes no argument.
    return mod.createIntVal(rvm.peekStack().asDict().htable.size);
}

function dict__clear(rvm, arity) {
    // takes no argument.
    rvm.peekStack().asDict().htable.clear();
    return mod.createNullVal();
}

function dict__copy(rvm, arity) {
    // takes no argument.
    return mod.createDictVal(new Map(rvm.peekStack().asDict().htable), rvm);
}

function dict__get(rvm, arity) {
    // takes 2 arguments.
    const dictObj = rvm.peekStack(arity).asDict();
    let val;
    if ((val = dictObj.getVal(rvm.peekStack(1)))) {
        return val;
    }
    return rvm.peekStack();
}

function dict__pop(rvm, arity) {
    // takes 1 argument.
    const dictObj = rvm.peekStack(arity).asDict();
    const key = rvm.peekStack();
    let kv;
    if ((kv = dictObj.getKeyValPair(key))) {
        dictObj.htable.delete(kv[0]);
        return kv[1];
    }
    rvm.runtimeError(`No such key ${key.stringify(true)}`);
    return mod.createNullVal();
}

function dict__set(rvm, arity) {
    // takes 2 arguments.
    const dictObj = rvm.peekStack(arity).asDict();
    dictObj.htable.set(rvm.peekStack(1), rvm.peekStack());
    return rvm.peekStack(arity);
}

function dict__iter(rvm, arity) {
    // takes no argument.
    // push the DictKeyIterator def on the stack
    const itrVal = rvm.builtins.get(mod.getVMStringObj("DictKeyIterator", rvm));
    rvm.pushStack(itrVal);
    // swap the DictKeyIterator def's position with the dict val, and call the
    // the definition
    rvm.swapLastTwo();
    // invoke and run the DictKeyIterator's init() method - init() is run
    // immediately because the DictKeyIterator's init method is a builtin method
    rvm.callDef(itrVal, 1);
    if (rvm.hasError()) return rvm.dummyVal();
    // the result would be the value on the stack
    return rvm.peekStack();
}

/* * *DictKeyIterator* * */

/*
 * Handlers
 */
function dict_key_iterator__init(rvm, arity) {
    // the stack: [ ref DictKeyIterator ][ dict val ]
    const dictItrInstVal = rvm.peekStack(arity);
    const dictItrInst = dictItrInstVal.asInstance();
    const keysStr = mod.getVMStringObj("$__dict_keys", rvm);
    const idxStr = mod.getVMStringObj("$__current_index", rvm);
    // set the dict's keys as the DictKeyIterator instance's property
    const keys = Array.from(rvm.peekStack().asDict().htable.keys());
    dictItrInst.setProperty(keysStr, mod.createListVal(keys, rvm));
    // set the current index for use in the DictKeyIterator's next() method
    dictItrInst.setProperty(idxStr, mod.createIntVal(0));
    return dictItrInstVal;
}

function dict_key_iterator__next(rvm, arity) {
    const dictItrInst = rvm.peekStack().asInstance();
    const doneStr = mod.createVMStringVal("done", rvm);
    const valStr = mod.createVMStringVal("value", rvm);
    const idxStr = mod.getVMStringObj("$__current_index", rvm);
    const keysStr = mod.getVMStringObj("$__dict_keys", rvm);
    const listObj = dictItrInst.getProperty(keysStr).asList();
    let index = dictItrInst.getProperty(idxStr).asInt();
    let map = new Map();
    if (index < listObj.elements.length) {
        map.set(valStr, listObj.elements[index++]);
        map.set(doneStr, mod.createFalseVal());
        dictItrInst.setProperty(idxStr, mod.createIntVal(index));
    } else {
        map.set(valStr, mod.createNullVal());
        map.set(doneStr, mod.createTrueVal());
    }
    return mod.createDictVal(map, rvm);
}

exports.init = function (rvm) {
    register.registerBuiltinDef(rvm, "Dict", [
        {
            methodName: "__init__",
            methodExec: dict__init,
            methodArity: 0,
        },
        {
            methodName: "keys",
            methodExec: dict__keys,
            methodArity: 0,
        },
        {
            methodName: "values",
            methodExec: dict__values,
            methodArity: 0,
        },
        {
            methodName: "entries",
            methodExec: dict__entries,
            methodArity: 0,
        },
        {
            methodName: "length",
            methodExec: dict__length,
            methodArity: 0,
        },
        {
            methodName: "clear",
            methodExec: dict__clear,
            methodArity: 0,
        },
        {
            methodName: "copy",
            methodExec: dict__copy,
            methodArity: 0,
        },
        {
            methodName: "get",
            methodExec: dict__get,
            methodArity: 2,
            defaultParamsCount: 1,
            defaults: [{ pos: 2, val: mod.createNullVal() }],
        },
        {
            methodName: "pop",
            methodExec: dict__pop,
            methodArity: 1,
        },
        {
            methodName: "set",
            methodExec: dict__set,
            methodArity: 2,
        },
        {
            methodName: "__iter__",
            methodExec: dict__iter,
            methodArity: 0,
        },
    ]);

    // DictKeyIterator
    register.registerBuiltinDef(
        rvm,
        "DictKeyIterator",
        [
            {
                methodName: "__init__",
                methodExec: dict_key_iterator__init,
                methodArity: 1,
            },
            {
                methodName: "__next__",
                methodExec: dict_key_iterator__next,
                methodArity: 0,
            },
        ],
        null,
        true
    );
};
