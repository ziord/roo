/*
 * ConstantPool
 */

"use strict";

const { assert, UINT16_MAX, error } = require("../utils");

function ConstantPool() {
  // a pool of constants
  this.pool = [];
}

ConstantPool.prototype.length = function () {
  return this.pool.length;
};

ConstantPool.prototype.writeConstant = function (val) {
  assert(val, "ConstantPool::writeConstant()::Expected value");
  if (this.pool.length > UINT16_MAX) {
    error("Too many constants");
  }
  this.pool.push(val);
  return this.pool.length - 1;
};

ConstantPool.prototype.readConstant = function (index) {
  return this.pool[index];
};

module.exports = {
  ConstantPool,
};
