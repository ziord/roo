/*
 * compiler.js
 */

"use strict";

const ast = require("./ast");
const utils = require("./utils");
const { Code } = require("./code");
const gen = require("./codegen");
const vmod = require("./value");
const opcode = require("./opcode");
const opt = require("./optimizer");

const OPS = {
    [ast.OpType.OPTR_PLUS]: opcode.OP_ADD,
    [ast.OpType.OPTR_MINUS]: opcode.OP_SUBTRACT,
    [ast.OpType.OPTR_MUL]: opcode.OP_MULTIPLY,
    [ast.OpType.OPTR_DIV]: opcode.OP_DIVIDE,
    [ast.OpType.OPTR_BW_AND]: opcode.OP_BW_AND,
    [ast.OpType.OPTR_BW_OR]: opcode.OP_BW_OR,
    [ast.OpType.OPTR_BW_XOR]: opcode.OP_BW_XOR,
    [ast.OpType.OPTR_BW_LSHIFT]: opcode.OP_BW_LSHIFT,
    [ast.OpType.OPTR_BW_RSHIFT]: opcode.OP_BW_RSHIFT,
    [ast.OpType.OPTR_EQEQ]: opcode.OP_EQUAL,
    [ast.OpType.OPTR_NEQ]: opcode.OP_NOT_EQUAL,
    [ast.OpType.OPTR_GT]: opcode.OP_GREATER,
    [ast.OpType.OPTR_LT]: opcode.OP_LESS,
    [ast.OpType.OPTR_GEQ]: opcode.OP_GREATER_OR_EQUAL,
    [ast.OpType.OPTR_LEQ]: opcode.OP_LESS_OR_EQUAL,
    [ast.OpType.OPTR_MOD]: opcode.OP_MOD,
    [ast.OpType.OPTR_POW]: opcode.OP_POW,
    [ast.OpType.OPTR_POW]: opcode.OP_POW,
    [ast.OpType.OPTR_MINUS_ASSIGN]: opcode.OP_SUBTRACT,
    [ast.OpType.OPTR_PLUS_ASSIGN]: opcode.OP_ADD,
    [ast.OpType.OPTR_DIV_ASSIGN]: opcode.OP_DIVIDE,
    [ast.OpType.OPTR_MUL_ASSIGN]: opcode.OP_MULTIPLY,
    [ast.OpType.OPTR_MOD_ASSIGN]: opcode.OP_MOD,
    [ast.OpType.OPTR_BW_LSHIFT_ASSIGN]: opcode.OP_BW_LSHIFT,
    [ast.OpType.OPTR_BW_RSHIFT_ASSIGN]: opcode.OP_BW_RSHIFT,
    [ast.OpType.OPTR_BW_AND_ASSIGN]: opcode.OP_BW_AND,
    [ast.OpType.OPTR_BW_OR_ASSIGN]: opcode.OP_BW_OR,
    [ast.OpType.OPTR_BW_XOR_ASSIGN]: opcode.OP_BW_XOR,
    [ast.OpType.OPTR_POW_ASSIGN]: opcode.OP_POW,
};

class Local{
    constructor(name, scope){
        this.isInitialized = false;
        this.scope = scope;
        this.name = name;
        this.isCaptured = false;
    }
}

class Upvalue{
    constructor(index, isLocal){
        this.index = index;
        this.isLocal = isLocal;
    }
}

class Compiler extends ast.NodeVisitor {
    constructor(parser = null) {
        super();
        this.parser = parser;
        this.fn = vmod.createFunctionObj(
            "", 0,
            new Code(parser ? parser.lexer : null),
            false
        );
        this.currentScope = 0;
        this.locals = [new Local('', this.currentScope)]; // reserve slot 0
        this.currentLoop = {loopScope: -1};
        this.loopControls = [];
        this.enclosingCompiler = null; /*:Compiler*/
        this.caseVarCount = 0;  // case statement variable counts
        this.upvalues = [];
    }

