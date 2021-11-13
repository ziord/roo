/*
 * builtins
 */

"use strict";

const vmod = require("./value");

module.exports.clock = function () {
    return new vmod.Value(vmod.VAL_INT, new Date().getTime() / 1000);
};
