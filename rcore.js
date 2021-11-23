/*
 * builtins
 */

"use strict";

const mod = require("./value");

/*
 ***************
 *  Utilities
 ***************
 */

function registerDef(rvm, dname, methodData, baseDef, excludeGlobal = false) {
    // obtain an interned StringObject for the string dname
    dname = mod.getStringObj(dname, rvm.internedStrings);
    // create def object
    const def = new mod.DefObject(dname, baseDef);
    methodData.forEach((data) => {
        // obtain an interned StringObject for the string methodName
        data.methodName = mod.getStringObj(
            data.methodName,
            rvm.internedStrings
        );
        const fn = mod.createFunctionObj(
            data.methodName,
            data.methodArity,
            null,
            false,
            data.methodExec
        );
        fn["isVariadic"] = data.isVariadic || false;
        fn["defaultParamsCount"] = data.defaultParamsCount || 0;
        def.setMethod(data.methodName, mod.createFunctionVal(fn));
        if (fn.defaultParamsCount) {
            // place the default values at position specified in `defaults`
            // - for builtin methods
            data.defaults.forEach(({ pos, val }) => (fn.defaults[pos] = val));
        }
    });
    const val = new mod.Value(mod.VAL_DEFINITION, def);
    !excludeGlobal ? rvm.globals.set(dname, val) : void 0;
    rvm.builtins.set(dname, val);
}

function registerFunc(rvm, fname, fexec, arity) {
    // obtain an interned StringObject for the string fname
    fname = mod.getStringObj(fname, rvm.internedStrings);
    const val = mod.createBFunctionVal(fname, fexec, arity);
    rvm.globals.set(fname, val);
    rvm.builtins.set(fname, val);
}


/*
 ****************************************
 *  Core methods/function implementations
 ****************************************
 */

/***********
 * Functions
 ***********/
function clock(rvm) {
    return new mod.Value(mod.VAL_INT, new Date().getTime() / 1000);
}

function str(rvm) {

}

/************
 * Methods
 ***********/

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
    return new mod.Value(mod.VAL_INT, listObj.elements.length);
}