    compilationError(msg, node){
        const padding = "|".padStart(6, " ");
        console.error(padding + "[Compilation Error]");
        if (this.func.code.lineGen){
            const lineNum = `${node.line.toString().padStart(4, ' ')} | `;
            const src = this.fn.code.lineGen.getSrcAtLine(node.line).trim();
            console.error(lineNum + src);
            console.error(padding + " " + msg);
        }else{
            msg = `[Line ${node.line}] ` + msg;
            console.error(padding + " " + msg);
        }
        process.exit(-1);
    }

    visitNumberNode(node) {
        const type = node.isInteger ? vmod.VAL_INT : vmod.VAL_FLOAT;
        gen.emitConstant(
            this.fn.code,
            new vmod.Value(type, node.value),
            node.line
        );
    }

    visitBooleanNode(node) {
        gen.emitByte(
            this.fn.code,
            (node.value ? opcode.OP_LOAD_TRUE : opcode.OP_LOAD_FALSE),
            node.line
        );
    }

    visitNullNode(node) {
        gen.emitByte(this.fn.code, opcode.OP_LOAD_NULL, node.line);
    }

    visitStringNode(node) {
        gen.emitConstant(
            this.fn.code,
            new vmod.Value(vmod.VAL_STRING, node.value),
            node.line
        );
    }

    visitShowNode(node) {
        node.nodes.forEach(expr => this.visit(expr));
        gen.emitBytes(this.fn.code, opcode.OP_SHOW, node.nodes.length);
    }

    visitUnaryNode(node) {
        if ((node.op === ast.OpType.OPTR_PLUS_PLUS) ||
            (node.op === ast.OpType.OPTR_MINUS_MINUS)) {
            this.compilePreOp(node);
            return;
        }
        this.visit(node.node);
        switch (node.op) {
            case ast.OpType.OPTR_PLUS:
                gen.emitByte(this.fn.code, opcode.OP_POSITIVE, node.line);
                break;
            case ast.OpType.OPTR_MINUS:
                gen.emitByte(this.fn.code, opcode.OP_NEGATE, node.line);
                break;
            case ast.OpType.OPTR_BW_INVERT:
                gen.emitByte(this.fn.code, opcode.OP_BW_INVERT, node.line);
                break;
            case ast.OpType.OPTR_NOT:
                gen.emitByte(this.fn.code, opcode.OP_NOT, node.line);
                break;
            default:
                utils.unreachable("Compiler::visitUnaryNode()");
        }
    }

    compilePreOp(unaryNode) {
        // ++x -> x = x + 1;
        // ++x[0] -> x[0] = x[0] + 1;
        const node = unaryNode.node;
        const op = unaryNode.op === ast.OpType.OPTR_PLUS_PLUS ?
            ast.OpType.OPTR_PLUS_ASSIGN : ast.OpType.OPTR_MINUS_ASSIGN;
        let assignNode;
        // rewrite the ast node
        if (node.type === ast.ASTType.AST_NODE_VAR) {
            assignNode = new ast.AssignNode(
                node, new ast.NumberNode(1, true, node.line),
                op, unaryNode.line);
            this.visit(assignNode);
        } else if (node.type === ast.ASTType.AST_NODE_INDEX_EXPR) {
            assignNode = new ast.IndexExprAssignNode(
                node, new ast.NumberNode(1, true, node.line),
                op, unaryNode.line);
            this.visit(assignNode);
        }
        // todo: DotExprAssign
    }

