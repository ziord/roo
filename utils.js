/*
 * utils
 */

"use strict";

const out = process.stdout.write.bind(process.stdout);

const print = console.log;

const UINT16_COUNT = 0x10000;

function assert(test, msg) {
    if (!test) throw new Error(`FailedAssert: ${msg}`);
}

function unreachable (msg){
    throw new Error(`Reached unreachable at: ${msg}`);
}

function error(msg){
   console.error(msg);
   process.exit(-1);
}

function exitVM(code){
    process.exit(code !== undefined ? code : -1);
}

module.exports = {assert, out, print, unreachable, error, UINT16_COUNT, exitVM};
