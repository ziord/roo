/*
 * ast.js
 */

"use strict";

const tokens = require("../lexer/tokens");

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
    AST_NODE_POSTFIX:           'AST_NODE_POSTFIX',
    AST_NODE_VAR_DECL_LIST:     'AST_NODE_VAR_DECL_LIST',
    AST_NODE_ISTRING:           'AST_NODE_ISTRING',
    AST_NODE_BLOCK:             'AST_NODE_BLOCK',
    AST_NODE_AND_EXPR:          'AST_NODE_AND_EXPR',
    AST_NODE_OR_EXPR:           'AST_NODE_OR_EXPR',
    AST_NODE_IF_ELSE:           'AST_NODE_IF_ELSE',
    AST_NODE_COND_EXPR:         'AST_NODE_COND_EXPR',
    AST_NODE_FOR_LOOP:          'AST_NODE_FOR_LOOP',
    AST_NODE_FOR_IN_LOOP:       'AST_NODE_FOR_IN_LOOP',
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
    AST_NODE_ARGUMENT:          'AST_NODE_ARGUMENT',
    AST_NODE_DEFN:              'AST_NODE_DEFN',
    AST_NODE_DOT_EXPR:          'AST_NODE_DOT_EXPR',
    AST_NODE_METHOD_CALL:       'AST_NODE_METHOD_CALL',
    AST_NODE_TRY:               'AST_NODE_TRY',
    AST_NODE_PANIC:             'AST_NODE_PANIC',
    AST_NODE_SPREAD:            'AST_NODE_SPREAD',
    AST_NODE_IMPORT:            'AST_NODE_IMPORT',
    AST_NODE_DELETE:            'AST_NODE_DELETE',
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
    OPTR_INSTOF: 'OPTR_INSTOF',   // instanceof
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