    compilePostOp(postfixNode){
        // x++ -> x += 1; (x - 1)
        const node = postfixNode.node;
        let code, op;
        if (postfixNode.op === ast.OpType.OPTR_PLUS_PLUS){
            code = opcode.OP_DEC;
            op = ast.OpType.OPTR_PLUS;
        }else{
            code = opcode.OP_INC;
            op = ast.OpType.OPTR_MINUS;
        }
        let assignNode;
        if (node.type === ast.ASTType.AST_NODE_VAR){
            assignNode = new ast.AssignNode(
                node, new ast.NumberNode(1, true, postfixNode.line),
                op, postfixNode.line);
            this.visit(assignNode);
            gen.emitByte(this.fn.code, code, postfixNode.line);
        }else if (node.type === ast.ASTType.AST_NODE_INDEX_EXPR){
            assignNode = new ast.IndexExprAssignNode(
                node, new ast.NumberNode(1, true, postfixNode.line),
                op, postfixNode.line);
            this.visit(assignNode);
            gen.emitByte(this.fn.code, code, postfixNode.line);
        }
        // todo: DotExprAssign
    }

    visitPostfixNode(node){
        this.compilePostOp(node);
    }

    visitBinaryNode(node) {
        this.visit(node.leftNode);
        this.visit(node.rightNode);
        const byte = OPS[node.op];
        gen.emitByte(this.fn.code, byte);
    }

    visitListNode(node) {
        node.nodes.forEach(item => this.visit(item));
        gen.emit2BytesOperand(
            this.fn.code,
            opcode.OP_BUILD_LIST,
            node.nodes.length,
            node.line
        );
    }

    visitRangeNode(node){
        this.visit(node.startNode);
        this.visit(node.endNode);
        this.visit(node.stepNode);
        gen.emitByte(this.fn.code, opcode.OP_BUILD_RANGE, node.line);
    }

    visitIndexExprNode(node){
        this.visit(node.leftExpr);
        this.visit(node.indexExpr);
        gen.emitByte(this.fn.code, opcode.OP_SUBSCRIPT, node.line);
    }

    visitExprStatementNode(node){
        this.visit(node.expr);
        gen.emitByte(this.fn.code, opcode.OP_POP, node.line);
    }

    storeName(name){
        const value = new vmod.Value(vmod.VAL_STRING, name);
        return this.fn.code.cp.writeConstant(value);
    }

    compileAssignment(node){
        // a += 2 -> a = a + 2;
        const byte = OPS[node.op];
        if (byte === undefined){ // op EQ '='
            this.visit(node.rightNode);
            return;
        }
        this.visit(node.leftNode);
        this.visit(node.rightNode);
        gen.emitByte(this.fn.code, byte);
    }

    findLocal(node /*: VarNode*/){
        /*
         *  {
         *    let x = 'fox'; ---------------> local 0 (scope 1)
         *     {
         *        let x = 'bar'; -----------> local 1 (scope 2)
         *        show x;        -----------> local 1 (scope 2)
         *     }
         *     show x;     -----------------> local 0 (scope 1)
         *  }
         */
        // check if there exists a local variable with the same name.
        // search is done from the end of the array to capture the latest
        // defined local variable first - for proper name shadowing
        for (let index = this.locals.length - 1; index >= 0; index--){
            let local = this.locals[index];
            // return index if found
            if (local.scope <= this.currentScope &&
                local.name === node.name)
                return index;
        }
        return -1;
    }

    findUpvalue(node /*: VarNode*/){
        // here, `enclosingCompiler` is symbolic to an enclosing function.
        // If there's no `enclosingCompiler`, then the variable (`name`) is
        // definitely not an upvalue.
        if (!this.enclosingCompiler) return -1;

        // check if the variable was captured from an immediate
        // enclosing function
        let index = this.enclosingCompiler.findLocal(node);
        if (index !== -1){
            // the variable/upvalue was captured in the immediate
            // enclosing function - so it's a direct local variable
            // indicate capture:
            this.enclosingCompiler.locals[index].isCaptured = true;
            // add upvalue using index, direct local:
            return this.addUpvalue(node, index, true);
        }

        // we couldn't find the upvalue in the immediate enclosing function,
        // search wider - (the enclosing function's enclosing function,
        // and so on, until there's no more enclosing function to search)
        index = this.enclosingCompiler.findUpvalue(node);
        if (index !== -1){
            // the variable/upvalue was captured in a further
            // enclosing function - so it's not a direct local variable
            return this.addUpvalue(node, index, false);
        }

        // no luck finding it
        return index;
    }

