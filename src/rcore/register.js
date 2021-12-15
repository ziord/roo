"use strict";

const mod = require("../constant/value");

/*
 ***************
 *  Utilities
 ***************
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
            rvm.builtinsModule,
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

exports.registerBuiltinFunc = function (rvm, fname, fexec, arity) {
    // todo: enable defaults in BFunctionObject
    // obtain an interned StringObject for the string fname
    fname = mod.getStringObj(fname, rvm.internedStrings);
    const val = mod.createBFunctionVal(fname, fexec, arity, rvm.builtinsModule);
    rvm.globals.set(fname, val);
    rvm.builtins.set(fname, val);
};

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

exports.registerCustomFunc = function (rvm, fname, fexec, arity, module) {
    // todo: enable defaults in BFunctionObject
    // obtain an interned StringObject for the string fname
    // we use getVMStringObj() instead of getStringObj() because at this point
    // the String def would have been created & stored in the vm's `builtins` map
    fname = mod.getVMStringObj(fname, rvm);
    module.globals.set(fname, mod.createBFunctionVal(fname, fexec, arity, module));
    return module;
};
