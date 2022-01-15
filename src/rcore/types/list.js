"use strict";

const mod = require("../../constant/value");
const register = require("../register");

/* * *List* * */

function list_fnError(rvm, callback) {
    rvm.runtimeError(`'${callback.typeToString()}' type is not callable`);
}

/*
 * Handlers
 */
function list__init(rvm, arity) {
    /*
     * list__init() takes only one argument which is variadic.
     * any arguments passed must've been packed into a list,
     * we peek the vm's stack for the first argument (the list),
     * and use its value directly
     */
    const arr = rvm.peekStack().asList().elements;
    return mod.createListVal(arr, rvm);
}

function list__length(rvm, arity) {
    const listObj = rvm.peekStack().asList();
    return mod.createIntVal(listObj.elements.length);
}

function list__map(rvm, arity) {
    // list.map(callback)
    const callback = rvm.peekStack();
    if (!callback.isCallable()) {
        list_fnError(rvm, callback);
        return rvm.dummyVal();
    }
    const listObj = rvm.peekStack(arity).asList(); // or rvm.peekStack(1)
    const arr = [];
    for (let i = 0; i < listObj.elements.length; ++i) {
        // *1* place the function on the stack again
        rvm.pushStack(callback);
        // place each element in the list on the stack to serve as the
        // function's argument
        rvm.pushStack(listObj.elements[i]);
        // call the function:
        // 'map' expects a function accepting only 1 positional argument
        // bail if we run into an error:
        if (!rvm.execNow(callback, 1)) return rvm.dummyVal();
        // the result would have replaced the function initially pushed on the
        // stack at *1*, so we only need to pop once to obtain the result,
        // which balances the stack effect.
        arr.push(rvm.popStack());
    }
    return mod.createListVal(arr, rvm);
}

function list__filter(rvm, arity) {
    // list.filter(callback)
    const callback = rvm.peekStack();
    if (!callback.isCallable()) {
        list_fnError(rvm, callback);
        return rvm.dummyVal();
    }
    const listObj = rvm.peekStack(arity).asList();
    const arr = [];
    for (let elem of listObj.elements) {
        // *1* place the function on the stack again
        rvm.pushStack(callback);
        // place each element in the list on the stack to serve as the
        // function's argument
        rvm.pushStack(elem);
        // call the function:
        // 'filter' expects a function accepting only 1 positional argument
        // bail if we run into an error:
        if (!rvm.execNow(callback, 1)) return rvm.dummyVal();
        // the result would have replaced the function initially pushed on the
        // stack at *1*, so we only need to pop once to obtain the result,
        // which balances the stack effect.
        if (!rvm.isFalsy(rvm.popStack())) {
            arr.push(elem);
        }
    }
    return mod.createListVal(arr, rvm);
}

function list__reduce(rvm, arity) {
    // list.reduce(callback, start?)
    const callback = rvm.peekStack(1);
    if (!callback.isCallable()) {
        list_fnError(rvm, callback);
        return rvm.dummyVal();
    }
    const listObj = rvm.peekStack(arity).asList();
    // the starting val may either be the builtin-default,
    // or one provided by the user
    let startVal = rvm.peekStack(),
        index;
    if (startVal.isNull()) {
        // for .reduce() - null indicates not available
        if (!listObj.elements.length) {
            return startVal;
        }
        startVal = listObj.elements[0];
        index = 1;
    } else {
        index = 0;
    }
    // *1* place the function on the stack again
    rvm.pushStack(callback);
    rvm.pushStack(startVal);
    for (; index < listObj.elements.length; ++index) {
        // place each element in the list on the stack to serve as the
        // function's argument
        rvm.pushStack(listObj.elements[index]);
        // call the function:
        // 'reduce' expects a function accepting 2 positional arguments
        // bail if we run into an error:
        if (!rvm.execNow(callback, 2)) return rvm.dummyVal();
        // result would already be on the stack, now push the callback
        rvm.pushStack(callback);
        // swap the position of the callback and the result on the stack,
        // making the callback come first before the result, in prep for
        // the next loop iteration.
        rvm.swapLastTwo();
    }
    // final result
    const res = rvm.popStack();
    // pop off the callback pushed at *1* to balance the stack effect
    rvm.popStack();
    return res;
}

function list__each(rvm, arity) {
    // list.each(callback)
    const callback = rvm.peekStack();
    if (!callback.isCallable()) {
        list_fnError(rvm, callback);
        return rvm.dummyVal();
    }
    const listObj = rvm.peekStack(arity).asList();
    for (let i = 0; i < listObj.elements.length; ++i) {
        // *1* place the function on the stack again
        rvm.pushStack(callback);
        // place each element in the list on the stack to serve as the
        // function's argument
        rvm.pushStack(listObj.elements[i]);
        // call the function:
        // 'each' expects a function accepting only 1 positional argument
        // bail if we run into an error: TODO: allow index ?
        if (!rvm.execNow(callback, 1)) return rvm.dummyVal();
        // the result would have replaced the function initially pushed on the
        // stack at *1*, so we only need to pop once to obtain the result,
        // which balances the stack effect.
        rvm.popStack();
    }
    return mod.createNullVal();
}

