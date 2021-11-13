/*
 * code.js
 *
 */

"use strict";

const {assert, ConstantPool} = require("./value");

function Code(lineGen=null) {
    this.length = 0;
    this.capacity = 0;
    this.lines = [];
    this.bytes = null;
    this.srcLines = [];
    this.lineGen = lineGen;
    this.cp = new ConstantPool();
}

Code.prototype.growBuffer = function () {
    const newCap = this.capacity < 8 ? 8 : this.capacity << 1;
    const tmpBuff = new Uint8Array(newCap);
    if (this.bytes) {
        this.bytes.forEach((byte, index) => (tmpBuff[index] = byte));
        this.bytes = null;
    }
    this.bytes = tmpBuff;
    this.capacity = newCap;
};

Code.prototype.writeByte = function (byte, line) {
    assert(
        byte !== undefined && line !== undefined,
        "Code::writeByte()::Byte and line must be passed"
    );
    if (this.length >= this.capacity) {
        this.growBuffer();
    }
    this.bytes[this.length++] = byte;
    this.lines.push(line);
    if (!this.lineGen) return;
    if (this.lines[this.lines.length - 2] !==
        this.lines[this.lines.length - 1])
    {
        const srcAtLine = this.lineGen.getSrcAtLine(line);
        this.srcLines.push(srcAtLine);
    }else{
        this.srcLines.push(0xff);
    }
};

Code.prototype.writeBytes = function (first, second, line) {
    this.writeByte(first, line);
    this.writeByte(second, line);
};

Code.prototype.resetBy = function (count) {
    this.length ? this.length -= count : void 0;
    (this.srcLines.length >= count)
        ? this.srcLines.length -= count
        : void 0;
    (this.lines.length >= count)
        ? this.lines.length -= count
        : void 0;
};

module.exports = {Code};