    addLocal(name /*: string*/){
        const index = this.locals.length;
        this.locals.push(new Local(name, this.currentScope));
        return index;
    }

    initLocal(name /*: string*/){
        const index = this.addLocal(name);
        this.locals[index].isInitialized = true;
        return index;
    }

    addUpvalue(node /*: VarNode*/, index, isLocal){
        // avoid adding an duplicate upvalues
        const len = this.upvalues.length;
        for (let i = 0; i < len; i++){
            if (this.upvalues[i].index === index
                && this.upvalues[i].isLocal === isLocal) {
                // reuse the upvalue if it already exists
                return i;
            }
        }
        if (len > utils.MAX_UPVALUE_COUNT){
            this.compilationError("Too many closures", node);
        }
        // store the upvalue
        this.upvalues.push(new Upvalue(index, isLocal));
        this.fn.upvalueCount++;
        return len;  // the exact index which points to the new upvalue
    }

    popLocals(popLine){
        let pops = 0;
        for (let index = this.locals.length - 1; index >= 0; index--){
            let local = this.locals[index];
            if (this.currentScope < local.scope){
                // if (local.isCaptured){
                //     // emit special instruction for locals captured
                //     // in a closure
                //     gen.emitByte(
                //         this.fn.code,
                //         opcode.OP_LIFT_UPVALUE, popLine
                //     );
                // }else{
                //     gen.emitByte(
                //         this.fn.code,
                //         opcode.OP_POP, popLine
                //     );
                // }
                gen.emitByte(
                    this.fn.code,
                    opcode.OP_POP, popLine
                );
                pops++;
            }
        }
        this.locals.length -= pops;
    }

    visitAssignNode(node){
        let index, code, fn;
        // check if it's a local
        if ((index = this.findLocal(node.leftNode)) !== -1){
            code = opcode.OP_SET_LOCAL;
            fn = gen.emit2BytesOperand;
        }
        // check if it's an upvalue
        else if ((index = this.findUpvalue(node.leftNode)) !== -1){
            // only 1 byte (256) upvalues allowable for now
            code = opcode.OP_SET_UPVALUE;
            fn = gen.emitBytes;
        }
        // might be a global
        else{
            code = opcode.OP_SET_GLOBAL;
            index = this.storeName(node.leftNode.name);
            fn = gen.emit2BytesOperand;
        }
        this.compileAssignment(node);
        fn(this.fn.code, code, index, node.line);
    }

    visitIndexExprAssignNode(node){
        this.compileAssignment(node);
        this.visit(node.leftNode);
        this.fn.code.bytes[this.fn.code.length  - 1] = opcode.OP_SET_SUBSCRIPT;
    }

    visitVarDeclNode(node){
        if (this.currentScope > 0){
            const index = this.addLocal(node.name);
            this.visit(node.value);
            this.locals[index].isInitialized = true;
            gen.emit2BytesOperand(
                this.fn.code,
                opcode.OP_DEFINE_LOCAL,
                index, node.line);
        }else{
            // store the variable name
            const index = this.storeName(node.name);
            this.visit(node.value);
            gen.emit2BytesOperand(
                this.fn.code,
                opcode.OP_DEFINE_GLOBAL,
                index, node.line);
        }
    }

    visitVarDeclListNode(node){
        node.decls.forEach(item => this.visit(item));
    }

