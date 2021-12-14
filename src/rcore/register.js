"use strict";

const mod = require("../constant/value");

/*
 ***************
 *  Utilities
 ***************
 */

exports.registerDef = function (
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

exports.registerFunc = function (rvm, fname, fexec, arity) {
    // obtain an interned StringObject for the string fname
    fname = mod.getStringObj(fname, rvm.internedStrings);
    const val = mod.createBFunctionVal(fname, fexec, arity);
    rvm.globals.set(fname, val);
    rvm.builtins.set(fname, val);
};
