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
    const def = new mod.DefObject(dname, baseDef);
    methodData.forEach((data) => {
        const fn = mod.createFunctionObj(
            data.methodName,
            data.methodArity,
            null,
            false,
            data.methodExec
        );
        fn["isSpecialMethod"] = data.isSpecialMethod || false;
        fn["isVariadic"] = data.isVariadic || false;
        fn["defaultParamsCount"] = data.defaultParamsCount || 0;
        def.setMethod(data.methodName, mod.createFunctionVal(fn));
        if (fn.defaultParamsCount) {
            // place the default values at position specified in `defaults`
            // - for builtin methods
            data.defaults.forEach(
                ({pos, val}) => fn.defaults[pos] = val
            );
        }
    });
    const val = new mod.Value(mod.VAL_DEFINITION, def);
    !excludeGlobal ? (rvm.globals[dname] = val) : void 0;
    rvm.builtins[dname] = val;
}

function registerFunc(rvm, fname, fexec, arity){
    rvm.globals[fname] = mod.createBFunctionVal(fname, fexec, arity);
    rvm.builtins[fname] = rvm.globals[fname];
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

/*
 * Errors
 */
function list_fnError(rvm, callback) {
    rvm.runtimeError(`'${callback.typeToString()}' type is not callable`);
}

/*
 * Handlers
 */
function list_init(rvm, arity) {
    /*
     * list_init() takes only one argument which is variadic.
     * any arguments passed must've been packed into a list,
     * we peek the vm's stack for the first argument (the list),
     * and use its value directly
     */
    const arr = rvm.peekStack().asList().elements;
    return mod.createListVal(arr, rvm);
}

function list_length(rvm, arity) {
    const listObj = rvm.peekStack().asList();
    return new mod.Value(mod.VAL_INT, listObj.elements.length);
}

function list_map(rvm, arity) {
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

function list_filter(rvm, arity) {
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

function list_reduce(rvm, arity) {
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

function list_each(rvm, arity) {
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
    return new mod.Value(mod.VAL_NULL);
}

function list_any(rvm, arity) {
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
        if (!rvm.isFalsy(rvm.popStack())) return new mod.Value(mod.VAL_BOOLEAN, true);
    }
    return new mod.Value(mod.VAL_BOOLEAN, false);
}

function list_index(rvm, arity) {
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

function list_all(rvm, arity) {
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
        if (rvm.isFalsy(rvm.popStack())) return new mod.Value(mod.VAL_BOOLEAN, false);
    }
    return new mod.Value(mod.VAL_BOOLEAN, true);
}

function list_append(rvm, arity) {
    // list.append(val)
    const listObj = rvm.peekStack(arity).asList();
    listObj.elements.push(rvm.peekStack());
    return new mod.Value(mod.VAL_INT, listObj.elements.length);
}

function list_pop(rvm, arity) {
    // list.pop()
    const listObj = rvm.peekStack(arity).asList();
    if (!listObj.elements.length) {
        rvm.runtimeError("pop from empty list");
        return rvm.dummyVal();
    }
    return listObj.elements.pop();
}

function list_insert(rvm, arity) {
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

function list_iter(rvm, arity) {
    // list.iter*() -> ListIterator(list)
    //# const listObj = rvm.peekStack(arity).asList();
    const itrVal = new mod.Value(
        mod.VAL_DEFINITION,
        rvm.builtins["ListIterator"].asDef()
    );
    rvm.pushStack(itrVal);
    // swap list and iterator positions
    rvm.swapLastTwo();
    // invoke and run the ListIterator's init*() method - init*() is run
    // immediately because the ListIterator's init method is a builtin method
    rvm.callDef(itrVal, 1);
    // after init*() is run above, the value on the stack is the result of the
    // init*() method call, so all we have to do is return that value,
    // without popping the stack
    return rvm.peekStack();
}


/* * *ListIterator* * */

/*
 * Handlers
 */
function listiterator_init(rvm, arity) {
    // listiterator.init()
    const itrInstVal = rvm.peekStack(arity);
    const itrInst = itrInstVal.asInstance();
    itrInst.setProperty("$__list_ref", rvm.peekStack());
    itrInst.setProperty("$__current_idx", new mod.Value(mod.VAL_INT, 0));
    return itrInstVal;
}

function listiterator_next(rvm, arity) {
    // listiterator.next()
    const listItrObj = rvm.peekStack(arity).asInstance();
    const listObj = listItrObj.getProperty("$__list_ref").asList();
    let currentIndex = listItrObj.getProperty("$__current_idx").asInt();
    const map = new Map();
    if (currentIndex < listObj.elements.length) {
        map.set("done", new mod.Value(mod.VAL_BOOLEAN, false));
        map.set("value", listObj.elements[currentIndex]);
        listItrObj.setProperty(
            "$__current_idx",
            new mod.Value(mod.VAL_INT, ++currentIndex)
        );
    } else {
        map.set("done", new mod.Value(mod.VAL_BOOLEAN, true));
        map.set("value", new mod.Value(mod.VAL_NULL));
    }
    return mod.createDictVal(map, rvm)
}


function initAll(rvm) {
    // Functions
    registerFunc(rvm, "clock", clock, 0);

    // List
    registerDef(rvm, "List", [
        {
            methodName: rvm.initializerMethodName,
            methodExec: list_init,
            methodArity: 1,
            isSpecialMethod: true,
            isVariadic: true,
        },
        {
            methodName: "length",
            methodExec: list_length,
            methodArity: 0,
        },
        {
            methodName: "map",
            methodExec: list_map,
            methodArity: 1,
        },
        {
            methodName: "each",
            methodExec: list_each,
            methodArity: 1,
        },
        {
            methodName: "any",
            methodExec: list_any,
            methodArity: 1,
        },
        {
            methodName: "all",
            methodExec: list_all,
            methodArity: 1,
        },
        {
            methodName: "append",
            methodExec: list_append,
            methodArity: 1,
        },
        {
            methodName: "pop",
            methodExec: list_pop,
            methodArity: 0,
        },
        {
            methodName: "insert",
            methodExec: list_insert,
            methodArity: 2,
        },
        {
            methodName: "filter",
            methodExec: list_filter,
            methodArity: 1,
        },
        {
            methodName: "reduce",
            methodExec: list_reduce,
            methodArity: 2,
            defaultParamsCount: 1,
            defaults: [{ pos: 2, val: new mod.Value(mod.VAL_NULL) }],
        },
        {
            methodName: "index",
            methodExec: list_index,
            methodArity: 1,
        },
        {
            methodName: "__iter__",
            methodExec: list_iter,
            methodArity: 0,
        },
    ]);
    registerDef(rvm, "ListIterator", [
        {
            methodName: rvm.initializerMethodName,
            methodExec: listiterator_init,
            methodArity: 1,
            isSpecialMethod: true,
        },
        {
            methodName: "__next__",
            methodExec: listiterator_next,
            methodArity: 0,
            isSpecialMethod: true,
        },
    ], null, true);
}

const builtins = [
    "List",
    "ListIterator",
    "Dict",
    "String"
];


module.exports = {
    initAll,
    builtins
};
