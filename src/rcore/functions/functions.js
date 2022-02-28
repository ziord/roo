"use strict";

const mod = require("../../constant/value");
const utils = require("../../utils");
const register = require("../register");

/*
 ****************************************
 *  Core methods/function implementations
 ****************************************
 */

/***********
 * Functions
 ***********/
function roo__clock(rvm, arity) {
    return mod.createIntVal(new Date().getTime() / 1000);
}

function roo__str(rvm, arity) {
    const str = rvm.peekStack().stringify(true, rvm);
    return mod.createVMStringVal(str, rvm);
}

function roo__setProperty(rvm, arity) {
    // takes 3 args
    const obj = rvm.peekStack(2);
    const prop = rvm.peekStack(1);
    const val = rvm.peekStack();
    if (!prop.isString()) {
        rvm.runtimeError(
            `property name must be string, not '${prop.typeToString()}'`
        );
        return rvm.dummyVal();
    }
    if (obj.isInstance()) {
        obj.asInstance().setProperty(prop.asString(), val);
        return mod.createNullVal();
    } else {
        rvm.runtimeError(`Can't set property on '${obj.typeToString()}'`);
        return rvm.dummyVal();
    }
}

function roo__getProperty(rvm, arity) {
    // takes 2 args
    const obj = rvm.peekStack(1);
    const prop = rvm.peekStack();
    if (!prop.isString()) {
        rvm.runtimeError(
            `property name must be string, not '${prop.typeToString()}'`
        );
        return rvm.dummyVal();
    }
    let def,
        val,
        strObj = prop.asString();
    if (obj.isInstance() && (val = obj.asInstance().getProperty(strObj))) {
        return val;
    } else if ((def = obj.as().def) && (val = def.getMethod(strObj))) {
        return val;
    } else if (obj.isModuleObject() && (val = obj.asModule().getItem(strObj))) {
        return val;
    }
    rvm.runtimeError(
        `${obj.stringify()} has no property ${prop.stringify(true)}`
    );
    return rvm.dummyVal();
}

function roo__hasProperty(rvm, arity) {
    // takes 2 args
    const obj = rvm.peekStack(1);
    const prop = rvm.peekStack();
    if (!prop.isString()) {
        rvm.runtimeError(
            `property name must be string, not '${prop.typeToString()}'`
        );
        return rvm.dummyVal();
    }
    let def,
        strObj = prop.asString();
    if (obj.isInstance() && obj.asInstance().getProperty(strObj)) {
        return mod.createTrueVal();
    } else if ((def = obj.as().def) && def.getMethod(strObj)) {
        return mod.createTrueVal();
    } else if (obj.isModuleObject() && obj.asModule().getItem(strObj)) {
        return mod.createTrueVal();
    }
    return mod.createFalseVal();
}

function roo__typeOf(rvm, arity) {
    // takes 1 arg
    const obj = rvm.peekStack();
    return mod.createVMStringVal(obj.typeToString(), rvm);
}

function roo__assert(rvm, arity) {
    // takes 2 args
    const msgVal = rvm.peekStack();
    const testVal = rvm.peekStack(1);
    if (rvm.isFalsy(testVal)) {
        rvm.runtimeError(null, msgVal);
        return rvm.dummyVal();
    }
    return mod.createNullVal();
}

function roo__exit(rvm, arity) {
    // takes 1 arg
    const obj = rvm.peekStack();
    if (!obj.isInt()) {
        rvm.runtimeError("arg must be int");
        return rvm.dummyVal();
    }
    // todo: vm teardown here
    process.exit(obj.asInt());
}

function roo__isInstance(rvm, arity) {
    const obj1 = rvm.peekStack(1);
    const obj2 = rvm.peekStack();
    if (!obj2.isDef()) {
        rvm.runtimeError(`second arg must be a definition`);
        return rvm.dummyVal();
    }
    const defName = obj2.asDef().dname.raw;
    if (obj1.isInt() && defName === "Int") {
        return mod.createTrueVal();
    } else if (obj1.isFloat() && defName === "Float") {
        return mod.createTrueVal();
    } else if (!obj1.as().def) {
        return mod.createFalseVal();
    } else if (obj1.as().def === obj2.asDef()) {
        return mod.createTrueVal();
    } else {
        let def = obj1.asInstance().def.baseDef,
            desc = obj2.asDef();
        while (def) {
            if (def === desc) return mod.createTrueVal();
            def = def.baseDef;
        }
        return mod.createFalseVal();
    }
}

function roo__dir(rvm, arity) {
    const val = rvm.peekStack();
    let def;
    const props = [];
    switch (val.type) {
        case mod.VAL_BOOLEAN:
        case mod.VAL_INT:
        case mod.VAL_FLOAT:
        case mod.VAL_NULL:
        case mod.VAL_BFUNCTION: // todo
        case mod.VAL_DEFINITION: // todo
            return mod.createListVal();
        case mod.VAL_STRING:
        case mod.VAL_LIST:
        case mod.VAL_DICT:
        case mod.VAL_FUNCTION: // todo
            def = val.as().def;
            break;
        case mod.VAL_INSTANCE: {
            const m = val.asInstance().props;
            for (let k of m.keys()) {
                props.push(new mod.Value(mod.VAL_STRING, k));
            }
            def = val.as().def;
            break;
        }
        case mod.VAL_BOUND_METHOD:
            def = val.asBoundMethod().method.asFunction().def;
            break;
        default:
            utils.unreachable("rcore::roo__dir()");
    }
    for (let k of def.dmethods.keys()) {
        props.push(new mod.Value(mod.VAL_STRING, k));
    }
    return mod.createListVal(props, rvm);
}

exports.init = function (rvm) {
    // Global Functions
    register.registerBuiltinFunc(rvm, "clock", roo__clock, 0);
    register.registerBuiltinFunc(rvm, "str", roo__str, 1);
    register.registerBuiltinFunc(rvm, "setProperty", roo__setProperty, 3);
    register.registerBuiltinFunc(rvm, "getProperty", roo__getProperty, 2);
    register.registerBuiltinFunc(rvm, "hasProperty", roo__hasProperty, 2);
    register.registerBuiltinFunc(rvm, "typeOf", roo__typeOf, 1);
    register.registerBuiltinFunc(rvm, "isInstance", roo__isInstance, 2);
    register.registerBuiltinFunc(rvm, "exit", roo__exit, 1);
    register.registerBuiltinFunc(rvm, "assert", roo__assert, 2);
    // register.registerBuiltinFunc(rvm, "dir", roo__dir, 1); todo
};
