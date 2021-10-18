const fs = require("fs");
const { VM } = require("./vm");
const { Disassembler } = require("./debug");
const { parseSourceInternal } = require("./parser");
const { Compiler } = require("./compiler");


function compileSourceCode(src){
    let [root, parser] = parseSourceInternal(src);
    let compiler = new Compiler(parser);
    return compiler.compile(root);
}

function runSourceCode(src){
    const fnObj = compileSourceCode(src);
    const vm = new VM(fnObj, false);
    vm.run();
}

function disSourceCode(src){
    const fnObj = compileSourceCode(src);
    const dis = new Disassembler(fnObj, true);
    dis.disassembleCode();
}

function printHelp(){
    // todo: improve
    const help = `
usage: node roo.js [FN] [-h] [-d] [-rs] [-ds]

    optional arguments:
       FN  file name
      -h   show this help message and exit
      -rs  [run source] flag
      -ds  [disassemble source] flag
      -d   [disassemble] flag

    *> To launch the REPL interpreter:
        node roo.js
    *> To interpret a file:
        node roo.js filename.roo 
    *> To disassemble a file:
        node roo.js -d filename.roo
    *> To interpret a source string:
        node roo.js -rs 'source string'
    *> To disassemble a source string:
        node roo.js -ds 'source string'
    *> To get help:
        node roo.js -h
`;
    console.log(help);
}


function tryRunREPL() {
    // todo: repl console
    // >> x * 5;
}

function tryRunFile(cliArgs) {
    const fileName = cliArgs[2];
    if (fileName === '-h'){
        printHelp();
        return;
    }
    if (!fs.existsSync(fileName)) {
        console.error(`Error: File not found '${fileName}'`);
        return -1;
    }
    const src = fs.readFileSync(fileName).toString();
    runSourceCode(src);
}

function tryRunSrc(cliArgs){
    /* 
     * node roo.js -d fileName.roo  [dis file]
     * node roo.js -rs src          [run from string]
     * node roo.js -ds src          [dis from string]
     */
    const arg = cliArgs[3];
    if (cliArgs[2] === "-d"){
        const src = fs.readFileSync(arg).toString();
        disSourceCode(src);
    }else if (cliArgs[2] === "-rs"){
        runSourceCode(arg);
    }else if (cliArgs[2] === "-ds"){
        disSourceCode(arg);
    }else {
        printHelp();
        return -1;
    }
}


const args = process.argv;

switch (args.length) {
    /*
     * node roo.j
     * node roo.js -h               [help]
     * node roo.js fileName.roo     [run file]
     * node roo.js -d fileName.roo  [dis file]
     * node roo.js -rs src          [run from string]
     * node roo.js -ds src          [dis from string]
     */
    
    case 2:
        tryRunREPL();
        break;
    case 3:
        tryRunFile(args);
        break;
    case 4:
        tryRunSrc(args);
        break;
    default:
        printHelp();
}

module.exports = {tryRunFile, tryRunREPL, tryRunSrc};