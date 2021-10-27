/*
 * ast.js
 */

"use strict";

const tokens = require("./tokens");

const ASTType = {
    AST_NODE_NUMBER:            'AST_NODE_NUMBER',
    AST_NODE_STRING:            'AST_NODE_STRING',
    AST_NODE_BINARY:            'AST_NODE_BINARY',
    AST_NODE_UNARY:             'AST_NODE_UNARY',
    AST_NODE_BOOL:              'AST_NODE_BOOL',
    AST_NODE_NULL:              'AST_NODE_NULL',
    AST_NODE_SHOW:              'AST_NODE_SHOW',
    AST_NODE_LIST:              'AST_NODE_LIST',
    AST_NODE_RANGE:             'AST_NODE_RANGE',
    AST_NODE_INDEX_EXPR:        'AST_NODE_INDEX_EXPR',
    AST_NODE_VAR_DECL:          'AST_NODE_VAR_DECL',
    AST_NODE_VAR:               'AST_NODE_VAR',
    AST_NODE_EXPR:              'AST_NODE_EXPR',
    AST_NODE_PROGRAM:           'AST_NODE_PROGRAM',
    AST_NODE_ASSIGN:            'AST_NODE_ASSIGN',
    AST_NODE_INDEX_ASSIGN:      'AST_NODE_ASSIGN',
    AST_NODE_POSTFIX:           'AST_NODE_POSTFIX',
    AST_NODE_VAR_DECL_LIST:     'AST_NODE_VAR_DECL_LIST',
    AST_NODE_ISTRING:           'AST_NODE_ISTRING',
    AST_NODE_BLOCK:             'AST_NODE_BLOCK',
    AST_NODE_AND_EXPR:          'AST_NODE_AND_EXPR',
    AST_NODE_OR_EXPR:           'AST_NODE_OR_EXPR',
    AST_NODE_IF_ELSE:           'AST_NODE_IF_ELSE',
    AST_NODE_COND_EXPR:         'AST_NODE_COND_EXPR',
    AST_NODE_FOR_LOOP:          'AST_NODE_FOR_LOOP',
    AST_NODE_WHILE_LOOP:        'AST_NODE_WHILE_LOOP',
    AST_NODE_DO_WHILE_LOOP:     'AST_NODE_DO_WHILE_LOOP',
    AST_NODE_UNB_LOOP:          'AST_NODE_UNB_LOOP',
    AST_NODE_CONTROL:           'AST_NODE_CONTROL',
    AST_NODE_CASE:              'AST_NODE_CASE',
    AST_NODE_OF:                'AST_NODE_OF',
    AST_NODE_DICT:              'AST_NODE_DICT',
    AST_NODE_FUNCTION:          'AST_NODE_FUNCTION',
    AST_NODE_CALL:              'AST_NODE_CALL',
    AST_NODE_RETURN:            'AST_NODE_RETURN',
};