const FnTypes = {
    TYPE_SCRIPT: "TYPE_SCRIPT", // top-level script
    TYPE_FUNCTION: "TYPE_FUNCTION",
    TYPE_METHOD: "TYPE_METHOD",
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
        case tokens.TOKEN_INSTANCEOF:          return OpType.OPTR_INSTOF;
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
        this.hasSpread = false;
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
    constructor(decls, lineStart, lineEnd = null){
        super();
        this.type = ASTType.AST_NODE_BLOCK;
        this.blockStart = lineStart;
        this.blockEnd = lineEnd;
        this.decls = decls;  // []
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

class IfElseNode extends AST {
    constructor(conditionExpr, ifBlock, elseBlock, elseLine) {
        super();
        this.type = ASTType.AST_NODE_IF_ELSE;
        this.conditionExpr = conditionExpr;
        this.ifBlock = ifBlock;
        this.elseBlock = elseBlock;
        this.elseLine = elseLine;
    }
}

class ForLoopNode extends AST {
    constructor(initExpr, conditionExpr, incrExpr, block) {
        super();
        this.type = ASTType.AST_NODE_FOR_LOOP;
        this.initExpr = initExpr;
        this.conditionExpr = conditionExpr;
        this.incrExpr = incrExpr;
        this.block = block;
    }
}

class ForInLoopNode extends AST {
    constructor (varNode, iterExprNode, block){
        super();
        this.type = ASTType.AST_NODE_FOR_IN_LOOP;
        this.varNode = varNode;
        this.iterExprNode = iterExprNode;
        this.blockNode = block;
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
        this.fnType = FnTypes.TYPE_FUNCTION;
        this.name = name;  // string
        this.params = [];  // VarNode
        this.block = null;
        this.isLambda = isLambda;
        this.line = line;
        this.isVariadic = false;
        this.defaultParamsCount = 0;
        this.isStatic = false;  // a static method ?
        this.isSpecial = false; // a special method in roo?
        this.emitDefinition = true; // should definition instructions be emitted?
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
        this.leftNode = node;
        this.args = [];
        this.hasSpread = false;
        this.line = line;
    }
}

class ParameterNode extends AST {
    constructor(left, right, line){
        super();
        this.type = ASTType.AST_NODE_ARGUMENT;
        this.leftNode = left;  // variable
        this.rightNode = right;  // default value
        this.line = line;
    }
}

class MethodNode extends AST {
    constructor(node){
        super();
        this.fnNode = node;
    }
}

class DefNode extends AST {
    constructor(name, line){
        super();
        this.type = ASTType.AST_NODE_DEFN;
        this.defVar = name;  // VarNode
        this.derivingNode = null;  // VarNode
        this.methods = [];
        this.line = line;
    }
}

class DotExprNode extends AST {
    constructor(left, right, line) {
        super();
        this.type = ASTType.AST_NODE_DOT_EXPR;
        this.line = line;
        this.leftNode = left;
        this.rightNode = right;
        this.isDerefExpr = false;
    }
}

class MethodCallNode extends AST {
    constructor(left, isDeref, line) {
        super();
        this.type = ASTType.AST_NODE_METHOD_CALL;
        this.leftNode = left; // DotExprNode
        this.isDeref = isDeref;
        this.args = [];
        this.hasSpread = false;
        this.line = line;
    }
}

class TryNode extends AST {
    constructor(tryBlock, exceptHandlerVar, exceptBlock, elseBlock, line) {
        super();
        this.type = ASTType.AST_NODE_TRY;
        this.tryBlock = tryBlock;
        this.exceptHandlerVar = exceptHandlerVar;
        this.exceptBlock = exceptBlock;
        this.elseBlock = elseBlock;
        this.line = line;
    }
}

class DelNode extends AST {
    constructor(expr, isSubscript, line) {
        super();
        this.type = ASTType.AST_NODE_DELETE;
        this.expr = expr;
        this.isSubscript = isSubscript;
        this.line = line;
    }
}

class PanicNode extends AST {
    constructor(msgNode, line) {
        super();
        this.type = ASTType.AST_NODE_PANIC;
        this.msgNode = msgNode;
        this.line = line;
    }
}

class SpreadNode extends AST {
    constructor(right, line) {
        super();
        this.type = ASTType.AST_NODE_SPREAD;
        this.node = right;
        this.line = line;
    }
}

class ImportNode extends AST {
    constructor(line) {
        super();
        this.type = ASTType.AST_NODE_IMPORT;
        this.path = null; // string
        // [{nameVar: VarNode, aliasVar: null | VarNode}]
        this.names = [];
        // 1 -> wildcard import, 2 -> from import
        this.importStyle = 0;
        this.isRelative = false;
        this.line = line;
    }
}

class ProgramNode extends AST {
    constructor() {
        super();
        this.type = ASTType.AST_NODE_PROGRAM;
        this.decls = [];
    }
}

module.exports = {
    AST,
    ASTType,
    NumberNode,
    StringNode,
    BinaryNode,
    UnaryNode,
    BooleanNode,
    NullNode,
    ShowNode,
    ListNode,
    RangeNode,
    IndexExprNode,
    VarDeclNode,
    VarNode,
    ExprStatementNode,
    ProgramNode,
    AssignNode,
    MethodCallNode,
    PostfixNode,
    VarDeclListNode,
    BlockNode,
    IStringNode,
    AndExprNode,
    OrExprNode,
    IfElseNode,
    MethodNode,
    DotExprNode,
    ForLoopNode,
    WhileLoopNode,
    DoWhileLoopNode,
    UnboundedLoopNode,
    ControlNode,
    CaseNode,
    OfNode,
    DictNode,
    FunctionNode,
    CallNode,
    ReturnNode,
    ParameterNode,
    DefNode,
    ForInLoopNode,
    TryNode,
    PanicNode,
    SpreadNode,
    ImportNode,
    DelNode,
    OpType,
    getOperator,
    NodeVisitor,
    getAssignmentOp,
    FnTypes,
};