    visitVarNode(node){
        let index;
        // check if it's a local
        if ((index = this.findLocal(node)) !== -1){
            const local = this.locals[index];
            if (!local.isInitialized){
                this.compilationError(
                    `cannot utilize uninitialized variable '${node.name}'`,
                    node);
            }
            gen.emit2BytesOperand(
                this.fn.code, opcode.OP_GET_LOCAL,
                index, node.line);
        }
        // check if it's an upvalue
        else if ((index = this.findUpvalue(node)) !== -1){
            // only 1 byte (256) upvalues allowable for now
            gen.emitBytes(
                this.fn.code, opcode.OP_GET_UPVALUE,
                index, node.line
            );
        }
        // might be a global
        else{
            index = this.storeName(node.name, node.line);
            gen.emit2BytesOperand(
                this.fn.code, opcode.OP_GET_GLOBAL,
                index, node.line);
        }
    }

    visitIStringNode(node){
        node.exprs.forEach(expr => this.visit(expr));
        gen.emit2BytesOperand(
            this.fn.code, opcode.OP_FORMAT,
            node.exprs.length, node.line);
    }

    visitAndExprNode(node){
        this.visit(node.leftNode);
        const conditionEnd = gen.emitJump(
            this.fn.code, opcode.OP_JUMP_IF_FALSE_OR_POP, node.line
        );
        this.visit(node.rightNode);
        gen.patchJump(this.fn.code, conditionEnd);
    }

    visitOrExprNode(node){
        this.visit(node.leftNode);
        const absJumpExit = gen.emitJump(
            this.fn.code, opcode.OP_JUMP_IF_FALSE, node.line
        );
        const conditionEnd = gen.emitJump(
            this.fn.code, opcode.OP_JUMP, node.line
        );
        gen.patchJump(this.fn.code, absJumpExit);
        gen.emitByte(this.fn.code, opcode.OP_POP);
        this.visit(node.rightNode);
        gen.patchJump(this.fn.code, conditionEnd);
    }

    visitIfElseNode(node) {
        this.visit(node.conditionExpr);
        // jump to the else body if condition is false
        // or pop condition result off the stack if it evaluates to true
        const elseJmp = gen.emitJump(this.fn.code, opcode.OP_JUMP_IF_FALSE_OR_POP);
        this.visit(node.ifBlock);
        // jump to end of if clause
        const endJmp = gen.emitJump(this.fn.code, opcode.OP_JUMP);
        gen.patchJump(this.fn.code, elseJmp);
        gen.emitByte(this.fn.code, opcode.OP_POP);
        if (node.elseBlock)  this.visit(node.elseBlock);
        gen.patchJump(this.fn.code, endJmp);
    }

    prepareLoop(loopName){
        const currLoop = this.currentLoop;
        const loopScope = this.currentScope;
        this.currentLoop = {loopScope, loopName};
        return currLoop;
    }

    visitWhileLoopNode(node){
        const prevLoop = this.prepareLoop('while');
        // we're using length directly and not offsetting it by 1
        // (i.e. length -1) since we need to jump back to exactly where the
        // condition expression bytecode begins.
        const loopPoint = this.fn.code.length;
        this.visit(node.conditionExpr);
        // jump to the end of the loop if condition is false
        // or pop condition result off the stack if it evaluates to true
        const exitJmp = gen.emitJump(this.fn.code, opcode.OP_JUMP_IF_FALSE_OR_POP);
        this.visit(node.block);
        gen.emitLoop(this.fn.code, loopPoint);
        gen.patchJump(this.fn.code, exitJmp);
        // pop condition result off the stack <- resulting from a jump from
        // the loop condition
        gen.emitByte(this.fn.code, opcode.OP_POP);
        // check for loop controls (break/continue)
        this.processLoopControl(loopPoint);
        this.currentLoop = prevLoop;
    }

    visitDoWhileLoopNode(node) {
        const prevLoop = this.prepareLoop('doWhile');

        const beginLoop = this.fn.code.length;
        this.visit(node.block);
        const loopPoint = this.fn.code.length;
        this.visit(node.conditionExpr);

        const exitJmp = gen.emitJump(this.fn.code, opcode.OP_JUMP_IF_FALSE_OR_POP);
        gen.emitLoop(this.fn.code, beginLoop);
        gen.patchJump(this.fn.code, exitJmp);

        gen.emitByte(this.fn.code, opcode.OP_POP);
        this.processLoopControl(loopPoint);
        this.currentLoop = prevLoop;
    }

