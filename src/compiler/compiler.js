/*
 * compiler.js
 */

"use strict";

const ast = require("../parser/ast");
const utils = require("../utils");
const { Code } = require("../code/code");
const gen = require("./codegen");
const vmod = require("../constant/value");
const opcode = require("../code/opcode");
const opt = require("./optimizer");

const OPS = {
    [ast.OpType.OPTR_PLUS]: opcode.$ADD,
    [ast.OpType.OPTR_MINUS]: opcode.$SUBTRACT,
    [ast.OpType.OPTR_MUL]: opcode.$MULTIPLY,
    [ast.OpType.OPTR_DIV]: opcode.$DIVIDE,
    [ast.OpType.OPTR_BW_AND]: opcode.$BW_AND,
    [ast.OpType.OPTR_BW_OR]: opcode.$BW_OR,
    [ast.OpType.OPTR_BW_XOR]: opcode.$BW_XOR,
    [ast.OpType.OPTR_BW_LSHIFT]: opcode.$BW_LSHIFT,
    [ast.OpType.OPTR_BW_RSHIFT]: opcode.$BW_RSHIFT,
    [ast.OpType.OPTR_EQEQ]: opcode.$EQUAL,
    [ast.OpType.OPTR_NEQ]: opcode.$NOT_EQUAL,
    [ast.OpType.OPTR_GT]: opcode.$GREATER,
    [ast.OpType.OPTR_LT]: opcode.$LESS,
    [ast.OpType.OPTR_GEQ]: opcode.$GREATER_OR_EQUAL,
    [ast.OpType.OPTR_LEQ]: opcode.$LESS_OR_EQUAL,
    [ast.OpType.OPTR_MOD]: opcode.$MOD,
    [ast.OpType.OPTR_POW]: opcode.$POW,
    [ast.OpType.OPTR_POW]: opcode.$POW,
    [ast.OpType.OPTR_INSTOF]: opcode.$INSTOF,
    [ast.OpType.OPTR_MINUS_ASSIGN]: opcode.$SUBTRACT,
    [ast.OpType.OPTR_PLUS_ASSIGN]: opcode.$ADD,
    [ast.OpType.OPTR_DIV_ASSIGN]: opcode.$DIVIDE,
    [ast.OpType.OPTR_MUL_ASSIGN]: opcode.$MULTIPLY,
    [ast.OpType.OPTR_MOD_ASSIGN]: opcode.$MOD,
    [ast.OpType.OPTR_BW_LSHIFT_ASSIGN]: opcode.$BW_LSHIFT,
    [ast.OpType.OPTR_BW_RSHIFT_ASSIGN]: opcode.$BW_RSHIFT,
    [ast.OpType.OPTR_BW_AND_ASSIGN]: opcode.$BW_AND,
    [ast.OpType.OPTR_BW_OR_ASSIGN]: opcode.$BW_OR,
    [ast.OpType.OPTR_BW_XOR_ASSIGN]: opcode.$BW_XOR,
    [ast.OpType.OPTR_POW_ASSIGN]: opcode.$POW,
};

class Local {
    constructor(name, scope) {
        this.isInitialized = false;
        this.scope = scope;
        this.name = name;
        this.isCaptured = false;
    }
}

class Upvalue {
    constructor(index, isLocal) {
        this.index = index;
        this.isLocal = isLocal;
    }
}

class Compiler extends ast.NodeVisitor {
    constructor(
        parser = null,
        module = null,
        fnType = ast.FnTypes.TYPE_SCRIPT
    ) {
        super();
        this.parser = parser;
        this.filepath = parser ? parser.getFilePath() : null;
        // current module
        this.module = module || vmod.createModuleObj(null, this.filepath);
        this.fn = vmod.createFunctionObj(
            "",
            0,
            new Code(parser ? parser.lexer : null),
            false,
            null,
            this.module
        );
        this.currentScope = 0;
        // the current function type:
        this.fnType = fnType;
        // reserve slot 0:
        this.locals = [this.getCompilerLocal()];
        this.currentLoop = { loopScope: -1 };
        this.loopControls = [];
        // Compiler:
        this.enclosingCompiler = null;
        // number of free variables currently present
        this.freeVars = 0;
        this.upvalues = [];
        // interned strings
        this.strings = null;
        // has error?
        this.hasError = false;
    }

    getCompilerLocal() {
        /*for the reservation of slot 0 of the compiler's `locals` Array*/
        if (this.fnType === ast.FnTypes.TYPE_METHOD) {
            /*
             * if the current function is a method, then
             * set `ref` as the local at index 0 (first local)
             * to be captured when referenced in the method's body.
             * this will be specially aligned in the vm.
             */
            const local = new Local("ref", this.currentScope);
            local.isInitialized = true;
            return local;
        } else {
            /* else, just reserve slot/index 0, to be used for something else
               in the vm. */
            return new Local("", this.currentScope);
        }
    }

    getFreeVar(name) {
        return `$var_${name}${this.freeVars++}`;
    }