function list__any(rvm, arity) {
    // list.any(callback)
    const callback = rvm.peekStack();
    if (!callback.isCallable()) {
        list_fnError(rvm, callback);
        return rvm.dummyVal();
    }
    const listObj = rvm.peekStack(arity).asList();
    for (let i = 0; i < listObj.elements.length; ++i) {
        rvm.pushStack(callback);
        rvm.pushStack(listObj.elements[i]);
        // 'any' expects a function accepting only 1 positional argument
        // bail fast if an error occurred after calling the function
        if (!rvm.execNow(callback, 1)) return rvm.dummyVal();
        // get the result [rvm.popStack()] - .any() returns once we have a true result
        // check if the result is falsy, if not return immediately
        if (!rvm.isFalsy(rvm.popStack())) return mod.createTrueVal();
    }
    return mod.createFalseVal();
}

function list__index(rvm, arity) {
    // list.index(val)
    const val = rvm.peekStack();
    const listObj = rvm.peekStack(arity).asList();
    for (let i = 0; i < listObj.elements.length; ++i) {
        if (listObj.elements[i].equals(val)) {
            return mod.createIntVal(i);
        }
    }
    return mod.createIntVal(-1);
}

function list__clear(rvm, arity) {
    // list.clear()
    const listObj = rvm.peekStack(arity).asList();
    listObj.elements = [];
    return mod.createNullVal();
}

function list__reverse(rvm, arity) {
    // list.reverse()
    const listVal = rvm.peekStack(arity);
    listVal.asList().elements.reverse();
    return listVal;
}

function list__all(rvm, arity) {
    // list.all(callback)
    const callback = rvm.peekStack();
    if (!callback.isCallable()) {
        list_fnError(rvm, callback);
        return rvm.dummyVal();
    }
    const listObj = rvm.peekStack(arity).asList();
    for (let i = 0; i < listObj.elements.length; ++i) {
        rvm.pushStack(callback);
        rvm.pushStack(listObj.elements[i]);
        // 'all' expects a function accepting only 1 positional argument
        // bail fast if an error occurred after calling the function
        if (!rvm.execNow(callback, 1)) return rvm.dummyVal();
        // get the result [rvm.popStack()] - .all() returns once we have a false result
        // check if the result is falsy, if so return immediately
        if (rvm.isFalsy(rvm.popStack())) return mod.createFalseVal();
    }
    return mod.createTrueVal();
}

function list__append(rvm, arity) {
    // list.append(val)
    const listObj = rvm.peekStack(arity).asList();
    listObj.elements.push(rvm.peekStack());
    return mod.createIntVal(listObj.elements.length);
}

function list__join(rvm, arity) {
    // list.join(val)
    const listObj = rvm.peekStack(arity).asList();
    const val = rvm.peekStack();
    if (!val.isString()) {
        rvm.runtimeError("join arg must be a string");
        return rvm.dummyVal();
    }
    let item,
        str = "",
        len = listObj.elements.length,
        arg = val.asString().raw;
    for (let i = 0; i < len; ++i) {
        item = listObj.elements[i];
        if (!item.isString()) {
            rvm.runtimeError(
                `Expected string instance at index ${i}, found ${item.typeToString()}`
            );
            return rvm.dummyVal();
        }
        str += item.asString().raw + (i < len - 1 ? arg : "");
    }
    return mod.createVMStringVal(str, rvm);
}

function list__pop(rvm, arity) {
    // list.pop()
    const listObj = rvm.peekStack(arity).asList();
    if (!listObj.elements.length) {
        rvm.runtimeError("pop from empty list");
        return rvm.dummyVal();
    }
    return listObj.elements.pop();
}

function list__first(rvm, arity) {
    // list.first()
    const listObj = rvm.peekStack(arity).asList();
    if (!listObj.elements.length) {
        return mod.createNullVal();
    }
    return listObj.elements[0];
}

function list__last(rvm, arity) {
    // list.last()
    const listObj = rvm.peekStack(arity).asList();
    if (!listObj.elements.length) {
        return mod.createNullVal();
    }
    return listObj.elements[listObj.elements.length - 1];
}

function list__insert(rvm, arity) {
    // list.insert()
    const listObj = rvm.peekStack(arity).asList();
    let index = rvm.peekStack(1);
    const item = rvm.peekStack();
    const size = listObj.elements.length;
    if (!index.isInt()) return rvm.dummyVal();
    index = index.asInt();
    if (index >= size) {
        listObj.elements.push(item);
    } else if (index < 0) {
        listObj.elements.unshift(item);
    } else {
        listObj.elements.splice(index, 0, item);
    }
    return mod.createIntVal(listObj.elements.length);
}

