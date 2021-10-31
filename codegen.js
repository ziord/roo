/*
 * codegen.js
 */

"use strict";

const opcode = require("./opcode");
const {UINT16_MAX, error} = require("./utils");

function getLineNumber(codeObj){
    if (codeObj.lines.length){
        return codeObj.lines[codeObj.lines.length - 1];
    }
    return 1;
}

function emitByte(codeObj, byte, lineNum=null){
    codeObj.writeByte(byte, lineNum || getLineNumber(codeObj));
}

function emitBytes(codeObj, byte1, byte2, lineNum=null){
    codeObj.writeBytes(byte1, byte2, lineNum || getLineNumber(codeObj));
}

// emit a byte and its operand (operand must be 2 bytes long)
function emit2BytesOperand(codeObj, byte, operand, lineNum=null) {
    emitByte(codeObj, byte, lineNum);
    emitBytes(codeObj, ((operand >> 8) & 0xff), (operand & 0xff), lineNum);
}

function emitConstant(codeObj, value, lineNum=null, opc=null){
    const index = codeObj.cp.writeConstant(value);
    emit2BytesOperand(codeObj, opc || opcode.OP_LOAD_CONST, index, lineNum);
}

function emitJump(codeObj, byte, lineNum=null){
    emitByte(codeObj, byte, lineNum);
    // `jumpOffsetSlot` is the beginning of where the jump offset will be
    // written i.e. the starting index at which the jump offset will be stored.
    const jumpOffsetSlot = codeObj.length;
    // use a fake jump offset for now.
    emitBytes(codeObj, 0xff, 0xff, lineNum);
    return jumpOffsetSlot;
}

function patchJump(codeObj, jumpOffsetSlot){
    // a b [c] [d] e f g.  |-> (codeObj.length - 1) - (jumpOffsetSlot + 1)
    const actualJumpOffset = codeObj.length - (jumpOffsetSlot + 2);
    if (actualJumpOffset > UINT16_MAX){
        // todo: good error reporting
        error("code body too large to jump over");
    }
    codeObj.bytes[jumpOffsetSlot] = ((actualJumpOffset >> 8) & 0xff);
    codeObj.bytes[jumpOffsetSlot + 1] = actualJumpOffset & 0xff;
}

function emitLoop(codeObj, loopPoint, lineNum=null){
    // +3 for the opcode and its 2 bytes operand
    const actualJumpOffset = codeObj.length - loopPoint + 3;
    if (actualJumpOffset > UINT16_MAX){
        // todo: good error reporting
        error("code body too large to loop over");
    }
    emit2BytesOperand(codeObj, opcode.OP_LOOP, actualJumpOffset, lineNum);
}

module.exports = {
    emitByte, emitBytes, emit2BytesOperand, emitConstant,
    emitJump, patchJump, emitLoop
};