    visitForLoopNode(node){
        /*
         *  for (
         *       init ? ;
         *       condition ? ;
         *       increment ? ;
         *      )
         */
        // for init declaration needs to be in a new scope
        this.currentScope++;
        const prevLoop = this.prepareLoop('for');
        let bodyJmp = null, incrJmp = null;
        if (node.initExpr){
            this.visit(node.initExpr);
        }
        let loopPoint = this.fn.code.length;
        if (node.conditionExpr){
            this.visit(node.conditionExpr);
            bodyJmp = gen.emitJump(this.fn.code, opcode.OP_JUMP_IF_FALSE_OR_POP);
        }
        if (node.incrExpr){
            incrJmp = gen.emitJump(this.fn.code, opcode.OP_JUMP);
            let tmp = this.fn.code.length;
            this.visit(node.incrExpr);
            gen.emitByte(this.fn.code, opcode.OP_POP);
            gen.emitLoop(this.fn.code, loopPoint);
            loopPoint = tmp;
            gen.patchJump(this.fn.code, incrJmp);
        }
        this.visit(node.block);
        gen.emitLoop(this.fn.code, loopPoint);
        if (bodyJmp !== null){
            gen.patchJump(this.fn.code, bodyJmp);
            gen.emitByte(this.fn.code, opcode.OP_POP);
        }
        this.processLoopControl(loopPoint);
        this.currentScope--;
        // pop initExpr locals if any
        if (node.initExpr){
            // this.popLocals(null);
            if (node.initExpr.type === ast.ASTType.AST_NODE_VAR_DECL){
                this.popLocals(null);
            }else{
                // todo: thoroughly confirm if this wouldn't cause a problem
                const localsCount = node.initExpr.decls.length;
                gen.emit2BytesOperand(this.fn.code, opcode.OP_POP_N, localsCount);
                this.locals.length -= localsCount;
            }
        }
        this.currentLoop = prevLoop;
    }

    visitUnboundedLoopNode(node){
        const prevLoop = this.prepareLoop('unbounded');
        const loopPoint = this.fn.code.length;
        this.visit(node.block);
        gen.emitLoop(this.fn.code, loopPoint);
        this.processLoopControl(loopPoint);
        this.currentLoop = prevLoop;
    }

    assertJumpOffset(offset, controlNode){
        if (offset > utils.UINT16_MAX){
            this.compilationError(
                "code body too large to jump over",
                controlNode
            );
        }
    }

    compileLoopControl(control, continuePoint, breakEnd){
        const slot = control.patchSlot;
        if (control.isBreak){
            // slot + 1 + 1 + beginning of next instruction
            const breakOffset = breakEnd - (slot + 3);
            this.assertJumpOffset(breakOffset, control);
            // 3 bytes long -> slot + 1 + 1
            this.fn.code.bytes[slot] = opcode.OP_JUMP;
            this.fn.code.bytes[slot + 1] = (breakOffset >> 8) & 0xff;
            this.fn.code.bytes[slot + 2] = breakOffset  & 0xff;
        }else{ // continue
            // before the 'continue' instruction
            // slot + 1 + 1 + beginning of next instruction
            let continueOffset, bytecode;
            if (control.loopName !== 'doWhile'){
                continueOffset = (slot + 3) - continuePoint;
                bytecode = opcode.OP_LOOP;
            }else{
                continueOffset = continuePoint - (slot + 3);
                bytecode = opcode.OP_JUMP;
            }
            this.assertJumpOffset(continueOffset, control);
            this.fn.code.bytes[slot] = bytecode;
            this.fn.code.bytes[slot + 1] = (continueOffset >> 8) & 0xff;
            this.fn.code.bytes[slot + 2] = continueOffset  & 0xff;
        }
    }

