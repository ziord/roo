"use strict";
const fs = require("fs");
const mod = require("../../constant/value");
const register = require("../register");

function fs__read(rvm) {
    // todo: more options, and default params
    const fpath = rvm.peekStack(1).asString().raw;
    const encoding = rvm.peekStack().asString().raw;
    // {encoding:'utf8', flag:'r'}
    const data = fs.readFileSync(fpath, {encoding, flag: "r"});
    return mod.createVMStringVal(data, rvm);
}

exports.init = function (rvm) {
    // create the filesystem module
    const filesystem = mod.getVMStringObj("filesystem", rvm);
    const moduleObj = mod.createModuleObj(filesystem, null); // todo: fpath
    moduleObj.globals = new Map();

    // registerCustomFunc() automatically sets this function as part of the module's globals
    register.registerCustomFunc(rvm, "read", fs__read, 2, moduleObj);
    return mod.createModuleVal(moduleObj);
};
