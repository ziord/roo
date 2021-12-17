"use strict";

const mod = require("../constant/value");

/*
 ***************
 *  Utilities
 ***************
 */

/**
 * Register a builtin Def
 * @param {VM} rvm: the vm
 * @param {string} dname: the def's name
 * @param {Array} methodData: the def's method data
 * @param {DefObject} baseDef: the def's base def
 * @param {boolean} excludeGlobal: flag controlling the def's global visibility
 */
exports.registerBuiltinDef = function (
    rvm,
    dname,
    methodData,
    baseDef,
    excludeGlobal = false
) {
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
            data.methodExec,
            rvm.builtinsModule
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
};

/**
 * Register a builtin function
 * @param {VM} rvm: the vm
 * @param {string} fname: the function's name
 * @param {Function} fexec: the functions's executable
 * @param {number} arity: number of parameters
 * @param {Object | null} functionData: the function's data
 */
exports.registerBuiltinFunc = function (
    rvm,
    fname,
    fexec,
    arity,
    functionData = null
) {
    // obtain an interned StringObject for the string fname
    fname = mod.getStringObj(fname, rvm.internedStrings);
    let val = null;
    if (functionData) {
        const fn = mod.createFunctionObj(
            fname,
            arity,
            null,
            false,
            fexec,
            rvm.builtinsModule
        );
        fn["isVariadic"] = functionData.isVariadic || false;
        fn["defaultParamsCount"] = functionData.defaultParamsCount || 0;
        if (fn.defaultParamsCount) {
            // place the default values at position specified in `defaults`
            functionData.defaults.forEach(
                ({ pos, val }) => (fn.defaults[pos] = val)
            );
        }
        val = mod.createFunctionVal(fn);
    } else {
        val = mod.createBFunctionVal(fname, fexec, arity, rvm.builtinsModule);
    }
    rvm.globals.set(fname, val);
    rvm.builtins.set(fname, val);
};

/**
 * Register a custom Def
 * @param {VM} rvm: the vm
 * @param {string} dname: the def's name
 * @param {Array} methodData: the def's method data
 * @param {DefObject} baseDef: the def's base def
 * @param {ModuleObject} module: the def's module
 */
exports.registerCustomDef = function (rvm, dname, methodData, baseDef, module) {
    // obtain an interned StringObject for the string dname
    // we use getVMStringObj() instead of getStringObj() because at this point
    // the String def would have been created & stored in the vm's `builtins` map
    dname = mod.getVMStringObj(dname, rvm);
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
            data.methodExec,
            module
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
    module.globals.set(dname, new mod.Value(mod.VAL_DEFINITION, def));
    return module;
};

/**
 * Register a custom function
 * @param {VM} rvm: the vm
 * @param {string} fname: the function's name
 * @param {Function} fexec: the functions's executable
 * @param {number} arity: number of parameters
 * @param {ModuleObject} module: the function's module
 * @param {Object | null} functionData: the function's data
 */
exports.registerCustomFunc = function (
    rvm,
    fname,
    fexec,
    arity,
    module,
    functionData = null
) {
    // obtain an interned StringObject for the string fname
    // we use getVMStringObj() instead of getStringObj() because at this point
    // the String def would have been created & stored in the vm's `builtins` map
    fname = mod.getVMStringObj(fname, rvm);
    let val = null;
    if (functionData) {
        const fn = mod.createFunctionObj(
            fname,
            arity,
            null,
            false,
            fexec,
            module
        );
        fn["isVariadic"] = functionData.isVariadic || false;
        fn["defaultParamsCount"] = functionData.defaultParamsCount || 0;
        if (fn.defaultParamsCount) {
            // place the default values at position specified in `defaults`
            functionData.defaults.forEach(
                ({ pos, val }) => (fn.defaults[pos] = val)
            );
        }
        val = mod.createFunctionVal(fn);
    } else {
        val = mod.createBFunctionVal(fname, fexec, arity, module);
    }
    module.globals.set(fname, val);
    return module;
};