    processLoopControl(continuePoint){
        let breakEnd = this.fn.code.length;
        this.loopControls.forEach(control => {
            this.compileLoopControl(
                control, continuePoint, breakEnd
            );
        });
        this.loopControls = [];
    }

    visitControlNode(node){
        const localsLength = this.locals.filter(
            local => local.scope > this.currentLoop.loopScope).length;
        node.loopName = this.currentLoop.loopName;
        node.localsCount = localsLength;
        // we need to pop the locals created in the loop up to the point the
        // control was added
        if (localsLength){
            gen.emit2BytesOperand(
                this.fn.code, opcode.OP_POP_N, localsLength, node.line
            );
        }
        // store the current slot (the beginning of where the break/continue
        // instructions would be rewritten) for later rewrite
        node.patchSlot = this.fn.code.length;
        // store 3 fake bytes to cover for the loop/jump instructions
        gen.emitJump(this.fn.code, 0xff, node.line);
        // store the control for later rewrite
        this.loopControls.push(node);
    }

    visitBlockNode(node){
        this.currentScope++;
        node.decls.forEach(item => this.visit(item));
        this.currentScope--;
        this.popLocals(node.blockEnd);
    }

    transformConditionedOfNode(arm, name){
        // arm: OfNode
        const ifNode = new ast.IfElseNode();
        const varNode  = new ast.VarNode(name, arm.line);
        ifNode.conditionExpr = arm.conditions.reduce((left, right) => {
            if (left === null){
                return new ast.BinaryNode(
                    varNode, right, ast.OpType.OPTR_EQEQ
                );
            }
            const nodeLeft = left;
            const nodeRight = new ast.BinaryNode(
                varNode, right,  ast.OpType.OPTR_EQEQ
            );
            return new ast.OrExprNode(nodeLeft, nodeRight);
        }, null);
        ifNode.ifBlock = arm.block;
        return ifNode;
    }

    transformConditionedCaseNode(caseNode){
        /*
         * case x {
         *   of x, y, z -> stuff,
         *   of * -> ruff
         * }
         * |_> $ = x  // in order to evaluate 'x' only once.
         *     if ($ == x || $ == y || $ == z) {stuff}
         *     else {ruff}
         * case {
         *   of x % 5 > 3 -> 5
         * }
         * |_> if (x % 5 > 3) {5}
         */
        if (!caseNode.conditionExpr){
            return this.transformRegularCaseNode(caseNode);
        }
        const declNode = new ast.VarDeclNode(
            `$var${this.caseVarCount++}`,
            caseNode.conditionExpr, caseNode.line
        );
        const ifElseNode = new ast.IfElseNode();
        // we know that there would always be a star arm, because the parser
        // ensures this.
        const starArm = caseNode.arms.pop();
        const lastIfNode = caseNode.arms.reduce((node, rightArm) => {
            node.elseBlock = this.transformConditionedOfNode(rightArm, declNode.name);
            return node.elseBlock;
        }, ifElseNode);
        // set the 'else' of the last IfElseNode to the block of the star arm:
        // of * -> ruff; --> else ruff;
        lastIfNode.elseBlock = starArm.block;
        // the actual complete IfElseNode begins from the else block of `ifElseNode`
        // - which was the first IfElseNode node passed to arms.reduce.
        // see reduce() above.
        const actualIfElseNode = ifElseNode.elseBlock;
        return {declNode, ifElseNode: actualIfElseNode};
    }

    transformRegularOfNode(ofNode) {
        const ifNode = new ast.IfElseNode();
        // here we use the nodes in the ofNode's arms directly.
        ifNode.conditionExpr = ofNode.conditions.reduce((left, right) => {
            // if left is null, then only one node (arm) exists in the
            // ofNode's arms, thus, return that node
            if (left === null) return right;
            // use the nodes directly, since they are generally conditions
            return new ast.OrExprNode(left, right);
        }, null);
        ifNode.ifBlock = ofNode.block;
        return ifNode;
    }