function list__map(rvm, arity) {
    // list.map(callback)
    const callback = rvm.peekStack();
    if (!callback.isFunction()) {
        list_fnError(rvm, callback);
        return rvm.dummyVal();
    }
    const listObj = rvm.peekStack(arity).asList(); // or rvm.peekStack(1)
    const arr = [];
    let status;
    for (let i = 0; i < listObj.elements.length; ++i) {
        // *1* place the function on the stack again
        rvm.pushStack(callback);
        // place each element in the list on the stack to serve as the
        // function's argument
        rvm.pushStack(listObj.elements[i]);
        // call the function:
        // 'map' expects a function accepting only 1 positional argument
        rvm.callFn(callback, 1);
        // did an error occur when we tried to push the frame?
        if (rvm.atFault()) return rvm.dummyVal();
        status = rvm.run(callback);
        // bail if we run into an error:
        if (status !== rvm.iOK()) return rvm.dummyVal();
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
    if (!callback.isFunction()) {
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
        rvm.callFn(callback, 1);
        // did an error occur when we tried to push the frame?
        if (rvm.atFault()) return rvm.dummyVal();
        // bail if we run into an error:
        if (rvm.run(callback) !== rvm.iOK()) return rvm.dummyVal();
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
    if (!callback.isFunction()) {
        list_fnError(rvm, callback);
        return rvm.dummyVal();
    }
    const listObj = rvm.peekStack(arity).asList();
    // the starting val may either be the builtin-default,
    // or one provided by the user
    let startVal = rvm.peekStack(), index;
    if (startVal.isNull()) {  // for .reduce() - null indicates not available
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
        rvm.callFn(callback, 2);
        // did an error occur when we tried to push the frame?
        if (rvm.atFault()) return rvm.dummyVal();
        // bail if we run into an error:
        if (rvm.run(callback) !== rvm.iOK()) return rvm.dummyVal();
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
    if (!callback.isFunction()) {
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
        rvm.callFn(callback, 1);  // TODO: allow index ?
        // did an error occur when we tried to push the frame?
        if (rvm.atFault()) return rvm.dummyVal();
        // bail if we run into an error:
        if (rvm.run(callback) !== rvm.iOK()) return rvm.dummyVal();
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
    if (!callback.isFunction()) {
        list_fnError(rvm, callback);
        return rvm.dummyVal();
    }
    const listObj = rvm.peekStack(arity).asList();
    for (let i = 0; i < listObj.elements.length; ++i) {
        rvm.pushStack(callback);
        rvm.pushStack(listObj.elements[i]);
        // 'any' expects a function accepting only 1 positional argument
        rvm.callFn(callback, 1);
        // bail fast if an error occurred after calling the function
        if (rvm.atFault()) return rvm.dummyVal();
        if (rvm.run(callback) !== rvm.iOK()) return rvm.dummyVal();
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
            return new mod.Value(mod.VAL_INT, i);
        }
    }
    return new mod.Value(mod.VAL_INT, -1);
}

function list__all(rvm, arity) {
    // list.all(callback)
    const callback = rvm.peekStack();
    if (!callback.isFunction()) {
        list_fnError(rvm, callback);
        return rvm.dummyVal();
    }
    const listObj = rvm.peekStack(arity).asList();
    for (let i = 0; i < listObj.elements.length; ++i) {
        rvm.pushStack(callback);
        rvm.pushStack(listObj.elements[i]);
        // 'all' expects a function accepting only 1 positional argument
        rvm.callFn(callback, 1);
        // bail fast if an error occurred after calling the function
        if (rvm.atFault()) return rvm.dummyVal();
        if (rvm.run(callback) !== rvm.iOK()) return rvm.dummyVal();
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
    return new mod.Value(mod.VAL_INT, listObj.elements.length);
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
    return new mod.Value(mod.VAL_INT, listObj.elements.length);
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
function listiterator__init(rvm, arity) {
    // listiterator.init()
    // the stack: [ ref ListIterator ][ string val ]
    const listItrInstVal = rvm.peekStack(arity);
    const listItrInst = listItrInstVal.asInstance();
    const refStr = mod.getVMStringObj("$__list_ref", rvm);
    const idxStr = mod.getVMStringObj("$__current_index", rvm);
    listItrInst.setProperty(refStr, rvm.peekStack());
    listItrInst.setProperty(idxStr, new mod.Value(mod.VAL_INT, 0));
    return listItrInstVal;
}

function listiterator__next(rvm, arity) {
    // listiterator.__next__()
    const listItrInst = rvm.peekStack(arity).asInstance();
    const refStr = mod.getVMStringObj("$__list_ref", rvm);
    const idxStr = mod.getVMStringObj("$__current_index", rvm);
    const listObj = listItrInst.getProperty(refStr).asList();
    let currentIndex = listItrInst.getProperty(idxStr).asInt();
    const map = new Map();
    if (currentIndex < listObj.elements.length) {
        map.set("value", listObj.elements[currentIndex]);
        map.set("done", mod.createFalseVal()); // todo: dict str
        listItrInst.setProperty(
            idxStr,
            new mod.Value(mod.VAL_INT, ++currentIndex)
        );
    } else {
        map.set("value", mod.createNullVal());
        map.set("done", mod.createTrueVal()); // todo: dict str
    }
    return mod.createDictVal(map, rvm)
}


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
    return new mod.Value(mod.VAL_INT, strObj.raw.length);
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
    // immediately because the ListIterator's init method is a builtin method
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
    return new mod.Value(mod.VAL_INT, strObj.raw.indexOf(arg.asString().raw));
}

function str__split(rvm, arity) {
    // takes 1 argument
    const strObj = rvm.peekStack(arity).asString();
    const arg = rvm.peekStack();
    let splitArg;
    if (arg.isNull()) {
        splitArg = null;
    } else if (arg.isString()) {
        splitArg = arg.asString().raw;
    } else {
        rvm.runtimeError("split arg must be a string or null");
        return rvm.dummyVal();
    }
    const arr = strObj.raw.split(splitArg);
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
            !(code > 47 && code < 58) &&  // 0 - 9
            !(code > 64 && code < 91) &&  // A - Z
            !(code > 96 && code < 123)    // a - z
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
        if (
            !(code > 64 && code < 91) &&
            !(code > 96 && code < 123)
        ) {
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
function striterator__init(rvm, arity) {
    // the stack: [ ref StringIterator ][ string val ]
    const strItrInstVal = rvm.peekStack(arity);
    const strItrInst = strItrInstVal.asInstance();
    const refStr = mod.getVMStringObj("$__str_ref", rvm);
    const idxStr = mod.getVMStringObj("$__current_index", rvm);
    // set the string as the StringIterator instance's property
    strItrInst.setProperty(refStr, rvm.peekStack());
    // set the current index for use in the StringIterator's next() method
    strItrInst.setProperty(idxStr, new mod.Value(mod.VAL_INT, 0));
    return strItrInstVal;
}

function striterator__next(rvm, arity) {
    const strItrInst = rvm.peekStack().asInstance();
    const refStr = mod.getVMStringObj("$__str_ref", rvm);
    const idxStr = mod.getVMStringObj("$__current_index", rvm);
    const strObj = strItrInst.getProperty(refStr).asString();
    let index = strItrInst.getProperty(idxStr).asInt();
    let map = new Map();
    if (index < strObj.raw.length) {
        map.set("value", mod.createVMStringVal(strObj.raw[index++], rvm)); // todo: dict str
        map.set("done", mod.createFalseVal());
        strItrInst.setProperty(idxStr, new mod.Value(mod.VAL_INT, index));
    } else {
        map.set("value", mod.createVMStringVal("", rvm)); // todo: dict str
        map.set("done", mod.createTrueVal());
    }
    return mod.createDictVal(map, rvm);
}


function initAll(rvm) {
    // intern the string "String"
    const strObj = mod.getStringObj("String", rvm.internedStrings);

    // Global Functions
    registerFunc(rvm, "clock", clock, 0);

    // String
    registerDef(rvm, "String", [
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
            methodArity: 1,
            defaultParamsCount: 1,
            defaults: [{ pos: 1, val: mod.createNullVal() }],
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
    registerDef(rvm, "StringIterator", [
        {
            methodName: "__init__",
            methodExec: striterator__init,
            methodArity: 1,
        },
        {
            methodName: "__next__",
            methodExec: striterator__next,
            methodArity: 0,
        },
    ]);

    // List
    registerDef(rvm, "List", [
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
        },{
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
            methodName: "__iter__",
            methodExec: list__iter,
            methodArity: 0,
        },
    ]);

    // ListIterator
    registerDef(rvm, "ListIterator", [
        {
            methodName: "__init__",
            methodExec: listiterator__init,
            methodArity: 1,
        },
        {
            methodName: "__next__",
            methodExec: listiterator__next,
            methodArity: 0,
        },
    ], null, true);

    // associate the builtin String def with all string objects
    for (let [key, value] of rvm.internedStrings) {
        // key -> string | value -> StringObject()
        value.def = rvm.builtins.get(strObj).asDef();
    }
}

const builtins = [
    "List",
    "ListIterator",
    "Dict",
    "String",
    "StringIterator",
];


module.exports = {
    initAll,
    builtins
};
