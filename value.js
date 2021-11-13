/*
 * value.js
 *
 */

"use strict";

const { assert, print, unreachable, UINT16_MAX, error } = require("./utils");

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
    VAL_BFUNCTION = 12;

/*
 * primitive types occupy this.value directly (including strings),
 * objects like list uses JS Arrays as this.value
 */
function Value(valType, value = null) {
    this.type = valType;
    this.value = value;
}

function FunctionObject(name, arity, code, isLambda){
    this.fname = name;  /*string*/
    this.arity = arity;
    this.code = code;
    this.isLambda = isLambda;
    this.upvalueCount = 0;
    this.upvalues = [];
    this.isVariadic = false;
    this.defaults = [];
    this.defaultParamsCount = 0;
    this.isSpecialMethod = false;
    this.isStaticMethod = false;
}

function DefObject(name /*string*/){
    this.dname = name;
    this.dmethods = new Map();
}

function InstanceObject(defObj){
    this.def = defObj;  // DefObject
    this.props = new Map();
}

function BoundMethodObject(inst, method){
    this.instance = inst;
    this.method = method; // Value(FunctionObject)
}

function BFunctionObject(name, arity, builtinFn) {
    this.fname = name;
    this.arity = arity;
    this.builtinFn = builtinFn;
}

Value.fromValue = function (valObj, value){
    return new Value(valObj.type, value);
};

Value.prototype.isNumber = function() {
    return (
        this.type === VAL_INT ||
        this.type === VAL_FLOAT ||
        this.type === VAL_BOOLEAN
    );
};

Value.prototype.isString = function() {
    return this.type === VAL_STRING;
};

Value.prototype.isInt = function() {
    return (
        this.type === VAL_INT ||
        this.type === VAL_BOOLEAN
    );
};

Value.prototype.isFloat = function() {
    return this.type === VAL_FLOAT;
};

Value.prototype.isBoolean = function() {
    return this.type === VAL_BOOLEAN;
};

Value.prototype.isNull = function() {
    return this.type === VAL_NULL;
};

Value.prototype.isList = function() {
    return this.type === VAL_LIST;
};

Value.prototype.isDict = function(){
  return this.type === VAL_DICT;
};

Value.prototype.isFunction = function(){
    return this.type === VAL_FUNCTION;
};

Value.prototype.isDef = function(){
    return this.type === VAL_DEFINITION;
};

Value.prototype.isInstance = function(){
    return this.type === VAL_INSTANCE;
};

Value.prototype.isBoundMethod = function(){
    return this.type === VAL_BOUND_METHOD;
};

Value.prototype.isBFunction = function(){
    return this.type === VAL_BFUNCTION;
};

function as() {
    return this.value;
}

Value.prototype.asInt = as;

Value.prototype.asList = as;

Value.prototype.asString = as;

Value.prototype.asDict = as;

Value.prototype.asFunction = as;

Value.prototype.asDef = as;

Value.prototype.asInstance = as;

Value.prototype.asBoundMethod = as;

Value.prototype.asBFunction = as;

Value.prototype.typeToString = function() {
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
        // todo: object type
        default:
            unreachable("Value::typeToString()");
    }
};

Value.prototype.dictToString = function (){
    // uses Map() internally
    let start = "{";
    let i = 0;
    for (let [key, value] of this.value){
        ++i;
        start += key + ": " + value.stringify();
        if (i < this.value.size) start += ", ";
    }
    start += "}";
    return start;
};

Value.prototype.stringify = function(fromShow=false) {
    switch (this.type) {
        case VAL_INT:
        case VAL_FLOAT:
            return `${this.value}`;
        case VAL_BOOLEAN:
            return this.value ? "true" : "false";
        case VAL_NULL:
            return "null";
        case VAL_STRING:
            // todo: check string quote type
            return fromShow ? this.value : `'${this.value}'`;
        case VAL_LIST:
            return "[" + this.value.map((e) => e.stringify()).join(", ") + "]";
        case VAL_DICT:
            return this.dictToString();
        case VAL_FUNCTION:
            // {fn foo}. top level function is 'script'
            return this.value.fname ? `{fn ${this.value.fname}}` : "{script}";
        case VAL_DEFINITION:
            return `{def ${this.asDef().dname}}`;
        case VAL_INSTANCE:
            return `{ref ${this.asInstance().def.dname}}`;
        case VAL_BOUND_METHOD:
            return `{${this.asBoundMethod().method.stringify()}:bound}`;
        case VAL_BFUNCTION:
            // {{fn foo}:native}
            return `{{fn ${this.asBFunction().fname}}:native}`;
        // todo: object type
        default:
            unreachable("Value::stringify()");
    }
};

Value.prototype.toString = Value.prototype.stringify;

Value.prototype.printValue = function() {
    print(this.toString());
};

Value.prototype.listEquals = function listEquals(other){
    if (this.value.length !== other.value.length) return false;
    for (let i = 0; i < other.value.length; i++){
        if (!this.value[i].equals(other.value[i])) return false;
    }
    return true;
};

Value.prototype.dictEquals = function dictEquals(other) {
    if (this.value.size !== other.value.size) return false;
    for (let [key, value] of this.value) {
        if (!(other.value.has(key) &&
            value.equals(other.value.get(key)))) {
            return false;
        }
    }
    return true;
};

Value.prototype.equals = function(otherVal) {
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
                return this.value === otherVal.value;
            case VAL_LIST:
                return this.listEquals(otherVal);
            case VAL_DICT:
                return this.dictEquals(otherVal);
            case VAL_FUNCTION:
                return this.asFunction() === otherVal.asFunction();
            case VAL_DEFINITION:
                return this.asDef() === otherVal.asDef();
            case VAL_INSTANCE:
                return this.asInstance() === otherVal.asInstance();
            case VAL_BOUND_METHOD:
                return this.asBoundMethod().method === otherVal.asBoundMethod().method;
            case VAL_BFUNCTION:
                return this.asBFunction() === otherVal.asBFunction();
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
function createFunctionObj(name, arity, code, isLambda) {
    return new FunctionObject(name, arity, code, isLambda);
}

function createFunctionVal(func) {
    return new Value(VAL_FUNCTION, func);
}

function createListVal(lst) {
    return new Value(VAL_LIST, lst || []);
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

function createBFunctionVal(fname, fexec, arity) {
    return new Value(VAL_BFUNCTION, new BFunctionObject(fname, arity, fexec));
}

/*
 * ConstantPool
 */
function ConstantPool() {
    // a pool of constants
    this.pool = [];
}

ConstantPool.prototype.length = function() {
    return this.pool.length;
};

ConstantPool.prototype.writeConstant = function(val) {
    assert(val, "ConstantPool::writeConstant()::Expected value");
    if (this.pool.length > UINT16_MAX){
        error("Too many constants")
    }
    this.pool.push(val);
    return this.pool.length - 1;
};

ConstantPool.prototype.readConstant = function (index){
    return this.pool[index];
};

module.exports = {
    assert,
    Value,
    FunctionObject,
    // ListObject,
    createFunctionObj,
    createFunctionVal,
    createListVal,
    ConstantPool,
    createDefVal,
    createInstanceVal,
    createBoundMethodVal,
    createBFunctionVal,
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
    VAL_BOUND_METHOD
};
