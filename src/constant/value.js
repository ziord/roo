/*
 * value.js
 *
 */

"use strict";

const { assert, print, unreachable } = require("../utils");

// roo value types
const VAL_INT = 0,
    VAL_FLOAT = 1,
    VAL_BOOLEAN = 2,
    VAL_NULL = 3,
    VAL_OBJECT = 4,
    VAL_STRING = 5,
    VAL_LIST = 6,
    VAL_DICT = 7,
    VAL_FUNCTION = 8,
    VAL_DEFINITION = 9,
    VAL_INSTANCE = 10,
    VAL_BOUND_METHOD = 11,
    VAL_BFUNCTION = 12,
    VAL_MODULE = 13;

const builtin_obj_types = [VAL_STRING, VAL_LIST, VAL_DICT];

/*
 * primitive types occupy this.value directly,
 * objects utilize their own constructors
 */
function Value(valType, value = null) {
    this.type = valType;
    this.value = value;
}

/**
 * Roo String object
 * @param {string} str: the string
 * @param {DefObject} def: the string's definition
 * @constructor
 */
function StringObject(str, def = null) {
    this.raw = str;
    this.def = def;
}

/**
 * Roo List object
 * @param {Array} elements: elements of the list, a JS Array
 * @param {DefObject} def: the list's definition
 * @constructor
 */
function ListObject(elements = null, def = null) {
    this.elements = elements;
    this.def = def;
}

/**
 * Roo Dict object
 * @param {Map} table: map containing key-value pairs
 * @param {DefObject} def: the dict's definition
 * @constructor
 */
function DictObject(table = null, def = null) {
    this.htable = table;
    this.def = def;
}

/**
 * Represents both user defined functions/methods, and builtin methods
 * (on builtin types)
 * @param {StringObject} name: name of the function
 * @param {number} arity: number of accepted arguments
 * @param {Code} code: Code object containing the function's bytecode
 * @param {boolean} isLambda: flag for whether the function is a lambda func
 * @constructor
 */
function FunctionObject(name, arity, code, isLambda) {
    this.fname = name; /*StringObject*/
    this.arity = arity;
    this.code = code;
    this.isLambda = isLambda;
    this.upvalueCount = 0;
    this.upvalues = [];
    this.isVariadic = false;
    this.defaults = [];
    this.defaultParamsCount = 0;
    this.isStaticMethod = false;
    this.builtinFn = null; // builtin executable
    this.module = null; // module where this function was found
}

/**
 * @param {StringObject} name: name of the definition
 * @param {DefObject} baseDef: base definition from which this definition derives
 * @constructor
 */
function DefObject(name /*StringObject*/, baseDef = null /*DefObject*/) {
    this.dname = name;
    this.dmethods = new Map();
    this.baseDef = baseDef;
    this.def = null; // the meta def(inition) - the highest hierarchy.
}

/**
 * @param {DefObject} defObj: the instance's definition
 * @constructor
 */
function InstanceObject(defObj) {
    this.def = defObj;
    this.props = new Map();
}

/**
 *
 * @param {InstanceObject} inst: the instance
 * @param {Value} method: FunctionObject embedded in a Value()
 * @constructor
 */
function BoundMethodObject(inst, method) {
    this.instance = inst;
    this.method = method; // Value(FunctionObject)
}

/**
 *
 * @param {StringObject} name: name of the function
 * @param {number} arity: number of accepted arguments
 * @param {function} builtinFn: direct js function
 * @param {ModuleObject} module: module where this function was found
 * @constructor
 */
function BFunctionObject(name, arity, builtinFn, module = null) {
    this.fname = name;
    this.arity = arity;
    this.builtinFn = builtinFn;
    this.module = module; // module where this function was found
}

/**
 * @param {StringObject} name: module name
 * @param {string} fpath: module file path
 * @constructor
 */
function ModuleObject(name, fpath = null) {
    this.name = name;
    this.globals = null;  // Map<StringObject, Value>
    this.fpath = fpath;
    this.exports = null; // todo
}