const OpType = {
    OPTR_MUL: 'OPTR_MUL',        // *
    OPTR_POW: 'OPTR_POW',        // **
    OPTR_DIV: 'OPTR_DIV',         // /
    OPTR_MOD: 'OPTR_MOD',         // %
    OPTR_PLUS: 'OPTR_PLUS',        // +
    OPTR_MINUS: 'OPTR_MINUS',       // -
    OPTR_PLUS_PLUS: 'OPTR_PLUS_PLUS',    // ++
    OPTR_MINUS_MINUS: 'OPTR_MINUS_MINUS',   // --
    OPTR_BW_LSHIFT: 'OPTR_BW_LSHIFT',    // <<
    OPTR_BW_RSHIFT: 'OPTR_BW_RSHIFT',    // >>
    OPTR_BW_AND: 'OPTR_BW_AND',       // &
    OPTR_BW_XOR: 'OPTR_BW_XOR',       // ^
    OPTR_BW_OR: 'OPTR_BW_OR',        // |
    OPTR_BW_INVERT: 'OPTR_BW_INVERT',     // ~
    OPTR_LT: 'OPTR_LT',          // <
    OPTR_GT: 'OPTR_GT',          // >
    OPTR_LEQ: 'OPTR_LEQ',         // <=
    OPTR_GEQ: 'OPTR_GEQ',         // >=
    OPTR_NEQ: 'OPTR_NEQ',         // !=
    OPTR_NOT: 'OPTR_NOT',         // !
    OPTR_EQ: 'OPTR_EQ',          // =
    OPTR_EQEQ: 'OPTR_EQEQ',        // ==
    OPTR_COND: 'OPTR_COND',        // ?
    OPTR_OR: 'OPTR_OR',          // or
    OPTR_AND: 'OPTR_AND',         // and
    /**/
    OPTR_MUL_ASSIGN: 'OPTR_MUL_ASSIGN',
    OPTR_DIV_ASSIGN: 'OPTR_DIV_ASSIGN',
    OPTR_MOD_ASSIGN: 'OPTR_MOD_ASSIGN',
    OPTR_PLUS_ASSIGN: 'OPTR_PLUS_ASSIGN',
    OPTR_POW_ASSIGN: 'OPTR_POW_ASSIGN',
    OPTR_MINUS_ASSIGN: 'OPTR_MINUS_ASSIGN',
    OPTR_BW_LSHIFT_ASSIGN: 'OPTR_BW_LSHIFT_ASSIGN',
    OPTR_BW_RSHIFT_ASSIGN: 'OPTR_BW_RSHIFT_ASSIGN',
    OPTR_BW_AND_ASSIGN: 'OPTR_BW_AND_ASSIGN',
    OPTR_BW_XOR_ASSIGN: 'OPTR_BW_XOR_ASSIGN',
    OPTR_BW_OR_ASSIGN: 'OPTR_BW_OR_ASSIGN',
};

function getOperator(tokenType){
    switch (tokenType)
    {
        case tokens.TOKEN_LESS_THAN:           return OpType.OPTR_LT;
        case tokens.TOKEN_GREATER_THAN:        return OpType.OPTR_GT;
        case tokens.TOKEN_STAR:                return OpType.OPTR_MUL;
        case tokens.TOKEN_STAR_STAR:           return OpType.OPTR_POW;
        case tokens.TOKEN_MINUS:               return OpType.OPTR_MINUS;
        case tokens.TOKEN_PLUS:                return OpType.OPTR_PLUS;
        case tokens.TOKEN_PLUS_PLUS:           return OpType.OPTR_PLUS_PLUS;
        case tokens.TOKEN_MINUS_MINUS:         return OpType.OPTR_MINUS_MINUS;
        case tokens.TOKEN_F_SLASH:             return OpType.OPTR_DIV;
        case tokens.TOKEN_MOD:                 return OpType.OPTR_MOD;
        case tokens.TOKEN_EQUAL:               return OpType.OPTR_EQ;
        case tokens.TOKEN_QMARK:               return OpType.OPTR_COND;
        case tokens.TOKEN_BITWISE_AND:         return OpType.OPTR_BW_AND;
        case tokens.TOKEN_BITWISE_XOR:         return OpType.OPTR_BW_XOR;
        case tokens.TOKEN_BITWISE_OR:          return OpType.OPTR_BW_OR;
        case tokens.TOKEN_BITWISE_INVERT:      return OpType.OPTR_BW_INVERT;
        case tokens.TOKEN_LESS_THAN_EQUAL:     return OpType.OPTR_LEQ;
        case tokens.TOKEN_GREATER_THAN_EQUAL:  return OpType.OPTR_GEQ;
        case tokens.TOKEN_EQUAL_EQUAL:         return OpType.OPTR_EQEQ;
        case tokens.TOKEN_NOT:                 return OpType.OPTR_NOT;
        case tokens.TOKEN_NOT_EQUAL:           return OpType.OPTR_NEQ;
        case tokens.TOKEN_BITWISE_LSHIFT:      return OpType.OPTR_BW_LSHIFT;
        case tokens.TOKEN_BITWISE_RSHIFT:      return OpType.OPTR_BW_RSHIFT;
        case tokens.TOKEN_MINUS_EQUAL:         return OpType.OPTR_MINUS_ASSIGN;
        case tokens.TOKEN_PLUS_EQUAL:          return OpType.OPTR_PLUS_ASSIGN;
        case tokens.TOKEN_DIV_EQUAL:           return OpType.OPTR_DIV_ASSIGN;
        case tokens.TOKEN_STAR_EQUAL:          return OpType.OPTR_MUL_ASSIGN;
        case tokens.TOKEN_MOD_EQUAL:           return OpType.OPTR_MOD_ASSIGN;
        case tokens.TOKEN_LSHIFT_EQUAL:        return OpType.OPTR_BW_LSHIFT_ASSIGN;
        case tokens.TOKEN_RSHIFT_EQUAL:        return OpType.OPTR_BW_RSHIFT_ASSIGN;
        case tokens.TOKEN_AND_EQUAL:           return OpType.OPTR_BW_AND_ASSIGN;
        case tokens.TOKEN_OR_EQUAL:            return OpType.OPTR_BW_OR_ASSIGN;
        case tokens.TOKEN_XOR_EQUAL:           return OpType.OPTR_BW_XOR_ASSIGN;
        case tokens.TOKEN_STAR_STAR_EQUAL:     return OpType.OPTR_POW_ASSIGN;
        case tokens.TOKEN_OR:                  return OpType.OPTR_OR;
        case tokens.TOKEN_AND:                 return OpType.OPTR_AND;
        default:                               return undefined;
    }
}

