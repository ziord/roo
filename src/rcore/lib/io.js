"use strict";

const fs = require("fs");
const mod = require("../../constant/value");
const register = require("../register");
const utils = require("../../utils");


/*
 ****************************
 *  module-level functions
 ****************************
 */

function io__println(rvm, arity) {
    // 1 arg: variadic (list)
    const items = rvm.peekStack().asList().elements;
    const stop = items.length - 1;
    let str;
    for (let i = 0; i < items.length; ++i) {
        str = items[i].stringify(false, rvm);
        if (rvm.hasError()) return rvm.dummyVal();
        utils.out(str);
        if (i < stop) utils.out(" ");
    }
    utils.out("\n");
    return mod.createNullVal();
}

function io__print(rvm, arity) {
    // 1 arg: variadic (list)
    const items = rvm.peekStack().asList().elements;
    const stop = items.length - 1;
    let str;
    for (let i = 0; i < items.length; ++i) {
        str = items[i].stringify(false, rvm);
        if (rvm.hasError()) return rvm.dummyVal();
        utils.out(str);
        if (i < stop) utils.out(" ");
    }
    return mod.createNullVal();
}

function io__prompt(rvm, arity) {
    // todo
}

function io__read(rvm, arity) {
    // todo
}

function io__readLine(rvm, arity) {
    // todo
}


/*
 ****************************
 *    module setup
 ****************************
 */

exports.init = function (rvm) {
    // create the filesystem module
    const io = mod.getVMStringObj("io", rvm);
    const moduleObj = mod.createModuleObj(io, null); // todo: fpath
    moduleObj.globals = new Map();

    // register module-level defs & methods
    // todo

    // register module-level functions
    register.registerCustomFunc(rvm, "print", io__print, 1, moduleObj, {
        isVariadic: true,
    });
    register.registerCustomFunc(rvm, "write", io__print, 1, moduleObj, {
        isVariadic: true,
    });
    register.registerCustomFunc(rvm, "println", io__println, 1, moduleObj, {
        isVariadic: true,
    });
    return mod.createModuleVal(moduleObj);
};
