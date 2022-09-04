"use strict";

const mod = require("../../constant/value");

/* * *Def* * */

/*
 * Handlers
 */
function def__name(rvm, arity) {
  // takes no argument.
  const instance = rvm.peekStack(arity).asInstance();
  const name = instance.def.dname;
  return new mod.Value(mod.VAL_STRING, name);
}

function def__def(rvm, arity) {
  // takes no argument.
  const instance = rvm.peekStack(arity).asInstance();
  const def = instance.def;
  return new mod.Value(mod.VAL_DEFINITION, def);
}

/*
 * utils
 */

exports.appendDefData = (methodData) => {
  const methods = [
    {
      methodName: "__defName__",
      methodExec: def__name,
      methodArity: 0,
    },
    {
      methodName: "__def__",
      methodExec: def__def,
      methodArity: 0,
    },
  ];
  for (let method of methods) {
    methodData.push(method);
  }
};

function setupDef(def, rvm) {
  const methodData = [];
  exports.appendDefData(methodData);
  methodData.forEach((data) => {
    // obtain an interned StringObject for the string methodName
    data.methodName = mod.getStringObj(data.methodName, rvm.internedStrings);
    const fn = mod.createFunctionObj(
      data.methodName,
      data.methodArity,
      null,
      false,
      data.methodExec,
      module
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
}

/**
 * @param {StringObject} name: name of the definition
 * @param {VM} rvm: the vm
 */
exports.createDefVal = (name, rvm) => {
  const def = new mod.DefObject(name);
  setupDef(def, rvm);
  return new mod.Value(mod.VAL_DEFINITION, def);
};