function getAssignmentOp(tokenType){
    switch (tokenType){
        case tokens.TOKEN_EQUAL:               return OpType.OPTR_EQ;
        case tokens.TOKEN_MINUS_EQUAL:         return OpType.OPTR_MINUS_ASSIGN;
        case tokens.TOKEN_PLUS_EQUAL:          return OpType.OPTR_PLUS_ASSIGN;
        case tokens.TOKEN_DIV_EQUAL:           return OpType.OPTR_DIV_ASSIGN;
        case tokens.TOKEN_STAR_EQUAL:          return OpType.OPTR_MUL_ASSIGN;
        case tokens.TOKEN_MOD_EQUAL:           return OpType.OPTR_MOD_ASSIGN;
        case tokens.TOKEN_LSHIFT_EQUAL:        return OpType.OPTR_BW_LSHIFT_ASSIGN;
        case tokens.TOKEN_RSHIFT_EQUAL:        return OpType.OPTR_BW_RSHIFT_ASSIGN;
        case tokens.TOKEN_AND_EQUAL:           return OpType.OPTR_BW_AND_ASSIGN;
        case tokens.TOKEN_OR_EQUAL:            return OpType.OPTR_BW_OR_ASSIGN;
        case tokens.TOKEN_XOR_EQUAL:           return OpType.OPTR_BW_XOR_ASSIGN;
        case tokens.TOKEN_STAR_STAR_EQUAL:     return OpType.OPTR_POW_ASSIGN;
        default:                               return undefined;
    }
}

class AST {
    constructor(){
        if (new.target === AST){
            throw new Error("Cannot instantiate class directly.");
        }
    }

    visit(node){
        throw new Error("NotImplemented")
    }
}

class NodeVisitor extends AST{
    visit(node){
        let property = "visit" + node.constructor.name;
        this[property].call(this, node);
    }
}

class NumberNode extends AST{
    constructor(value, isInteger, line){
        super();
        this.type = ASTType.AST_NODE_NUMBER;
        this.line = line;
        this.value = value;
        this.isInteger = isInteger;
    }
}

class StringNode extends AST{
    constructor(value, length, line){
        super();
        this.type = ASTType.AST_NODE_STRING;
        this.line = line;
        this.value = value;
        this.length = length;
    }
}

