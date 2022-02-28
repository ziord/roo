/*
 * builtins
 */

"use strict";

const mod = require("../constant/value");

// builtin functions  | <builtins module> *global
const functions = require("./functions/functions");

// core types (defs)  | <builtins module> *global
const dictType = require("./types/dict");
const listType = require("./types/list");
const stringType = require("./types/string");
const numType = require("./types/num");

// builtin defs  | <builtins module> *global
const resultDef = require("./defs/result");
const exceptDef = require("./defs/except");

// core modules  | <custom module> non-global
const fsLib = require("./lib/filesystem");
const ioLib = require("./lib/io");


/******************
 * Initialization *
 ******************/

exports.initInternedStrings = function (rvm, strObj) {
    strObj = strObj || mod.getStringObj("String", rvm.internedStrings);
    const strDef = rvm.builtins.get(strObj).asDef();
    // associate the builtin String def with all string objects
    for (let [_, value] of rvm.internedStrings) {
        // key -> string | value -> StringObject()
        if (!value.def) {
            value.def = strDef;
        }
    }
};

exports.initAll = function (rvm) {
    // intern the string "String"
    const strObj = mod.getStringObj("String", rvm.internedStrings);
    // create a builtins Module and set it on the VM
    const builtinsStr = mod.getStringObj("builtins", rvm.internedStrings);
    rvm.builtinsModule = mod.createModuleObj(builtinsStr, null); // todo: fpath
    // initialize all objects
    functions.init(rvm);
    numType.init(rvm);
    stringType.init(rvm); // string def is created here
    listType.init(rvm);
    dictType.init(rvm);
    resultDef.init(rvm);
    exceptDef.init(rvm);
    const strDef = rvm.builtins.get(strObj).asDef();
    // associate the builtin String def with all string objects
    for (let [_, value] of rvm.internedStrings) {
        // key -> string | value -> StringObject()
        value.def = strDef;
    }
};

/**
 * Get the core module
 * @param {string} modName: the module name/path
 * @param {VM} rvm: the vm
 * @returns {null|void | Value}
 */
exports.getModule = function (modName, rvm) {
    const modFiles = { filesystem: fsLib, io: ioLib };
    const moduleFile = modFiles[modName];
    if (!moduleFile) return null;
    // return an initialized module
    return moduleFile.init(rvm);
};

exports.coreDefs = [
    "Bool",
    "Int",
    "Float",
    "String",
    "StringIterator",
    "List",
    "ListIterator",
    "Dict",
    "DictKeyIterator",
];

exports.builtinDefs = [...exports.coreDefs, "Exception", "Result"];
