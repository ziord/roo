"use strict";

const fs = require("fs");
const os = require("os");
const mod = require("../../constant/value");
const register = require("../register");


/*
 ****************************
 *   constants (utils)
 ****************************
 */

const writeFlags = ["a", "a+", "as", "as+", "w", "w+"];
const readWriteFlags = [...writeFlags, "r"];
const encodings = [
    "utf-8",
    "utf8",
    "ascii",
    "hex",
    "base64",
    "ucs2",
    "ucs-2",
    "latin1",
    "utf16le",
    "utf-16le",
    "binary",
];


/*
 ****************************
 *  module-level def utils
 ****************************
 */

function __getFD(instance, rvm) {
    const descStr = mod.getVMStringObj("$__fileDescriptor", rvm);
    const fd = instance.getProperty(descStr);
    if (fd === undefined) {
        rvm.runtimeError(`Invalid descriptor. Could not obtain file.`);
        return null;
    }
    return fd.asInt();
}

function __read(rvm, arity) {
    // for 1 arg read functions [arg: encoding]
    if (!rvm.peekStack().isString()) {
        rvm.runtimeError("encoding must be a string");
        return null;
    }
    const encoding = rvm.peekStack().asString().raw.toLowerCase();
    if (!encodings.includes(encoding)) {
        rvm.runtimeError("encoding not supported");
        return null;
    }
    const instance = rvm.peekStack(arity).asInstance();
    const fd = __getFD(instance, rvm);
    if (fd === null) return null;
    try {
        return fs.readFileSync(fd, {encoding, flag: "r"});
    } catch (e) {
        rvm.runtimeError("Unsupported operation");
        return null;
    }
}

function __write(rvm, arity, data) {
    // for 3 args write functions [args: data, encoding, flag]
    if (!rvm.peekStack(1).isString()) {
        rvm.runtimeError("encoding must be a string");
        return rvm.dummyVal();
    }
    if (!rvm.peekStack().isString()) {
        rvm.runtimeError("flag must be a string");
        return rvm.dummyVal();
    }
    const encoding = rvm.peekStack(1).asString().raw.toLowerCase();
    if (!encodings.includes(encoding)) {
        rvm.runtimeError("encoding not supported");
        return rvm.dummyVal();
    }
    const flag = rvm.peekStack().asString().raw.toLowerCase();
    if (!writeFlags.includes(flag)) {
        rvm.runtimeError("flag not supported");
        return rvm.dummyVal();
    }
    const instance = rvm.peekStack(arity).asInstance();
    const fd = __getFD(instance, rvm);
    if (fd === null) return rvm.dummyVal();
    try {
        fs.writeFileSync(fd, data, { encoding, flag });
    } catch (e) {
        rvm.runtimeError("Unsupported operation");
        return rvm.dummyVal();
    }
    return mod.createTrueVal();
}

/*
 ****************************
 *  module-level def methods
 ****************************
 */

function file__init(rvm, arity) {
    // takes 2 args: path, flags
    if (!rvm.peekStack(1).isString()) {
        rvm.runtimeError("file path must be a string");
        return rvm.dummyVal();
    }
    if (!rvm.peekStack().isString()) {
        rvm.runtimeError("flag must be a string");
        return rvm.dummyVal();
    }
    const instance = rvm.peekStack(arity).asInstance();
    const fpath = rvm.peekStack(1).asString().raw;
    const flag = rvm.peekStack().asString().raw;
    if (!readWriteFlags.includes(flag)) {
        rvm.runtimeError("flag not supported");
        return rvm.dummyVal();
    }
    const descStr = mod.getVMStringObj("$__fileDescriptor", rvm);
    const fileStr = mod.getVMStringObj("$__filePath", rvm);
    const modeStr = mod.getVMStringObj("$__fileMode", rvm);
    try {
        // set the file descriptor
        instance.setProperty(descStr, mod.createIntVal(fs.openSync(fpath, flag)));
    } catch (e) {
        rvm.runtimeError("Bad operation");
        return rvm.dummyVal();
    }
    instance.setProperty(fileStr, rvm.peekStack(1)); // file path
    instance.setProperty(modeStr, rvm.peekStack()); // `flag` as `mode`
    return rvm.peekStack(arity); // return the instance
}

