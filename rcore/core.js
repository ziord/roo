/*
 * builtins
 */

"use strict";

const mod = require("../constant/value");
const functions = require("../rcore/functions");
const rdict = require("./types/dict");
const rlist = require("./types/list");
const rstring = require("./types/string");
const rnum = require("./types/num");
const rresult = require("./types/result");
const rexcept = require("./types/except");


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
    rresult.init(rvm);
    rexcept.init(rvm);
    const strDef = rvm.builtins.get(strObj).asDef();
    // associate the builtin String def with all string objects
    for (let [_, value] of rvm.internedStrings) {
        // key -> string | value -> StringObject()
        value.def = strDef;
    }
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
    "Result",
];

exports.builtinDefs = [...exports.coreDefs, "Exception"];