/*
 * Object methods
 */

/**
 *
 * @param {Value} key
 * @returns {Value | null} value if available, else null
 */
DictObject.prototype.getVal = function (key) {
    // todo: this is super inefficient, need to revamp this.
    const v = this.htable.get(key);
    if (v) return v;
    for (let [k, v] of this.htable) {
        if (key.equals(k)) return v;
    }
    return null;
};

/**
 *
 * @param {Value} key
 * @returns {([Value, Value] | null)} key-value pair if available, else null
 */
DictObject.prototype.getKeyValPair = function (key) {
    const v = this.htable.get(key);
    if (v) return [key, v];
    for (let [k, v] of this.htable) {
        if (key.equals(k)) return [k, v];
    }
    return null;
};

/**
 *
 * @param {Value} keyVal
 * @param {Value} value
 * @returns {Map<Value, Value>}
 */
DictObject.prototype.setVal = function (keyVal, value) {
    return this.htable.set(keyVal, value);
};

/**
 * Delete a value given its key
 * @param {Value} keyVal: the key
 * @returns {Map<Value, Value>}
 */
DictObject.prototype.delVal = function (keyVal) {
    if (this.htable.delete(keyVal)) {
        return true;
    }
    for (let [k] of this.htable) {
        if (keyVal.equals(k)) {
            this.htable.delete(k);
            return true;
        }
    }
    return false;
};

/**
 * @param {StringObject} methodName
 * @returns {Value} FunctionObject value
 */
DefObject.prototype.getMethod = function (methodName) {
    return this.dmethods.get(methodName);
};

/**
 * @param {StringObject} methodName: name of the method
 * @param {Value} methodVal: FunctionObject value
 * @returns {Map<StringObject, Value(FunctionObject)>}
 */
DefObject.prototype.setMethod = function (
    methodName /*StringObject*/,
    methodVal /*Value(FunctionObject)*/
) {
    return this.dmethods.set(methodName, methodVal);
};

/**
 * @param {StringObject} propName: property name
 * @returns {Value}
 */
InstanceObject.prototype.getProperty = function (propName) {
    return this.props.get(propName);
};

/**
 * @param {StringObject} propName: property name
 * @param {Value} propVal: property value
 */
InstanceObject.prototype.setProperty = function (
    propName /*StringObject*/,
    propVal /*Value()*/
) {
    this.props.set(propName, propVal);
};

/**
 * Delete a property given its name
 * @param {StringObject} propName: property name
 */
InstanceObject.prototype.delProperty = function (propName) {
    return this.props.delete(propName);
};

/**
 * @param {StringObject} itemName: item name
 * @returns {Value}
 */
ModuleObject.prototype.getItem = function (itemName) {
    return this.globals.get(itemName);
};

/*
 * Value methods
 */

Value.fromValue = function (valObj, value) {
    return new Value(valObj.type, value);
};

Value.prototype.isNumber = function () {
    return (
        this.type === VAL_INT ||
        this.type === VAL_FLOAT ||
        this.type === VAL_BOOLEAN
    );
};

Value.prototype.isString = function () {
    return this.type === VAL_STRING;
};

Value.prototype.isInt = function () {
    return this.type === VAL_INT || this.type === VAL_BOOLEAN;
};

Value.prototype.isFloat = function () {
    return this.type === VAL_FLOAT;
};

Value.prototype.isBoolean = function () {
    return this.type === VAL_BOOLEAN;
};

Value.prototype.isNull = function () {
    return this.type === VAL_NULL;
};

Value.prototype.isList = function () {
    return this.type === VAL_LIST;
};

Value.prototype.isDict = function () {
    return this.type === VAL_DICT;
};

Value.prototype.isFunction = function () {
    return this.type === VAL_FUNCTION;
};

Value.prototype.isDef = function () {
    return this.type === VAL_DEFINITION;
};