class BinaryNode extends AST{
    constructor(leftNode, rightNode, op){
        super();
        this.type = ASTType.AST_NODE_BINARY;
        this.leftNode = leftNode;
        this.rightNode = rightNode;
        this.op = op;
    }
}

class UnaryNode extends AST{
    constructor(node, line, op){
        super();
        this.type = ASTType.AST_NODE_UNARY;
        this.line = line;
        this.node = node;
        this.op = op;
    }
}

class BooleanNode extends AST{
    constructor(value, line){
        super();
        this.type = ASTType.AST_NODE_BOOL;
        this.line = line;
        this.value = value;
        this.isInteger = true;
    }
}

class NullNode extends AST{
    constructor(line){
        super();
        this.type = ASTType.AST_NODE_NULL;
        this.line = line;
    }
}

class ShowNode extends AST{
    constructor(line){
        super();
        this.type = ASTType.AST_NODE_SHOW;
        this.nodes = [];
        this.line = line;
    }
}

class ListNode extends AST{
    constructor(line){
        super();
        this.type = ASTType.AST_NODE_LIST;
        this.nodes = [];
        this.line = line;
    }
}

class RangeNode extends AST{
    constructor(start, end, step, line){
        super();
        this.type = ASTType.AST_NODE_RANGE;
        this.startNode = start;
        this.endNode = end;
        this.stepNode = step;
        this.line = line;
    }
}

class IndexExprNode extends AST{
    constructor(node, indexExpr, line){
        super();
        this.type = ASTType.AST_NODE_INDEX_EXPR;
        this.leftExpr = node;
        this.indexExpr = indexExpr;
        this.line = line;
    }
}

class VarNode extends AST{
    constructor(name, line){
        super();
        this.type = ASTType.AST_NODE_VAR;
        this.name = name;
        this.line = line;
    }
}

class VarDeclNode extends AST{
    constructor(name, value, isConst, line){
        super();
        this.type = ASTType.AST_NODE_VAR_DECL;
        this.name = name;
        this.isConst = isConst;
        this.value = value;
        this.line = line;
    }
}

class VarDeclListNode extends AST{
    constructor(decls){
        super();
        this.type = ASTType.AST_NODE_VAR_DECL_LIST;
        this.decls = decls;
    }
}

class ExprStatementNode extends AST{
    constructor(expr, line){
        super();
        this.type = ASTType.AST_NODE_EXPR;
        this.expr = expr;
        this.line = line;
    }
}

class AssignNode extends AST{
    constructor(left, right, assignOp, line){
        super();
        this.type = ASTType.AST_NODE_ASSIGN;
        this.leftNode = left;
        this.rightNode = right;
        this.op = assignOp;
        this.line = line;
    }
}

class BlockNode extends AST{
    constructor(decls, lineStart, lineEnd){
        super();
        this.type = ASTType.AST_NODE_BLOCK;
        this.blockStart = lineStart;
        this.blockEnd = lineEnd;
        this.decls = decls;  // []
    }
}

class IndexExprAssignNode extends AST{
    constructor(left, right, assignOp, line){
        super();
        this.type = ASTType.AST_NODE_INDEX_ASSIGN;
        this.leftNode = left;  // indexExpr
        this.rightNode = right;
        this.op = assignOp;
        this.line = line;
    }
}

class PostfixNode extends AST{
    constructor(node, op, line){
        super();
        this.type = ASTType.AST_NODE_POSTFIX;
        this.node = node;
        this.op = op;
        this.line = line;
    }
}

class IStringNode extends AST{
    constructor (line){
        super();
        this.type = ASTType.AST_NODE_ISTRING;
        this.exprs = [];
        this.line = line;
    }
}

class AndExprNode extends AST{
    constructor (leftNode, rightNode, line){
        super();
        this.type = ASTType.AST_NODE_AND_EXPR;
        this.leftNode = leftNode;
        this.rightNode = rightNode;
        this.line = line;
    }
}

class OrExprNode extends AST{
    constructor (leftNode, rightNode, line){
        super();
        this.type = ASTType.AST_NODE_OR_EXPR;
        this.leftNode = leftNode;
        this.rightNode = rightNode;
        this.line = line;
    }
}