function list__slice(rvm, arity) {
    // takes 2 args
    const list = rvm.peekStack(arity).asList().elements;
    const arg2 = rvm.peekStack();
    const arg1 = rvm.peekStack(1);
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
        end = list.length;
    } else {
        rvm.runtimeError("slice arg must be an integer or null");
        return rvm.dummyVal();
    }
    return mod.createListVal(list.slice(start, end), rvm);
}

function list__iter(rvm, arity) {
    // list.__iter__() -> ListIterator(list)
    const itrVal = rvm.builtins.get(mod.getVMStringObj("ListIterator", rvm));
    rvm.pushStack(itrVal);
    // swap list and iterator positions
    rvm.swapLastTwo();
    // invoke and run the ListIterator's init() method - init() is run
    // immediately because the ListIterator's init method is a builtin method
    rvm.callDef(itrVal, 1);
    // after init() is run above, the value on the stack is the result of the
    // init() method call, so all we have to do is return that value,
    // without popping the stack
    return rvm.peekStack();
}

/* * *ListIterator* * */

/*
 * Handlers
 */
function list_iterator__init(rvm, arity) {
    // list_iterator.init()
    // the stack: [ ref ListIterator ][ string val ]
    const listItrInstVal = rvm.peekStack(arity);
    const listItrInst = listItrInstVal.asInstance();
    const refStr = mod.getVMStringObj("$__list_ref", rvm);
    const idxStr = mod.getVMStringObj("$__current_index", rvm);
    listItrInst.setProperty(refStr, rvm.peekStack());
    listItrInst.setProperty(idxStr, mod.createIntVal(0));
    return listItrInstVal;
}

function list_iterator__next(rvm, arity) {
    // list_iterator.__next__()
    const listItrInst = rvm.peekStack(arity).asInstance();
    const refStr = mod.getVMStringObj("$__list_ref", rvm);
    const idxStr = mod.getVMStringObj("$__current_index", rvm);
    const doneStr = mod.createVMStringVal("done", rvm);
    const valStr = mod.createVMStringVal("value", rvm);
    const listObj = listItrInst.getProperty(refStr).asList();
    let currentIndex = listItrInst.getProperty(idxStr).asInt();
    const map = new Map();
    if (currentIndex < listObj.elements.length) {
        map.set(valStr, listObj.elements[currentIndex]);
        map.set(doneStr, mod.createFalseVal());
        listItrInst.setProperty(idxStr, mod.createIntVal(++currentIndex));
    } else {
        map.set(valStr, mod.createNullVal());
        map.set(doneStr, mod.createTrueVal());
    }
    return mod.createDictVal(map, rvm);
}

exports.init = function (rvm) {
    // List
    register.registerBuiltinDef(rvm, "List", [
        {
            methodName: "__init__",
            methodExec: list__init,
            methodArity: 1,
            isVariadic: true,
        },
        {
            methodName: "length",
            methodExec: list__length,
            methodArity: 0,
        },
        {
            methodName: "map",
            methodExec: list__map,
            methodArity: 1,
        },
        {
            methodName: "each",
            methodExec: list__each,
            methodArity: 1,
        },
        {
            methodName: "any",
            methodExec: list__any,
            methodArity: 1,
        },
        {
            methodName: "all",
            methodExec: list__all,
            methodArity: 1,
        },
        {
            methodName: "append",
            methodExec: list__append,
            methodArity: 1,
        },
        {
            methodName: "join",
            methodExec: list__join,
            methodArity: 1,
        },
        {
            methodName: "pop",
            methodExec: list__pop,
            methodArity: 0,
        },
        {
            methodName: "insert",
            methodExec: list__insert,
            methodArity: 2,
        },
        {
            methodName: "slice",
            methodExec: list__slice,
            methodArity: 2,
            defaultParamsCount: 2,
            defaults: [
                { pos: 1, val: mod.createNullVal() },
                { pos: 2, val: mod.createNullVal() },
            ],
        },
        {
            methodName: "filter",
            methodExec: list__filter,
            methodArity: 1,
        },
        {
            methodName: "reduce",
            methodExec: list__reduce,
            methodArity: 2,
            defaultParamsCount: 1,
            defaults: [{ pos: 2, val: mod.createNullVal() }],
        },
        {
            methodName: "index",
            methodExec: list__index,
            methodArity: 1,
        },
        {
            methodName: "clear",
            methodExec: list__clear,
            methodArity: 0,
        },
        {
            methodName: "reverse",
            methodExec: list__reverse,
            methodArity: 0,
        },
        {
            methodName: "first",
            methodExec: list__first,
            methodArity: 0,
        },
        {
            methodName: "last",
            methodExec: list__last,
            methodArity: 0,
        },
        {
            methodName: "__iter__",
            methodExec: list__iter,
            methodArity: 0,
        },
    ]);

    // ListIterator
    register.registerBuiltinDef(
        rvm,
        "ListIterator",
        [
            {
                methodName: "__init__",
                methodExec: list_iterator__init,
                methodArity: 1,
            },
            {
                methodName: "__next__",
                methodExec: list_iterator__next,
                methodArity: 0,
            },
        ],
        null,
        true
    );
};
