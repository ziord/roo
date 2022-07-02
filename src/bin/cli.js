#! /usr/bin/env node

"use strict";

const roo = require("./roo");
const args = process.argv;

switch (args.length) {
  /*
   * roo
   * roo -h               [help]
   * roo fileName.roo     [run file]
   * roo -d fileName.roo  [dis file]
   * roo -rs src          [run from string]
   * roo -ds src          [dis from string]
   */

  case 2:
    roo.tryRunREPL();
    break;
  case 3:
    roo.tryRunFile(args);
    break;
  case 4:
    roo.tryRunSrc(args);
    break;
  default:
    roo.printHelp();
}