class IfElseNode extends AST{
    constructor(conditionExpr, ifBlock, elseBlock){
        super();
        this.type = ASTType.AST_NODE_IF_ELSE;
        this.conditionExpr = conditionExpr;
        this.ifBlock = ifBlock;
        this.elseBlock = elseBlock;
    }
}

class ForLoopNode extends AST{
    constructor (initExpr, conditionExpr, incrExpr, block){
        super();
        this.type = ASTType.AST_NODE_FOR_LOOP;
        this.initExpr = initExpr;
        this.conditionExpr = conditionExpr;
        this.incrExpr = incrExpr;
        this.block = block;
    }
}

class WhileLoopNode extends AST{
    constructor (conditionExpr, block){
        super();
        this.type = ASTType.AST_NODE_WHILE_LOOP;
        this.conditionExpr = conditionExpr;
        this.block = block;
    }
}

class DoWhileLoopNode extends AST{
    constructor (conditionExpr, block){
        super();
        this.type = ASTType.AST_NODE_DO_WHILE_LOOP;
        this.conditionExpr = conditionExpr;
        this.block = block;
    }
}

class UnboundedLoopNode extends AST{
    constructor (block){
        super();
        this.type = ASTType.AST_NODE_UNB_LOOP;
        this.block = block;
    }
}

class ControlNode extends AST{
    constructor (line, isBreak){
        super();
        this.type = ASTType.AST_NODE_CONTROL;
        this.line = line;
        this.isBreak = isBreak;
        this.isContinue = !this.isBreak;
        // store loop control instructions beginning slot for later patching
        this.patchSlot = null;
        this.localsCount = 0;
        this.loopName = '';
    }
}

class CaseNode extends AST{
    constructor (line){
        super();
        this.type = ASTType.AST_NODE_CASE;
        this.conditionExpr = null;
        this.arms = [];  // OfNode nodes
        this.line = line;
    }
}

class OfNode extends AST{
    constructor (line){
        super();
        this.type = ASTType.AST_NODE_OF;
        this.line = line;
        this.conditions = [];
        this.block = null;
        this.hasDefault = false;
    }
}

class DictNode extends AST{
    constructor (line){
        super();
        this.type = ASTType.AST_NODE_DICT;
        this.line = line;
        this.entries = []; // [[key, value], ...]
    }
}

class FunctionNode extends AST{
    constructor(name, isLambda, line){
        super();
        this.type = ASTType.AST_NODE_FUNCTION;
        this.name = name;  // string
        this.params = [];  // VarNode
        this.block = null;
        this.isLambda = isLambda;
        this.line = line;
    }
}

class ReturnNode extends AST{
    constructor(expr, line){
        super();
        this.type = ASTType.AST_NODE_RETURN;
        this.expr = expr;
        this.line = line;
    }
}

class CallNode extends AST{
    constructor(node, line){
        super();
        this.type = ASTType.AST_NODE_CALL;
        this.line = line;
        this.leftNode = node;
        this.args = [];
    }
}

class ProgramNode extends AST{
    constructor(){
        super();
        this.type = ASTType.AST_NODE_PROGRAM;
        this.decls = [];
    }
}

module.exports = {
    AST, ASTType, NumberNode, StringNode, BinaryNode, UnaryNode,
    BooleanNode, NullNode, ShowNode, ListNode, RangeNode,
    IndexExprNode, VarDeclNode, VarNode, ExprStatementNode,
    ProgramNode, AssignNode, IndexExprAssignNode,
    PostfixNode, VarDeclListNode, BlockNode, IStringNode,
    AndExprNode, OrExprNode, IfElseNode,
    ForLoopNode, WhileLoopNode, DoWhileLoopNode, UnboundedLoopNode,
    ControlNode, CaseNode, OfNode, DictNode, FunctionNode,
    CallNode, ReturnNode,
    OpType, getOperator, NodeVisitor, getAssignmentOp
};