    transformRegularCaseNode(caseNode) {
        /*
         * case {
         *   of x % 5 > 3 -> 5
         * }
         * |_> if (x % 5 > 3) {5}
         */
        const ifElseNode = new ast.IfElseNode();
        const starArm = caseNode.arms.pop();
        const lastIfNode = caseNode.arms.reduce((node, rightArm) => {
            node.elseBlock = this.transformRegularOfNode(rightArm);
            return node.elseBlock;
        }, ifElseNode);
        lastIfNode.elseBlock = starArm.block;
        const actualIfElseNode = ifElseNode.elseBlock;
        return {declNode: null, ifElseNode: actualIfElseNode};
    }

    visitCaseNode(node){
        const {declNode, ifElseNode} = this.transformConditionedCaseNode(node);
        declNode ? this.visit(declNode) : void 0;
        this.visit(ifElseNode);
    }

    visitDictNode(node){
        node.entries.forEach(([keyNode, valueNode]) => {
            this.visit(keyNode);
            this.visit(valueNode);
        });
        gen.emit2BytesOperand(
            this.fn.code, opcode.OP_BUILD_DICT,
            node.entries.length
        );
    }

    defineVariable(name /*string*/){
        if (this.currentScope > 0){
            return [this.initLocal(name), true];
        }else{
            return  [this.storeName(name), false];
        }
    }

    visitReturnNode(node){
        this.visit(node.expr);
        gen.emitByte(this.fn.code, opcode.OP_RETURN, node.line);
    }

    visitFunctionNode(node){
        /*
         * fn foo(){
         *    show 28;
         * }
         * let foo = () => {...}
         */
        let compiler = new Compiler(this.parser);
        compiler.enclosingCompiler = this;
        let index, isLocal;
        compiler.fn.isLambda = node.isLambda;
        if (!node.isLambda){
            [index, isLocal] = this.defineVariable(node.name);
            compiler.fn.name = node.name;
        }else{
            compiler.fn.name = "<lambda>";
        }
        // compile params
        compiler.currentScope++;  // params are always local
        node.params.forEach(param => {  // VarNode
           const slot = compiler.initLocal(param.name);
           gen.emit2BytesOperand(
               compiler.fn.code,
               opcode.OP_DEFINE_LOCAL,
               slot, param.line
           );
        });
        compiler.fn.arity = node.params.length;
        // compile fn's body
        node.block.decls.forEach(item => compiler.visit(item));
        // no need to pop locals since return balances the stack effect
        gen.emitConstant(this.fn.code,
            new vmod.Value(vmod.VAL_FUNCTION, compiler.fn),
            node.line, opcode.OP_CLOSURE);
        // emit instructions for processing closures captured in `compiler`
        // during its compilation process:
        for (let i = 0; i < compiler.upvalues.length; i++){
            // emit: index | isLocal
            const upvalue = compiler.upvalues[i];
            gen.emitBytes(this.fn.code, upvalue.index, upvalue.isLocal);
        }
        // emit definition instruction only for non-lambda functions
        if (index !== undefined){
            gen.emit2BytesOperand(
                this.fn.code,
                (isLocal ? opcode.OP_DEFINE_LOCAL : opcode.OP_DEFINE_GLOBAL),
                index, node.line
            );
        }
    }

    visitCallNode(node){
        this.visit(node.leftNode);
        node.args.forEach(arg => this.visit(arg));
        gen.emitBytes(this.fn.code, opcode.OP_CALL, node.args.length, node.line);
    }

    visitProgramNode(node){
        node.decls.forEach(decl => this.visit(decl));
    }

    compile(node) {
        // todo: optimization 
        // let optimizer = new opt.ConstantFolder(node, this.parser);
        // node = optimizer.fold();
        // console.log(node);
        this.visit(node);
        gen.emitByte(this.fn.code, opcode.OP_RETURN);
        return this.fn;
    }
}

module.exports = { Compiler };