    compilationError(msg, node) {
        // todo
        this.hasError = true;
        const padding = "|".padStart(6, " ");
        console.error(padding + "[Compilation Error]");
        if (this.fn.code.lineGen) {
            const lineNum = `${node.line.toString().padStart(4, " ")} | `;
            const src = this.fn.code.lineGen.getSrcAtLine(node.line).trim();
            console.error(lineNum + src);
            console.error(padding + " " + msg);
        } else {
            msg = `[Line ${node.line}] ` + msg;
            console.error(padding + " " + msg);
        }
        let tmp = this.enclosingCompiler;
        while (tmp) {
            tmp.hasError = true;
            tmp = tmp.enclosingCompiler;
        }
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
            node.value ? opcode.$LOAD_TRUE : opcode.$LOAD_FALSE,
            node.line
        );
    }

    visitNullNode(node) {
        gen.emitByte(this.fn.code, opcode.$LOAD_NULL, node.line);
    }

    visitStringNode(node) {
        gen.emitConstant(
            this.fn.code,
            new vmod.createStringVal(node.value, this.strings),
            node.line
        );
    }

    visitShowNode(node) {
        node.nodes.forEach((expr) => this.visit(expr));
        gen.emitBytes(
            this.fn.code,
            opcode.$SHOW,
            node.nodes.length,
            node.line
        );
    }

    visitUnaryNode(node) {
        if (
            node.op === ast.OpType.OPTR_PLUS_PLUS ||
            node.op === ast.OpType.OPTR_MINUS_MINUS
        ) {
            this.compilePreOp(node);
            return;
        }
        this.visit(node.node);
        switch (node.op) {
            case ast.OpType.OPTR_PLUS:
                gen.emitByte(this.fn.code, opcode.$POSITIVE, node.line);
                break;
            case ast.OpType.OPTR_MINUS:
                gen.emitByte(this.fn.code, opcode.$NEGATE, node.line);
                break;
            case ast.OpType.OPTR_BW_INVERT:
                gen.emitByte(this.fn.code, opcode.$BW_INVERT, node.line);
                break;
            case ast.OpType.OPTR_NOT:
                gen.emitByte(this.fn.code, opcode.$NOT, node.line);
                break;
            default:
                utils.unreachable("Compiler::visitUnaryNode()");
        }
    }

    compilePreOp(unaryNode) {
        // ++x -> x = x + 1;
        // ++x[0] -> x[0] = x[0] + 1;
        const node = unaryNode.node;
        const op =
            unaryNode.op === ast.OpType.OPTR_PLUS_PLUS
                ? ast.OpType.OPTR_PLUS_ASSIGN
                : ast.OpType.OPTR_MINUS_ASSIGN;
        // rewrite the ast node
        const assignNode = new ast.AssignNode(
            node,
            new ast.NumberNode(1, true, node.line),
            op,
            unaryNode.line
        );
        this.visit(assignNode);
    }

    compilePostOp(postfixNode) {
        // x++ -> x += 1; (x - 1)
        const node = postfixNode.node;
        let code, op;
        if (postfixNode.op === ast.OpType.OPTR_PLUS_PLUS) {
            code = opcode.$DEC;
            op = ast.OpType.OPTR_PLUS;
        } else {
            code = opcode.$INC;
            op = ast.OpType.OPTR_MINUS;
        }
        const assignNode = new ast.AssignNode(
            node,
            new ast.NumberNode(1, true, postfixNode.line),
            op,
            postfixNode.line
        );
        this.visit(assignNode);
        gen.emitByte(this.fn.code, code, postfixNode.line);
    }

    visitPostfixNode(node) {
        this.compilePostOp(node);
    }

    visitBinaryNode(node) {
        this.visit(node.leftNode);
        this.visit(node.rightNode);
        const byte = OPS[node.op];
        gen.emitByte(this.fn.code, byte);
    }

    visitListNode(node) {
        node.nodes.forEach((item) => this.visit(item));
        gen.emit2BytesOperand(
            this.fn.code,
            (node.hasSpread ? opcode.$BUILD_LIST_UNPACK : opcode.$BUILD_LIST),
            node.nodes.length,
            node.line
        );
    }

    visitRangeNode(node) {
        this.visit(node.startNode);
        this.visit(node.endNode);
        this.visit(node.stepNode);
        gen.emitByte(this.fn.code, opcode.$BUILD_RANGE, node.line);
    }

    visitIndexExprNode(node) {
        this.visit(node.leftExpr);
        this.visit(node.indexExpr);
        gen.emitByte(this.fn.code, opcode.$SUBSCRIPT, node.line);
    }

    visitExprStatementNode(node) {
        this.visit(node.expr);
        gen.emitByte(this.fn.code, opcode.$POP, node.line);
    }

    storeString(string) {
        const value = new vmod.createStringVal(string, this.strings);
        return this.fn.code.cp.writeConstant(value);
    }

    findLocal(node /*: VarNode*/) {
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
        for (let index = this.locals.length - 1; index >= 0; index--) {
            let local = this.locals[index];
            // return index if found
            if (local.scope <= this.currentScope && local.name === node.name)
                return index;
        }
        return -1;
    }

    findUpvalue(node /*: VarNode*/) {
        // here, `enclosingCompiler` is symbolic to an enclosing function.
        // If there's no `enclosingCompiler`, then the variable (`name`) is
        // definitely not an upvalue.
        if (!this.enclosingCompiler) return -1;

        // check if the variable was captured from an immediate
        // enclosing function
        let index = this.enclosingCompiler.findLocal(node);
        if (index !== -1) {
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
        if (index !== -1) {
            // the variable/upvalue was captured in a further
            // enclosing function - so it's not a direct local variable
            return this.addUpvalue(node, index, false);
        }

        // no luck finding it
        return index;
    }

    addLocal(name /*: string*/) {
        const index = this.locals.length;
        this.locals.push(new Local(name, this.currentScope));
        return index;
    }

    initLocal(name /*: string*/) {
        const index = this.addLocal(name);
        this.locals[index].isInitialized = true;
        return index;
    }

    addUpvalue(node /*: VarNode*/, index, isLocal) {
        // avoid adding an duplicate upvalues
        const len = this.upvalues.length;
        for (let i = 0; i < len; i++) {
            if (
                this.upvalues[i].index === index &&
                this.upvalues[i].isLocal === isLocal
            ) {
                // reuse the upvalue if it already exists
                return i;
            }
        }
        if (len > utils.MAX_UPVALUE_COUNT) {
            this.compilationError("Too many closures", node);
            return -1;
        }
        // store the upvalue
        this.upvalues.push(new Upvalue(index, isLocal));
        this.fn.upvalueCount++;
        return len; // the exact index which points to the new upvalue
    }

    popLocals(popLine) {
        let pops = 0;
        for (let index = this.locals.length - 1; index >= 0; index--) {
            let local = this.locals[index];
            if (this.currentScope < local.scope) {
                pops++;
            }
        }
        // are there any locals to be popped off?
        if (pops) {
            gen.emit2BytesOperand(this.fn.code, opcode.$POP_N, pops, popLine);
            this.locals.length -= pops;
        }
    }

    compileAssignment(node) {
        // a += 2 -> a = a + 2;
        const byte = OPS[node.op];
        if (byte === undefined) {
            // op EQ '='
            this.visit(node.rightNode);
            return;
        }
        this.visit(node.leftNode);
        this.visit(node.rightNode);
        gen.emitByte(this.fn.code, byte);
    }

    compileIndexExprAssign(node) {
        this.compileAssignment(node);
        this.visit(node.leftNode);
        this.fn.code.bytes[this.fn.code.length - 1] = opcode.$SET_SUBSCRIPT;
    }

    compileDotExprAssign(node) {
        this.compileAssignment(node);
        this.visit(node.leftNode);
        /*
         * op_get_property is the last instruction written, and it's
         * stored at [this.fn.code.length  - 3] since it has a 2 byte operand
         * i.e. op_get_property | prop_index (2 bytes)
         * thus, we reset it at this index, to reflect the correct instruction
         * for this expression
         */
        this.fn.code.bytes[this.fn.code.length - 3] = opcode.$SET_PROPERTY;
    }

    compileVarAssign(node) {
        let index, code, fn;
        // check if it's a local
        if ((index = this.findLocal(node.leftNode)) !== -1) {
            code = opcode.$SET_LOCAL;
            fn = gen.emit2BytesOperand;
        }
        // check if it's an upvalue
        else if ((index = this.findUpvalue(node.leftNode)) !== -1) {
            // only 1 byte (256) upvalues allowable for now
            code = opcode.$SET_UPVALUE;
            fn = gen.emitBytes;
        }
        // might be a global
        else {
            code = opcode.$SET_GLOBAL;
            index = this.storeString(node.leftNode.name);
            fn = gen.emit2BytesOperand;
        }
        this.compileAssignment(node);
        fn(this.fn.code, code, index, node.line);
    }

    visitAssignNode(node) {
        if (node.leftNode.type === ast.ASTType.AST_NODE_VAR) {
            this.compileVarAssign(node);
        } else if (node.leftNode.type === ast.ASTType.AST_NODE_INDEX_EXPR) {
            this.compileIndexExprAssign(node);
        } else if (node.leftNode.type === ast.ASTType.AST_NODE_DOT_EXPR) {
            this.compileDotExprAssign(node);
        } else {
            this.compilationError(`Invalid assignment target`, node);
        }
    }

    visitVarDeclNode(node) {
        if (this.currentScope > 0) {
            const index = this.addLocal(node.name);
            this.visit(node.value);
            this.locals[index].isInitialized = true;
            gen.emit2BytesOperand(
                this.fn.code,
                opcode.$DEFINE_LOCAL,
                index,
                node.line
            );
        } else {
            // store the variable name
            const index = this.storeString(node.name);
            this.visit(node.value);
            gen.emit2BytesOperand(
                this.fn.code,
                opcode.$DEFINE_GLOBAL,
                index,
                node.line
            );
        }
    }

    visitVarDeclListNode(node) {
        node.decls.forEach((item) => this.visit(item));
    }

    visitVarNode(node) {
        let index;
        // check if it's a local
        if ((index = this.findLocal(node)) !== -1) {
            const local = this.locals[index];
            if (!local.isInitialized) {
                this.compilationError(
                    `cannot utilize uninitialized variable '${node.name}'`,
                    node
                );
                return;
            }
            gen.emit2BytesOperand(
                this.fn.code,
                opcode.$GET_LOCAL,
                index,
                node.line
            );
        }
        // check if it's an upvalue
        else if ((index = this.findUpvalue(node)) !== -1) {
            // only 1 byte (256) upvalues allowable for now
            gen.emitBytes(
                this.fn.code,
                opcode.$GET_UPVALUE,
                index,
                node.line
            );
        }
        // might be a global
        else {
            index = this.storeString(node.name);
            gen.emit2BytesOperand(
                this.fn.code,
                opcode.$GET_GLOBAL,
                index,
                node.line
            );
        }
    }

    visitIStringNode(node) {
        node.exprs.forEach((expr) => this.visit(expr));
        gen.emit2BytesOperand(
            this.fn.code,
            opcode.$FORMAT,
            node.exprs.length,
            node.line
        );
    }

    visitAndExprNode(node) {
        this.visit(node.leftNode);
        const conditionEnd = gen.emitJump(
            this.fn.code,
            opcode.$JUMP_IF_FALSE_OR_POP,
            node.line
        );
        this.visit(node.rightNode);
        gen.patchJump(this.fn.code, conditionEnd);
    }

    visitOrExprNode(node) {
        this.visit(node.leftNode);
        const absJumpExit = gen.emitJump(
            this.fn.code,
            opcode.$JUMP_IF_FALSE,
            node.line
        );
        const conditionEnd = gen.emitJump(
            this.fn.code,
            opcode.$JUMP,
            node.line
        );
        gen.patchJump(this.fn.code, absJumpExit);
        gen.emitByte(this.fn.code, opcode.$POP);
        this.visit(node.rightNode);
        gen.patchJump(this.fn.code, conditionEnd);
    }

    visitIfElseNode(node) {
        this.visit(node.conditionExpr);
        // jump to the else body if condition is false
        // or pop condition result off the stack if it evaluates to true
        const elseJmp = gen.emitJump(
            this.fn.code,
            opcode.$JUMP_IF_FALSE_OR_POP
        );
        this.visit(node.ifBlock);
        // jump to end of if clause
        const endJmp = gen.emitJump(this.fn.code, opcode.$JUMP);
        gen.patchJump(this.fn.code, elseJmp);
        gen.emitByte(this.fn.code, opcode.$POP, node.elseLine);
        if (node.elseBlock) this.visit(node.elseBlock);
        gen.patchJump(this.fn.code, endJmp);
    }

    prepareLoop(loopName) {
        const currLoop = this.currentLoop;
        const loopScope = this.currentScope;
        this.currentLoop = { loopScope, loopName };
        return currLoop;
    }

    visitWhileLoopNode(node) {
        const prevLoop = this.prepareLoop("while");
        // we're using length directly and not offsetting it by 1
        // (i.e. length -1) since we need to jump back to exactly where the
        // condition expression bytecode begins.
        const loopPoint = this.fn.code.length;
        this.visit(node.conditionExpr);
        // jump to the end of the loop if condition is false
        // or pop condition result off the stack if it evaluates to true
        const exitJmp = gen.emitJump(
            this.fn.code,
            opcode.$JUMP_IF_FALSE_OR_POP
        );
        this.visit(node.block);
        gen.emitLoop(this.fn.code, loopPoint);
        gen.patchJump(this.fn.code, exitJmp);
        // pop condition result off the stack <- resulting from a jump from
        // the loop condition
        gen.emitByte(this.fn.code, opcode.$POP);
        // check for loop controls (break/continue)
        this.processLoopControl(loopPoint);
        this.currentLoop = prevLoop;
    }

    visitDoWhileLoopNode(node) {
        const prevLoop = this.prepareLoop("doWhile");

        const beginLoop = this.fn.code.length;
        this.visit(node.block);
        const loopPoint = this.fn.code.length;
        this.visit(node.conditionExpr);

        const exitJmp = gen.emitJump(
            this.fn.code,
            opcode.$JUMP_IF_FALSE_OR_POP
        );
        gen.emitLoop(this.fn.code, beginLoop);
        gen.patchJump(this.fn.code, exitJmp);

        gen.emitByte(this.fn.code, opcode.$POP);
        this.processLoopControl(loopPoint);
        this.currentLoop = prevLoop;
    }

    visitForLoopNode(node) {
        /*
         *  for (
         *       init ? ;
         *       condition ? ;
         *       increment ? ;
         *      )
         */
        // for init declaration needs to be in a new scope
        this.currentScope++;
        const prevLoop = this.prepareLoop("for");
        let bodyJmp = null,
            incrJmp = null;
        if (node.initExpr) {
            this.visit(node.initExpr);
        }
        let loopPoint = this.fn.code.length;
        if (node.conditionExpr) {
            this.visit(node.conditionExpr);
            bodyJmp = gen.emitJump(
                this.fn.code,
                opcode.$JUMP_IF_FALSE_OR_POP
            );
        }
        if (node.incrExpr) {
            incrJmp = gen.emitJump(this.fn.code, opcode.$JUMP);
            let tmp = this.fn.code.length;
            this.visit(node.incrExpr);
            gen.emitByte(this.fn.code, opcode.$POP);
            gen.emitLoop(this.fn.code, loopPoint);
            loopPoint = tmp;
            gen.patchJump(this.fn.code, incrJmp);
        }
        this.visit(node.block);
        gen.emitLoop(this.fn.code, loopPoint);
        if (bodyJmp !== null) {
            gen.patchJump(this.fn.code, bodyJmp);
            gen.emitByte(this.fn.code, opcode.$POP);
        }
        this.processLoopControl(loopPoint);
        this.currentScope--;
        // pop initExpr locals if any
        if (node.initExpr) {
            // this.popLocals(null);
            if (node.initExpr.type === ast.ASTType.AST_NODE_VAR_DECL) {
                this.popLocals(null);
            } else {
                // todo: thoroughly confirm if this wouldn't cause a problem
                const localsCount = node.initExpr.decls.length;
                gen.emit2BytesOperand(
                    this.fn.code,
                    opcode.$POP_N,
                    localsCount
                );
                this.locals.length -= localsCount;
            }
        }
        this.currentLoop = prevLoop;
    }

    visitForInLoopNode(node) {
        /*
         *  for x in stuff { ... }
         *     |
         *  let $var_itr = stuff.__iter__(), $var_tmp;
         *  while (($var_tmp = $var_itr.__next__()) && !$var_tmp["done"]) {
         *      let x = $var_tmp["value"];
         *  }
         */
        const line = node.varNode.line;
        // itr & tmp
        const itrName = this.getFreeVar("itr"),
            tmpName = this.getFreeVar("tmp");
        const itrVar = new ast.VarNode(itrName, line),
            tmpVar = new ast.VarNode(tmpName, line);

        // *1* let $var_itr = stuff.__iter__(), $var_tmp;
        let dotExpr = new ast.DotExprNode(
            node.iterExprNode,
            new ast.VarNode("__iter__", line),
            line
        );
        let callNode = new ast.CallNode(dotExpr, line);
        const nullNode = new ast.NullNode(line);
        const decls = [
            new ast.VarDeclNode(itrName, callNode, true, line),
            new ast.VarDeclNode(tmpName, nullNode, true, line),
        ];
        const declListNode = new ast.VarDeclListNode(decls);

        // *2* while (($var_tmp = $var_itr.__next__()) && !$var_tmp["done"])
        dotExpr = new ast.DotExprNode(
            itrVar,
            new ast.VarNode("__next__", line),
            line
        );
        callNode = new ast.CallNode(dotExpr, line);
        let assignNode = new ast.AssignNode(
            tmpVar,
            callNode,
            ast.OpType.OPTR_EQ,
            line
        );
        let indexNode = new ast.IndexExprNode(
            tmpVar,
            new ast.StringNode("done", line),
            line
        );
        let unaryNode = new ast.UnaryNode(indexNode, line, ast.OpType.OPTR_NOT);
        const conditionExprNode = new ast.AndExprNode(
            assignNode,
            unaryNode,
            line
        );
        // *3* let x = $var_tmp["value"];
        indexNode = new ast.IndexExprNode(
            tmpVar,
            new ast.StringNode("value", line),
            line
        );
        // create the user var and insert as the first declaration in the
        // body of the for loop block
        const userDecl = new ast.VarDeclNode(
            node.varNode.name,
            indexNode,
            false,
            line
        );
        node.blockNode.decls.unshift(userDecl);
        const whileLoopNode = new ast.WhileLoopNode(
            conditionExprNode,
            node.blockNode
        );
        this.visit(declListNode);
        this.visit(whileLoopNode);
    }

    visitUnboundedLoopNode(node) {
        const prevLoop = this.prepareLoop("unbounded");
        const loopPoint = this.fn.code.length;
        this.visit(node.block);
        gen.emitLoop(this.fn.code, loopPoint);
        this.processLoopControl(loopPoint);
        this.currentLoop = prevLoop;
    }

    assertJumpOffset(offset, controlNode) {
        if (offset > utils.UINT16_MAX) {
            this.compilationError(
                "code body too large to jump over",
                controlNode
            );
        }
    }

    compileLoopControl(control, continuePoint, breakEnd) {
        const slot = control.patchSlot;
        if (control.isBreak) {
            // slot + 1 + 1 + beginning of next instruction
            const breakOffset = breakEnd - (slot + 3);
            this.assertJumpOffset(breakOffset, control);
            // 3 bytes long -> slot + 1 + 1
            this.fn.code.bytes[slot] = opcode.$JUMP;
            this.fn.code.bytes[slot + 1] = (breakOffset >> 8) & 0xff;
            this.fn.code.bytes[slot + 2] = breakOffset & 0xff;
        } else {
            // continue
            // before the 'continue' instruction
            // slot + 1 + 1 + beginning of next instruction
            let continueOffset, bytecode;
            if (control.loopName !== "doWhile") {
                continueOffset = slot + 3 - continuePoint;
                bytecode = opcode.$LOOP;
            } else {
                continueOffset = continuePoint - (slot + 3);
                bytecode = opcode.$JUMP;
            }
            this.assertJumpOffset(continueOffset, control);
            this.fn.code.bytes[slot] = bytecode;
            this.fn.code.bytes[slot + 1] = (continueOffset >> 8) & 0xff;
            this.fn.code.bytes[slot + 2] = continueOffset & 0xff;
        }
    }

    processLoopControl(continuePoint) {
        let breakEnd = this.fn.code.length;
        this.loopControls.forEach((control) => {
            this.compileLoopControl(control, continuePoint, breakEnd);
        });
        this.loopControls = [];
    }

    visitControlNode(node) {
        const localsLength = this.locals.filter(
            (local) => local.scope > this.currentLoop.loopScope
        ).length;
        node.loopName = this.currentLoop.loopName;
        node.localsCount = localsLength;
        // we need to pop the locals created in the loop up to the point the
        // control was added
        if (localsLength) {
            gen.emit2BytesOperand(
                this.fn.code,
                opcode.$POP_N,
                localsLength,
                node.line
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

    visitBlockNode(node) {
        this.currentScope++;
        node.decls.forEach((item) => this.visit(item));
        this.currentScope--;
        this.popLocals(node.blockEnd);
    }

    transformConditionedOfNode(arm, name) {
        // arm: OfNode
        const ifNode = new ast.IfElseNode();
        const varNode = new ast.VarNode(name, arm.line);
        ifNode.conditionExpr = arm.conditions.reduce((left, right) => {
            if (left === null) {
                return new ast.BinaryNode(varNode, right, ast.OpType.OPTR_EQEQ);
            }
            const nodeLeft = left;
            const nodeRight = new ast.BinaryNode(
                varNode,
                right,
                ast.OpType.OPTR_EQEQ
            );
            return new ast.OrExprNode(nodeLeft, nodeRight);
        }, null);
        ifNode.ifBlock = arm.block;
        return ifNode;
    }

    transformConditionedCaseNode(caseNode) {
        /*
         * todo: move this transformation to the parser
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
        if (!caseNode.conditionExpr) {
            return this.transformRegularCaseNode(caseNode);
        }
        const declNode = new ast.VarDeclNode(
            this.getFreeVar("case"),
            caseNode.conditionExpr,
            caseNode.line
        );
        const ifElseNode = new ast.IfElseNode();
        // we know that there would always be a star arm, because the parser
        // ensures this.
        const starArm = caseNode.arms.pop();
        const lastIfNode = caseNode.arms.reduce((node, rightArm) => {
            node.elseBlock = this.transformConditionedOfNode(
                rightArm,
                declNode.name
            );
            return node.elseBlock;
        }, ifElseNode);
        // set the 'else' of the last IfElseNode to the block of the star arm:
        // of * -> ruff; --> else ruff;
        lastIfNode.elseBlock = starArm.block;
        // the actual complete IfElseNode begins from the else block of `ifElseNode`
        // - which was the first IfElseNode node passed to arms.reduce.
        // see reduce() above.
        const actualIfElseNode = ifElseNode.elseBlock;
        return { declNode, ifElseNode: actualIfElseNode };
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
        return { declNode: null, ifElseNode: actualIfElseNode };
    }

    visitCaseNode(node) {
        const { declNode, ifElseNode } =
            this.transformConditionedCaseNode(node);
        declNode ? this.visit(declNode) : void 0;
        this.visit(ifElseNode);
    }

    visitDictNode(node) {
        node.entries.forEach(([keyNode, valueNode]) => {
            this.visit(keyNode);
            this.visit(valueNode);
        });
        gen.emit2BytesOperand(
            this.fn.code,
            opcode.$BUILD_DICT,
            node.entries.length,
            node.line
        );
    }

    storeVariable(nameStr /*string*/) {
        // returns: index, isLocal
        if (this.currentScope > 0) {
            return [this.initLocal(nameStr), true];
        } else {
            return [this.storeString(nameStr), false];
        }
    }

    defineVariable(name, index, line) {
        if (this.currentScope > 0) {
            gen.emit2BytesOperand(
                this.fn.code,
                opcode.$DEFINE_LOCAL,
                this.initLocal(name),
                line
            );
        } else {
            // make index an optional arg
            index = index === null ? this.storeString(name) : index;
            gen.emit2BytesOperand(
                this.fn.code,
                opcode.$DEFINE_GLOBAL,
                index,
                line
            );
        }
    }

    visitReturnNode(node) {
        this.visit(node.expr);
        gen.emitByte(this.fn.code, opcode.$RETURN, node.line);
    }

    visitFunctionNode(node) {
        /*
         * fn foo(){
         *    show 28;
         * }
         * let foo = () => {...}
         */
        let compiler = new Compiler(this.parser, this.module, node.fnType);
        compiler.enclosingCompiler = this;
        // use the same map for interning all strings
        compiler.strings = this.strings;
        compiler.fn.isLambda = node.isLambda;
        if (!node.isLambda) {
            compiler.fn.fname = vmod.getStringObj(node.name, this.strings);
        } else {
            compiler.fn.fname = vmod.getStringObj("<lambda>", this.strings);
        }
        //! compile params:
        //! first we compile the default parameters' values into
        // the current function - this (enclosing)
        if (node.defaultParamsCount) {
            // param: ParameterNode { leftNode, rightNode, line }
            node.params.forEach(({ rightNode, line }, index) => {
                if (rightNode) {
                    // emit:
                    // {value parameter-position},.. {value parameter-position}
                    this.visit(rightNode);
                    gen.emitConstant(
                        this.fn.code,
                        // counting from 1 not 0
                        new vmod.Value(vmod.VAL_INT, index + 1),
                        line
                    );
                }
            });
        }
        //! next we compile the actual parameters
        compiler.currentScope++; // params are always local
        node.params.forEach((param) => {
            // ParameterNode: { leftNode, rightNode, isSpreadArg, line }
            const slot = compiler.initLocal(param.leftNode.name);
            gen.emit2BytesOperand(
                compiler.fn.code,
                opcode.$DEFINE_LOCAL,
                slot,
                param.line
            );
        });
        //! set some essential properties on `fn`
        compiler.fn.arity = node.params.length;
        compiler.fn.isVariadic = node.isVariadic;
        compiler.fn.isStaticMethod = node.isStatic;
        compiler.fn.defaultParamsCount = node.defaultParamsCount;
        //! compile fn's body
        node.block.decls.forEach((item) => compiler.visit(item));
        //! no need to pop locals since return from the function balances
        //! the stack effect
        gen.emitConstant(
            this.fn.code,
            new vmod.Value(vmod.VAL_FUNCTION, compiler.fn),
            node.line,
            opcode.$CLOSURE
        );
        //! emit instructions for processing closures captured in `compiler`
        //! during its compilation process:
        for (let i = 0; i < compiler.upvalues.length; i++) {
            //! emit: index | isLocal
            const upvalue = compiler.upvalues[i];
            gen.emitBytes(this.fn.code, upvalue.index, upvalue.isLocal);
        }
        /* emit definition instruction - only for non-lambda functions
         * `emitDefinition` is a flag that controls the emission of
         * the function's definition instructions by the compiler.
         */
        if (node.emitDefinition && !node.isLambda) {
            /* we pass null as `index` param to allow defineVariable()
             * store the function name in the function's constant pool only
             * when needed (i.e. only when in a global scope).
             */
            this.defineVariable(node.name, null, node.line);
        }
    }

    visitCallNode(node) {
        this.visit(node.leftNode);
        node.args.forEach((arg) => this.visit(arg));
        gen.emitBytes(
            this.fn.code,
            (node.hasSpread ? opcode.$CALL_UNPACK : opcode.$CALL),
            node.args.length,
            node.line
        );
    }

    visitDotExprNode(node) {
        let bytecode;
        // handle property access for `deref` and other variables/nodes
        if (node.isDerefExpr) {
            // ensure deref isn't used in a static method
            if (this.fnType !== ast.FnTypes.TYPE_METHOD) {
                this.compilationError("Can't use deref in a static method", node);
                return;
            }
            bytecode = opcode.$GET_DEREF_PROPERTY;
            /* place `ref` on stack for binding to base def's method
             * this is because a method requires the `ref` arg to be
             * the first value on its call frame's stack.
             * See getCompilerLocal() for more info.
             */
            const ref = new ast.VarNode("ref", node.line);
            this.visit(ref);
        } else {
            bytecode = opcode.$GET_PROPERTY;
        }
        this.visit(node.leftNode);
        utils.assert(
            node.rightNode instanceof ast.VarNode,
            "Compiler::visitDotExprNode()"
        );
        const index = this.storeString(node.rightNode.name);
        gen.emit2BytesOperand(this.fn.code, bytecode, index, node.line);
    }

    visitMethodNode(node) {
        this.visit(node.fnNode);
        gen.emitByte(this.fn.code, opcode.$METHOD);
    }

    compileDerefMethodCall(node) {
        // err if deref is used in a static method
        if (this.fnType !== ast.FnTypes.TYPE_METHOD) {
            this.compilationError("Can't use deref in a static method", node);
            return;
        }
        /*
         * place `ref` on stack for binding to base def's method
         * this is because a method requires the `ref` arg to be
         * the first value on its call frame's stack.
         * See getCompilerLocal() for more info.
         */
        const ref = new ast.VarNode("ref", node.line);
        this.visit(ref);
        // place the args on the stack.
        node.args.forEach((arg) => this.visit(arg));
        // now place the base def on the stack, in prep for op_invoke_deref
        // node.leftNode is a DotExprNode having a leftNode and rightNode props
        utils.assert(
            node.leftNode instanceof ast.DotExprNode,
            "Compiler::compileDerefMethodCall()"
        );
        const dotNode = node.leftNode;
        // place `deref` - the base def, on the stack
        this.visit(dotNode.leftNode);
        /* store the method/property name, and emit the instructions.
         * `node.leftNode` is a DotExprNode, and its `rightNode` property is
         * always a VarNode. Hence access that `rightNode` to obtain its name.
         */
        const index = this.storeString(dotNode.rightNode.name);
        // `$INVOKE_DEREF` -> instruction for handling `deref` method invocations
        // (e.g.deref->method()) i.e. invocations of a base def's methods/props
        gen.emit2BytesOperand(
            this.fn.code,
            node.hasSpread
                ? opcode.$INVOKE_DEREF_UNPACK
                : opcode.$INVOKE_DEREF,
            index,
            node.line
        );
        gen.emitByte(this.fn.code, node.args.length);
    }

    visitMethodCallNode(node) {
        if (node.isDeref) {
            // compile a super/deref method/property call differently
            this.compileDerefMethodCall(node);
            return;
        }
        // dotExpr + args
        this.visit(node.leftNode);
        const code = this.fn.code;
        /*
         * `$GET_PROPERTY index` would have been emitted when visiting
         * DotExprNode above.
         * -2 for the index operand of `$GET_PROPERTY` (2 bytes long)
         * to obtain the index at which the property/method name was stored
         * in the constant pool (cp).
         */
        const index =
            (code.bytes[code.length - 2] << 8) | code.bytes[code.length - 1];
        // reset the length of the Code object to erase the emitted code.
        // it's 3 bytes long ($GET_PROPERTY index).
        code.resetBy(3);
        // push the arguments on the stack by visiting.
        node.args.forEach((arg) => this.visit(arg));
        /*
         * now emit fresh instructions for handling the method call:
         * $INVOKE[1 byte] index[2 bytes] argCount[1 byte]
         * index: is the position at which the property method name was stored
         *        in the constant pool
         * argCount: is the number of arguments in the call

         * `$INVOKE` -> instruction for handling regular method invocations.
         */
        gen.emit2BytesOperand(this.fn.code, opcode.$INVOKE, index, node.line);
        // args length is 1 byte long (max), as enforced by the parser;
        gen.emitByte(this.fn.code, node.args.length, node.line);
    }

    visitDefNode(node) {
        // emit: $DEF | index (to definition name)
        // base def -> def whose props is to be derived
        // child def -> def which is deriving from another def
        const index = this.storeString(node.defVar.name);
        gen.emit2BytesOperand(this.fn.code, opcode.$DEF, index, node.line);
        // define the `def`
        this.defineVariable(node.defVar.name, index, node.line);
        if (node.derivingNode) {
            // derivingNode is any valid roo expression
            utils.assert(node.derivingNode, "compiler::visitDefNode()");
            // increase the current scope in order to make the base def
            // be in its own scope - a local scope.
            this.currentScope++;
            // push the base def on the stack
            this.visit(node.derivingNode);
            /*
             * make the base def bound to `deref` using a synthetic
             * variable:
             * No need to call defineVariable() since we know this synthetic
             * variable is local (see this.currentScope++ above). Simply
             * calling initLocal() binds `deref` to the base def. Also,
             * no need to emit any instructions for defining a local variable,
             * i.e. $DEFINE_LOCAL, because this does nothing literally, all
             * local variables are already defined the moment they're pushed on
             * the stack - see `$DEFINE_LOCAL` instruction block in vm.run().
             * [[-
             *   I may consider removing `$DEFINE_LOCAL` in the future, as
             *   it's a completely useless instruction, and was only added
             *   for synchronization with `$DEFINE_GLOBAL`.
             * -]]
             */
            const deref = "deref";
            this.initLocal(deref);
            // push the child def on the stack in preparation for "derivation"
            // (that is, inheritance).
            this.visit(node.defVar);
            // emit derivation/inheritance instructions
            gen.emitByte(
                this.fn.code,
                opcode.$DERIVE,
                node.derivingNode.line
            );
        }
        // push the `def` again on the stack, since it could've been popped
        // off during variable definition above or during derivation above
        this.visit(node.defVar);
        // compile its methods
        node.methods.forEach((method) => this.visit(method));
        // pop off the child `def` after its methods are processed
        gen.emitByte(this.fn.code, opcode.$POP);
        if (node.derivingNode) {
            // Exit the local scope.
            this.currentScope--;
            // At this point, the base def would be sitting on the
            // stack. popLocals() causes this to be popped off.
            this.popLocals();
        }
    }

    compileWildcardImport(node) {
        // import * as name from path
        // import_star path
        const pathIndex = this.storeString(node.path);
        const alias = node.names[0]["aliasVar"];
        gen.emit2BytesOperand(
            this.fn.code,
            opcode.$IMPORT_MODULE,
            pathIndex,
            node.line
        );
        gen.emitByte(this.fn.code, node.isRelative, node.line);
        this.defineVariable(alias.name, null, alias.line);
    }

    compileFromImport(node) {
        // import a as b from path
        // |-> import * as tmp from path; let b = tmp.a;
        const pathIndex = this.storeString(node.path);
        const aliasName = this.getFreeVar("imp");
        gen.emit2BytesOperand(
            this.fn.code,
            opcode.$IMPORT_MODULE,
            pathIndex,
            node.line
        );
        gen.emitByte(this.fn.code, node.isRelative, node.line);
        this.defineVariable(aliasName, null, node.line);
        const moduleVar = new ast.VarNode(aliasName, node.line);
        node.names.forEach(({nameVar, aliasVar}) => { // VarNode(), VarNode()
            const expr = new ast.DotExprNode(moduleVar, nameVar, nameVar.line);
            const decl = new ast.VarDeclNode(aliasVar.name, expr, false, aliasVar.line);
            this.visit(decl);
        });
    }

    visitImportNode(node) {
        switch (node.importStyle) {
            case 1:
                this.compileWildcardImport(node);
                break;
            case 2:
                this.compileFromImport(node);
                break;
            default:
                utils.unreachable("compiler::visitImportNode()");
        }
    }

    transformSpreadNode(node) {
        /*  ...itr -|
         * ((var) => {
         *  if var instanceof List return var;
         *  let tmp = [];
         *  for e in var
         *      tmp.append(e);
         *  return tmp;
         * })(itr) -> OP_*_UNPACK
         */
        const itr = node.node;
        const line = node.line;

        // function parameter:
        const param = new ast.VarNode("var", line);
        const paramNode = new ast.ParameterNode(param, null, line);

        //1. if var instanceof List return var;
        const condition = new ast.BinaryNode(
            param,
            new ast.VarNode("List", line),
            ast.OpType.OPTR_INSTOF
        );
        const ifBlock = new ast.BlockNode(
            [new ast.ReturnNode(param, line)],
            line
        );
        const ifENode = new ast.IfElseNode(condition, ifBlock, null, null);

        //2. let tmp = [];
        const tmp = new ast.VarNode("tmp", line);
        const tmpDecl = new ast.VarDeclNode("tmp", new ast.ListNode(line));

        //3. for e in var
        //      tmp.append(e);
        const elem = new ast.VarNode("e", line);
        const call = new ast.MethodCallNode(
            new ast.DotExprNode(tmp, new ast.VarNode("append", line), line),
            false,
            line
        );
        call.args.push(elem);
        const callExpr = new ast.ExprStatementNode(call, line);
        const forBlock = new ast.BlockNode([callExpr], line);
        const forNode = new ast.ForInLoopNode(elem, param, forBlock);

        //4. return tmp;
        const ret = new ast.ReturnNode(tmp, line);
        const stmts = [ifENode, tmpDecl, forNode, ret];
        const fnBlock = new ast.BlockNode(stmts, line);

        const fn = new ast.FunctionNode(null, true, line);
        fn.params.push(paramNode);
        fn.block = fnBlock;
        const spreadCall = new ast.CallNode(fn);
        spreadCall.args.push(itr);
        return spreadCall;
    }

    visitSpreadNode(node) {
        this.visit(this.transformSpreadNode(node));
    }

    visitTryNode(node) {
        // dump placeholder bytes for the operand of $SETUP_EXCEPT
        // instruction, since we don't know where the offset of the
        // except block is yet.
        const trySetup = gen.emitExcept(
            this.fn.code,
            opcode.$SETUP_EXCEPT,
            node.line
        );
        this.visit(node.tryBlock);
        // at this point, no error occurred, so pop off the except handler
        gen.emitByte(this.fn.code, opcode.$POP_EXCEPT);
        // skip the except {} block
        const jmpExcept = gen.emitJump(this.fn.code, opcode.$JUMP);
        // now patch the $SETUP_EXCEPT instruction's operands since
        // the except block offset is now know here.
        gen.patchExcept(this.fn.code, trySetup);
        // create a local scope for the except handler variable
        // - if available, if not use a free var. This implies that the handler
        // variable is always defined.
        // - todo: improve, eliminate redundant instruction generation
        let handlerName, handlerLine;
        if (node.exceptHandlerVar) {
            handlerName = node.exceptHandlerVar.name;
            handlerLine = node.exceptHandlerVar.line;
        } else {
            handlerName = this.getFreeVar("exc");
            handlerLine = null;
        }
        this.currentScope++;
        this.defineVariable(handlerName, null, handlerLine);
        this.currentScope--;
        // same scope (except handler variable scope) will be reused here
        // since blocks create a new local scope
        this.visit(node.exceptBlock);
        if (node.elseBlock) {
            // we need to jump the else block if control comes from
            // the except block
            const elseJmp = gen.emitJump(
                this.fn.code,
                opcode.$JUMP,
                node.line
            );
            // we jump into the else block (if available) after skipping the
            // except block since the exception didn't occur block
            gen.patchJump(this.fn.code, jmpExcept);
            this.visit(node.elseBlock);
            // skip the else block if except block was executed
            gen.patchJump(this.fn.code, elseJmp);
        } else {
            // if the else block isn't available, we jump into the next
            // instruction - skipping the else block.
            gen.patchJump(this.fn.code, jmpExcept);
        }
    }

    visitPanicNode(node) {
        this.visit(node.msgNode);
        gen.emitByte(this.fn.code, opcode.$PANIC, node.line);
    }

    visitDelNode(node) {
        this.visit(node.expr);
        if (node.isSubscript) {
            // rewrite the subscript instruction to a delete instruction
            this.fn.code.bytes[this.fn.code.length - 1] =
                opcode.$DELETE_SUBSCRIPT;
        } else {
            // rewrite the get_property instruction to a delete instruction
            const bytecode = this.fn.code.bytes[this.fn.code.length - 3];
            // ensure delete isn't for a deref property
            if (bytecode === opcode.$GET_DEREF_PROPERTY) {
                return this.compilationError(
                    "Cannot delete deref property",
                    node
                );
            }
            this.fn.code.bytes[this.fn.code.length - 3] =
                opcode.$DELETE_PROPERTY;
        }
    }

    visitProgramNode(node) {
        node.decls.forEach((decl) => this.visit(decl));
    }

    compilationFailed () {
        return (this.hasError || this.fn.code.hasError());
    }

    compile(node, interned = null) {
        // todo: optimization
        // let optimizer = new opt.ConstantFolder(node, this.parser);
        // node = optimizer.fold();
        // console.log(node);
        this.strings = interned || new Map();
        this.visit(node);
        if (this.hasError || this.fn.code.hasError()) {
            this.fn = null;
            // use an empty function object if an error occurred
            this.fn = vmod.createFunctionObj(
                "",
                0,
                new Code(),
                false,
                null,
                this.module
            );
        }
        gen.emitByte(this.fn.code, opcode.$RETURN);
        return this.fn;
    }
}

module.exports = { Compiler };