function file__close(rvm, arity) {
    const instance = rvm.peekStack(arity).asInstance();
    const fd = __getFD(instance, rvm);
    if (fd === null) return rvm.dummyVal();
    try {
        fs.closeSync(fd);
    } catch (e) {
        rvm.runtimeError("Bad operation");
        return rvm.dummyVal();
    }
    return mod.createNullVal();
}

function file__read(rvm, arity) {
    // takes 1 arg: encoding {default}
    const data = __read(rvm, arity);
    if (data === null) return rvm.dummyVal();
    return mod.createVMStringVal(data, rvm);
}

function file__readLines(rvm, arity) {
    // takes 1 arg: encoding {default}
    let data = __read(rvm, arity);
    if (data === null) return rvm.dummyVal();
    data = data.split(os.platform() === 'win32' ? "\r\n" : "\n");
    const list = [];
    for (let line of data) {
        list.push(mod.createVMStringVal(line, rvm));
    }
    return mod.createListVal(list, rvm);
}

function file__write(rvm, arity) {
    // takes 3 args: data, encoding, flag {defaults}
    if (!rvm.peekStack(2).isString()) {
        rvm.runtimeError("data must be a string");
        return rvm.dummyVal();
    }
    const data = rvm.peekStack(2).asString().raw;
    return __write(rvm, arity, data);
}

function file__writeLines(rvm, arity) {
    // takes 3 args: data, encoding, flag {defaults}
    if (!rvm.peekStack(2).isList()) {
        rvm.runtimeError("data must be a list of strings");
        return rvm.dummyVal();
    }
    const lines = rvm.peekStack(2).asList().elements;
    let tmp, data = "", newline = os.platform() === "win32" ? "\r\n" : "\n";
    for (let i = 0; i < lines.length; ++i) {
        tmp = lines[i];
        if (!tmp.isString()) {
            rvm.runtimeError(
                `Expected content of type 'string', but got '${tmp.typeToString()}'`
            );
            return rvm.dummyVal();
        }
        data += tmp.asString().raw + newline;
    }
    return __write(rvm, arity, data.trimEnd());
}

function file__str(rvm, arity) {
    // takes no arg
    const instance = rvm.peekStack(arity).asInstance();
    const fileStr = mod.getVMStringObj("$__filePath", rvm);
    const modeStr = mod.getVMStringObj("$__fileMode", rvm);
    const fpathV = instance.getProperty(fileStr);
    const modeV = instance.getProperty(modeStr);
    if (!fpathV.isString() || !modeV.isString()) {
        rvm.runtimeError("File internal attributes modified");
        return rvm.dummyVal();
    }
    const fpath = fpathV.asString().raw;
    const mode = modeV.asString().raw;
    return mod.createVMStringVal(`File<name='${fpath}', mode='${mode}'>`, rvm);
}

/*
 ****************************
 *  module-level functions
 ****************************
 */

function fs__write(rvm, arity) {
    // takes 4 args: file, data, encoding, flag
    if (!rvm.peekStack(3).isString()) {
        rvm.runtimeError("file path must be a string");
        return rvm.dummyVal();
    }
    if (!rvm.peekStack(2).isString()) {
        rvm.runtimeError("data must be a string");
        return rvm.dummyVal();
    }
    if (!rvm.peekStack(1).isString()) {
        rvm.runtimeError("encoding must be a string");
        return rvm.dummyVal();
    }
    if (!rvm.peekStack().isString()) {
        rvm.runtimeError("flag must be a string");
        return rvm.dummyVal();
    }
    const fpath = rvm.peekStack(3).asString().raw;
    const data = rvm.peekStack(2).asString().raw;
    const encoding = rvm.peekStack(1).asString().raw.toLowerCase();
    if (!encodings.includes(encoding)) {
        rvm.runtimeError("encoding not supported");
        return rvm.dummyVal();
    }
    const flag = rvm.peekStack().asString().raw.toLowerCase();
    if (!writeFlags.includes(flag)) {
        rvm.runtimeError("flag not supported");
        return rvm.dummyVal();
    }
    fs.writeFileSync(fpath, data, { encoding, flag });
    return mod.createTrueVal();
}

