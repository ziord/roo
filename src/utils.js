/*
 * utils
 */

"use strict";

const UINT16_MAX = 0xffff;
const UINT16_COUNT = 0x10000;
const MAX_FUNCTION_PARAMS = 0x100;
const MAX_IMPORTABLE_NAMES = 0x100;
const MAX_UPVALUE_COUNT = 0x100;

const out = process.stdout.write.bind(process.stdout);
const print = console.log;

function assert(test, msg) {
  if (!test) throw new Error(`FailedAssert: ${msg}`);
}

function unreachable(msg) {
  throw new Error(`Reached unreachable at: ${msg}`);
}

function error(msg) {
  console.error(msg);
}

function exit(code) {
  process.exit(code !== undefined ? code : -1);
}

module.exports = {
  UINT16_MAX,
  UINT16_COUNT,
  MAX_FUNCTION_PARAMS,
  MAX_UPVALUE_COUNT,
  MAX_IMPORTABLE_NAMES,
  assert,
  out,
  print,
  unreachable,
  error,
  exit,
};