Value.prototype.isInstance = function () {
    return this.type === VAL_INSTANCE;
};

Value.prototype.isBoundMethod = function () {
    return this.type === VAL_BOUND_METHOD;
};

Value.prototype.isBFunction = function () {
    return this.type === VAL_BFUNCTION;
};

Value.prototype.isModuleObject = function () {
    return this.type === VAL_MODULE;
};

Value.prototype.isBuiltinObject = function () {
    return builtin_obj_types.includes(this.type);
};

Value.prototype.isCallable = function () {
    return (
        this.isFunction() ||
        this.isDef() ||
        this.isBoundMethod() ||
        this.isBFunction()
    );
};

Value.prototype.getBuiltinDef = function () {
    assert(
        this.value.def !== undefined,
        "Value::getBuiltinDef() - Does not have a builtin def"
    );
    return this.value.def;
};

function as() {
    return this.value;
}

Value.prototype.asBoolean = as;

Value.prototype.asInt = as;

Value.prototype.asFloat = as;

Value.prototype.asList = as;

Value.prototype.asString = as;

Value.prototype.asDict = as;

Value.prototype.asFunction = as;

Value.prototype.asDef = as;

Value.prototype.asInstance = as;

Value.prototype.asBoundMethod = as;

Value.prototype.asBFunction = as;

Value.prototype.asModule = as;

Value.prototype.as = as;

Value.prototype.typeToString = function () {
    switch (this.type) {
        case VAL_INT:
            return "int";
        case VAL_FLOAT:
            return "float";
        case VAL_BOOLEAN:
            return "bool";
        case VAL_NULL:
            return "null";
        case VAL_STRING:
            return "string";
        case VAL_LIST:
            return "list";
        case VAL_DICT:
            return "dict";
        case VAL_FUNCTION:
            return "function";
        case VAL_DEFINITION:
            return "definition";
        case VAL_INSTANCE:
            return "instance";
        case VAL_BOUND_METHOD:
            return "bound_method";
        case VAL_BFUNCTION:
            return "builtin_function";
        case VAL_MODULE:
            return "module";
        // todo: object type
        default:
            unreachable("Value::typeToString()");
    }
};

Value.prototype.dictToString = function () {
    // uses Map() internally
    let start = "!{";
    let i = 0;
    const dict = this.asDict().htable;
    for (let [key, value] of dict) {
        ++i;
        start +=
            key.stringify(true) +
            ": " +
            (value.value !== this.value ? value.stringify(true) : "{...}");
        if (i < dict.size) start += ", ";
    }
    start += "}";
    return start;
};

Value.prototype.listToString = function () {
    const elements = this.value.elements;
    let str = "[", stop = elements.length - 1;
    for (let i = 0, elem; i < elements.length; ++i) {
        elem = elements[i];
        if (elem.value !== this.value) {
            str += elem.stringify(true);
        } else {
            str += "[...]";
        }
        if (i < stop) str += ", ";
    }
    str += "]";
    return str;
};