function fs__read(rvm, arity) {
    // takes 2 args: file, encoding
    // file path
    if (!rvm.peekStack(1).isString()) {
        rvm.runtimeError("file path must be a string");
        return rvm.dummyVal();
    }
    if (!rvm.peekStack().isString()) {
        rvm.runtimeError("encoding must be a string");
        return rvm.dummyVal();
    }
    const fpath = rvm.peekStack(1).asString().raw;
    const encoding = rvm.peekStack(0).asString().raw.toLowerCase();
    if (!encodings.includes(encoding)) {
        rvm.runtimeError("encoding not supported");
        return rvm.dummyVal();
    }
    if (!fs.existsSync(fpath)) {
        rvm.runtimeError(`File not found. No such file: '${fpath}'`);
        return rvm.dummyVal();
    }
    const data = fs.readFileSync(fpath, {encoding, flag: "r"});
    return mod.createVMStringVal(data, rvm);
}

/*
 ****************************
 *    module setup
 ****************************
 */

exports.init = function (rvm) {
    // create the filesystem module
    const filesystem = mod.getVMStringObj("filesystem", rvm);
    const moduleObj = mod.createModuleObj(filesystem, null); // todo: fpath
    moduleObj.globals = new Map();

    // register module-level def & methods
    register.registerCustomDef(
        rvm,
        "File",
        [
            {
                methodName: "__init__",
                methodExec: file__init,
                methodArity: 2,
                defaultParamsCount: 1,
                defaults: [
                    { pos: 2, val: mod.createVMStringVal("r", rvm) },
                ],
            },
            {
                methodName: "__str__",
                methodExec: file__str,
                methodArity: 0,
            },
            {
                methodName: "close",
                methodExec: file__close,
                methodArity: 0,
            },
            {
                methodName: "read",
                methodExec: file__read,
                methodArity: 1,
                defaultParamsCount: 1,
                defaults: [
                    { pos: 1, val: mod.createVMStringVal("utf-8", rvm) },
                ],
            },
            {
                methodName: "readLines",
                methodExec: file__readLines,
                methodArity: 1,
                defaultParamsCount: 1,
                defaults: [
                    { pos: 1, val: mod.createVMStringVal("utf-8", rvm) },
                ],
            },
            {
                methodName: "write",
                methodExec: file__write,
                methodArity: 3,
                defaultParamsCount: 2,
                defaults: [
                    { pos: 2, val: mod.createVMStringVal("utf-8", rvm) },
                    { pos: 3, val: mod.createVMStringVal("w", rvm) },
                ],
            },
            {
                methodName: "writeLines",
                methodExec: file__writeLines,
                methodArity: 3,
                defaultParamsCount: 2,
                defaults: [
                    { pos: 2, val: mod.createVMStringVal("utf-8", rvm) },
                    { pos: 3, val: mod.createVMStringVal("w", rvm) },
                ],
            },
        ],
        null,
        moduleObj
    );

    // register module-level functions
    // registerCustomFunc() automatically sets this function as part of the module's globals
    register.registerCustomFunc(rvm, "read", fs__read, 2, moduleObj);
    register.registerCustomFunc(rvm, "write", fs__write, 4, moduleObj, {
        defaultParamsCount: 2,
        defaults: [
            { pos: 3, val: mod.createVMStringVal("utf-8", rvm) },
            { pos: 4, val: mod.createVMStringVal("w", rvm) },
        ],
    });
    return mod.createModuleVal(moduleObj);
};
