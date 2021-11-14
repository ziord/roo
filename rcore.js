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

function registerDef(rvm, dname, methodData, baseDef) {
    const d = new mod.DefObject(dname, baseDef);
    methodData.forEach(({ methodName, methodExec, methodArity }) => {
        const fn = mod.createFunctionObj(
            methodName,
            methodArity,
            null,
            false,
            methodExec
        );
        d.setMethod(methodName, mod.createFunctionVal(fn));
    });
    rvm.globals[dname] = new mod.Value(mod.VAL_DEFINITION, d);
}

function registerFunc(rvm, fname, fexec, arity){
    rvm.globals[fname] = mod.createBFunctionVal(fname, fexec, arity);
}


/*
 ****************************************
 *  Core methods/function implementations
 ****************************************
 */

/**
 * Globals
 **/
function clock(rvm) {
    return new mod.Value(mod.VAL_INT, new Date().getTime() / 1000);
}

/**
 * List
 **/
function length(rvm) {
    const listObj = rvm.peekStack().asList();
    return new mod.Value(mod.VAL_INT, listObj.length);
}

function str(rvm) {

}

function initAll(rvm) {
    // Functions
    registerFunc(rvm, "clock", clock, 0);

    // List
    registerDef(rvm, "List", [
        {
            methodName: "length",
            methodExec: length,
            methodArity: 0
        },
    ]);
}


module.exports = {
    initAll
};