Value.prototype.stringify = function (includeQuotes = false, rvm = null) {
    switch (this.type) {
        case VAL_INT:
        case VAL_FLOAT:
            return `${this.value}`;
        case VAL_BOOLEAN:
            return this.value ? "true" : "false";
        case VAL_NULL:
            return "null";
        case VAL_STRING: {
            // todo: check string quote type
            return includeQuotes
                ? `'${this.asString().raw}'`
                : this.asString().raw;
        }
        case VAL_LIST:
            return this.listToString();
        case VAL_DICT:
            return this.dictToString();
        case VAL_FUNCTION:
            // {fn foo}. top level function is 'script'
            const native = this.value.builtinFn ? " :native" : "";
            return this.value.fname
                ? `{fn ${this.value.fname.raw}${native}}`
                : "{script}";
        case VAL_BOUND_METHOD:
            return `{${this.asBoundMethod().method.stringify()}:bound}`;
        case VAL_BFUNCTION:
            // {{fn foo}:native}
            return `{fn ${this.asBFunction().fname.raw} :native}`;
        case VAL_DEFINITION:
            return `{def ${this.asDef().dname.raw}}`;
        case VAL_INSTANCE: {
            // we need to support special printing methods on instances
            // if available.
            let strMethod;
            if (
                rvm &&
                (strMethod = this.asInstance().def.getMethod(
                    rvm.stringMethodName
                ))
            ) {
                // push instance
                rvm.pushStack(this);
                // execute the method now
                if (rvm.execNow(strMethod, 0)) {
                    // obtain the result - this would have replaced the instance
                    // pushed on the stack, hence popping this off balances the
                    // stack effect.
                    const str = rvm.popStack();
                    if (!str.isString()) {
                        rvm.runtimeError(
                            `__str__ returned non-string (type ${str.typeToString()})`
                        );
                        return "";
                    }
                    return str.asString().raw;
                }
                return "";
            }
            return `{ref ${this.asInstance().def.dname.raw}}`;
        }
        case VAL_MODULE: {
            return `{mod ${this.asModule().name.raw}}`;
        }
        // todo: object type
        default:
            unreachable("Value::stringify()");
    }
};

Value.prototype.toString = Value.prototype.stringify;

Value.prototype.printValue = function () {
    print(this.toString());
};

Value.prototype.listEquals = function listEquals(other) {
    if (this.value.elements.length !== other.value.elements.length)
        return false;
    else if (this.value === other.value) return true;
    for (let i = 0; i < other.value.elements.length; i++) {
        if (!this.value.elements[i].equals(other.value.elements[i]))
            return false;
    }
    return true;
};

Value.prototype.dictEquals = function dictEquals(other) {
    if (this.value.htable.size !== other.value.htable.size) return false;
    else if (this.value === other.value) return true;
    let tmp;
    for (let [key, value] of this.value.htable) {
        if (!((tmp = other.value.getVal(key)) && value.equals(tmp))) {
            return false;
        }
    }
    return true;
};

Value.prototype.equals = function (otherVal) {
    if (this.isNumber() && otherVal.isNumber()) {
        return this.value === otherVal.value;
    } else {
        if (otherVal.type !== this.type) return false;
        switch (this.type) {
            case VAL_INT:
            case VAL_FLOAT:
            case VAL_BOOLEAN:
            case VAL_NULL:
            case VAL_STRING:
            case VAL_DEFINITION:
            case VAL_INSTANCE:
            case VAL_BFUNCTION:
            case VAL_FUNCTION:
            case VAL_MODULE:
                return this.value === otherVal.value;
            case VAL_LIST:
                return this.listEquals(otherVal);
            case VAL_DICT:
                return this.dictEquals(otherVal);
            case VAL_BOUND_METHOD:
                return (
                    this.asBoundMethod().method ===
                    otherVal.asBoundMethod().method
                );
            case VAL_OBJECT:
                // todo: update
                return false;
            default:
                unreachable("Value::equals()");
        }
    }
};

/*
 * utilities
 */
/**
 * Create a FunctionObject
 * (on builtin types)
 * @param {StringObject} name: name of the function
 * @param {number} arity: number of accepted arguments
 * @param {Code} code: Code object containing the function's bytecode
 * @param {boolean} isLambda: flag for whether the function is a lambda func
 * @param builtinFn: builtin (js) function
 * @param {ModuleObject} module
 * @constructor
 */
function createFunctionObj(
    name,
    arity,
    code,
    isLambda,
    builtinFn = null,
    module = null
) {
    const fn = new FunctionObject(name, arity, code, isLambda);
    fn.module = module;
    fn.builtinFn = builtinFn;
    return fn;
}

/**
 * Create a ModuleObject
 * @param {StringObject} name: module name
 * @param {string} fpath: module file path
 * @returns {ModuleObject}
 */
function createModuleObj(name, fpath) {
    return new ModuleObject(name, fpath);
}

