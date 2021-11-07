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
    VAL_FUNCTION = 8;

/*
 * primitive types occupy this.value directly (including strings),
 * objects like list uses JS Arrays as this.value
 */
function Value(valType, value = null) {
    this.type = valType;
    this.value = value;
}

// todo: dict and list should be their own 'objects'

function ListObject(){
    this.container = [];
}

function DictObject(){
    this.map = new Map();
}


function Param(position, value){
    this.position = position;
    this.value = value;
}


function FunctionObject(name, arity, code, isLambda){
    this.name = name;
    this.arity = arity;
    this.code = code;
    this.isLambda = isLambda;
    this.upvalueCount = 0;
    this.upvalues = [];
    this.isVariadic = false;
    this.defaults = [];
    this.defaultParamsCount = 0;
}

function createFunctionObj(name, arity, code, isLambda){
  return new FunctionObject(name, arity, code, isLambda);
}

function createListObj(){
    return new Value(VAL_LIST, []);
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

function as() {
    return this.value;
}

Value.prototype.asInt = as;

Value.prototype.asList = as;

Value.prototype.asString = as;

Value.prototype.asDict = as;

Value.prototype.asFunction = as;

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
            return fromShow ? this.value : `'${this.value}'`; // todo: check string quote type
        case VAL_LIST:
            return "[" + this.value.map((e) => e.stringify()).join(", ") + "]";
        case VAL_DICT:
            return this.dictToString();
        case VAL_FUNCTION:
            // {fn foo}. top level function is script
            return this.value.name ? `{fn ${this.value.name}}` : "{script}";
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
                return this.value === otherVal.value;
            case VAL_STRING:
                return this.value === otherVal.value;
            case VAL_LIST:
                return this.listEquals(otherVal);
            case VAL_DICT:
                return this.dictEquals(otherVal);
            case VAL_FUNCTION:
                return this.asFunction() === otherVal.asFunction();
            case VAL_OBJECT:
                // todo: update
                return false;
        }
    }
};

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
    createListObj,
    ConstantPool,
    VAL_INT,
    VAL_FLOAT,
    VAL_BOOLEAN,
    VAL_NULL,
    VAL_OBJECT,
    VAL_STRING,
    VAL_LIST,
    VAL_DICT,
    VAL_FUNCTION,
};
