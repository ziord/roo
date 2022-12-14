"use strict";

const fs = require("fs");
const vmApi = require("../vm/api");
const { repl } = require("./repl");

const ROO_VERSION = "0.1.4";

function printHelp() {
  const help = `
usage: roo [FN] [-h] [-d] [-rs] [-ds]

    optional arguments:
       FN  file name
      -h   show this help message and exit
      -rs  [run source] flag
      -ds  [disassemble source] flag
      -d   [disassemble] flag

    *> To launch the REPL interpreter:
        roo
    *> To interpret a file:
        roo filename.rk 
    *> To disassemble a file:
        roo -d filename.rk
    *> To interpret a source string:
        roo -rs 'source string'
    *> To disassemble a source string:
        roo -ds 'source string'
    *> To get this help message:
        roo -h
`;
  console.log(help);
}

function tryRunREPL() {
  repl(ROO_VERSION);
}

function tryRunFile(cliArgs) {
  const fileName = cliArgs[2];
  if (fileName === "-h") {
    printHelp();
    return;
  }
  if (!fs.existsSync(fileName)) {
    console.error(`Error: File not found '${fileName}'`);
    return -1;
  }
  const src = fs.readFileSync(fileName).toString();
  return vmApi.runSourceCode(src, fileName);
}

function tryDisFile(arg) {
  if (!fs.existsSync(arg)) {
    console.error(`Error: File not found '${arg}'`);
    return -1;
  }
  const src = fs.readFileSync(arg).toString();
  vmApi.disSourceCode(src, arg);
}

function tryRunSrc(cliArgs) {
  /*
   * roo -d fileName.rk  [dis file]
   * roo -rs src          [run from string]
   * roo -ds src          [dis from string]
   */
  const arg = cliArgs[3];
  if (cliArgs[2] === "-d") {
    tryDisFile(arg);
  } else if (cliArgs[2] === "-rs") {
    vmApi.runSourceCode(arg);
  } else if (cliArgs[2] === "-ds") {
    vmApi.disSourceCode(arg);
  } else {
    printHelp();
    return -1;
  }
}

module.exports = { printHelp, tryRunFile, tryRunREPL, tryRunSrc, ROO_VERSION };