/**
 * @param {string} str
 * @param {Map<string, StringObject>} strings: interned strings
 * @param {DefObject} defObj
 * @returns {StringObject}
 */
function getStringObj(str, strings, defObj) {
    let strObj = strings.get(str);
    if (!strObj) {
        // intern the string
        strObj = new StringObject(str, defObj);
        strings.set(str, strObj);
    }
    return strObj;
}

/**
 * @param {string} str
 * @param {VM} rvm: the vm
 * @returns {StringObject}
 */
function getVMStringObj(str, rvm) {
    assert(
        rvm.internedStrings instanceof Map,
        "Expected a map container of strings"
    );
    const defObj = rvm.builtins
        .get(getStringObj("String", rvm.internedStrings))
        .asDef();
    return getStringObj(str, rvm.internedStrings, defObj);
}

/**
 * @param {boolean} val
 * @returns {Value}
 */
function createBoolVal(val) {
    return new Value(VAL_BOOLEAN, val | 0);
}

function createFalseVal() {
    return new Value(VAL_BOOLEAN, 0);
}

function createTrueVal() {
    return new Value(VAL_BOOLEAN, 1);
}

function createNullVal() {
    return new Value(VAL_NULL);
}

function createIntVal(intVal) {
    return new Value(VAL_INT, intVal);
}

function createFloatVal(floatVal) {
    return new Value(VAL_FLOAT, floatVal);
}

function createStringVal(str, strings) {
    assert(strings instanceof Map, "Expected a map container of strings");
    return new Value(VAL_STRING, getStringObj(str, strings));
}

function createVMStringVal(str, rvm) {
    return new Value(VAL_STRING, getVMStringObj(str, rvm));
}

function createListVal(lst, rvm) {
    return new Value(
        VAL_LIST,
        new ListObject(
            lst,
            rvm.builtins.get(getStringObj("List", rvm.internedStrings)).asDef()
        )
    );
}

function createDictVal(map, rvm) {
    return new Value(
        VAL_DICT,
        new DictObject(
            map,
            rvm.builtins.get(getStringObj("Dict", rvm.internedStrings)).asDef()
        )
    );
}

function createFunctionVal(func) {
    return new Value(VAL_FUNCTION, func);
}

function createDefVal(name) {
    return new Value(VAL_DEFINITION, new DefObject(name));
}

function createInstanceVal(defObj) {
    return new Value(VAL_INSTANCE, new InstanceObject(defObj));
}

function createBoundMethodVal(inst, method) {
    return new Value(VAL_BOUND_METHOD, new BoundMethodObject(inst, method));
}

function createBFunctionVal(fname, fexec, arity, module = null) {
    return new Value(
        VAL_BFUNCTION,
        new BFunctionObject(fname, arity, fexec, module)
    );
}

/**
 * Create a ModuleObject
 * @param {ModuleObject} module: the module object
 * @returns Value
 */
function createModuleVal(module) {
    return new Value(VAL_MODULE, module);
}


module.exports = {
    assert,
    Value,
    FunctionObject,
    DefObject,
    getStringObj,
    getVMStringObj,
    createBoolVal,
    createFalseVal,
    createTrueVal,
    createNullVal,
    createIntVal,
    createFloatVal,
    createStringVal,
    createVMStringVal,
    createDictVal,
    createFunctionObj,
    createFunctionVal,
    createListVal,
    createDefVal,
    createInstanceVal,
    createBoundMethodVal,
    createBFunctionVal,
    createModuleObj,
    createModuleVal,
    VAL_INT,
    VAL_FLOAT,
    VAL_BOOLEAN,
    VAL_NULL,
    VAL_OBJECT,
    VAL_STRING,
    VAL_LIST,
    VAL_DICT,
    VAL_FUNCTION,
    VAL_DEFINITION,
    VAL_INSTANCE,
    VAL_BOUND_METHOD,
    VAL_BFUNCTION,
    VAL_MODULE,
};
