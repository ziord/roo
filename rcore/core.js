/*
 * builtins
 */

"use strict";

const mod = require("../constant/value");
const functions = require("../rcore/functions");
const rdict = require("../rcore/rdict");
const rlist = require("../rcore/rlist");
const rstring = require("../rcore/rstring");
const rnum = require("../rcore/rnum");


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

exports.initAll = function(rvm) {
    // intern the string "String"
    const strObj = mod.getStringObj("String", rvm.internedStrings);
    functions.init(rvm);
    rnum.init(rvm);
    rstring.init(rvm);  // string def is created here
    rlist.init(rvm);
    rdict.init(rvm);
    const strDef = rvm.builtins.get(strObj).asDef();
    // associate the builtin String def with all string objects
    for (let [_, value] of rvm.internedStrings) {
        // key -> string | value -> StringObject()
        value.def = strDef;
    }
};

exports.builtinDefs = [
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
