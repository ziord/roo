/*
 * parser.js
 */

"use strict";

const ast = require("./ast");
const errors = require("../lexer/errors");
const tokens = require("../lexer/tokens");
const { Token, Lexer } = require("../lexer/lexer");
const utils = require("../utils");

// token-type -> binding-power | prefix | infix

/*
 * Binding Powers
 */
const POWER_NONE = 0,
    POWER_ASSIGNMENT = 1,         // = | *= | += | /= | &= ...
    POWER_CONDITIONAL_EXPR = 2,   // cond ? expr : expr
    POWER_OR = 3,                 // or
    POWER_AND = 4,                // and
    POWER_BITWISE_OR = 5,         // |
    POWER_BITWISE_XOR = 6,        // ^
    POWER_BITWISE_AND = 7,        // &
    POWER_EQUALITY = 8,           // == | !=
    POWER_COMPARISON = 9,         // >= | <= | > | <
    POWER_BITWISE_SHIFT = 10,     // >> | <<
    POWER_TERM = 11,              // + | -
    POWER_FACTOR = 12,            // * | / | ** | %
    POWER_UNARY = 13,             // - | + | ~ | ! | ++ | --
    POWER_POSTFIX = 14,           // ++ | -- | [..]
    POWER_CALL = 15;              // . | ( )

function bp(power, prefix, infix) {
    return { power, prefix, infix };
}

/*
 * Binding Power Table
 */
function BPTable() {}

BPTable[tokens.TOKEN_SEMI_COLON] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_AT] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_LESS_THAN] = bp(POWER_COMPARISON, null, binary);
BPTable[tokens.TOKEN_GREATER_THAN] = bp(POWER_COMPARISON, null, binary);
BPTable[tokens.TOKEN_LEFT_BRACKET] = bp(POWER_CALL, grouping, callExpr);
BPTable[tokens.TOKEN_RIGHT_BRACKET] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_LEFT_SQR_BRACKET] = bp(POWER_POSTFIX, listLiteral, indexExpression);
BPTable[tokens.TOKEN_RIGHT_SQR_BRACKET] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_LEFT_CURLY] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_RIGHT_CURLY] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_STAR] = bp(POWER_FACTOR, null, binary);
BPTable[tokens.TOKEN_MINUS] = bp(POWER_TERM, unary, binary);
BPTable[tokens.TOKEN_PLUS] = bp(POWER_TERM, unary, binary);
BPTable[tokens.TOKEN_F_SLASH] = bp(POWER_FACTOR, null, binary);
BPTable[tokens.TOKEN_B_SLASH] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_COMMA] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_DOT] = bp(POWER_CALL, null, dotExpr);
BPTable[tokens.TOKEN_MOD] = bp(POWER_FACTOR, null, binary);
BPTable[tokens.TOKEN_EQUAL] = bp(POWER_ASSIGNMENT, null, null);
BPTable[tokens.TOKEN_QMARK] = bp(POWER_CONDITIONAL_EXPR, null, conditionalExpr);
BPTable[tokens.TOKEN_COLON] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_BITWISE_AND] = bp(POWER_BITWISE_AND, null, binary);
BPTable[tokens.TOKEN_BITWISE_XOR] = bp(POWER_BITWISE_XOR, null, binary);
BPTable[tokens.TOKEN_BITWISE_OR] = bp(POWER_BITWISE_OR, null, binary);
BPTable[tokens.TOKEN_BITWISE_INVERT] = bp(POWER_UNARY, unary, null);
BPTable[tokens.TOKEN_LESS_THAN_EQUAL] = bp(POWER_COMPARISON, null, binary);
BPTable[tokens.TOKEN_GREATER_THAN_EQUAL] = bp(POWER_COMPARISON, null, binary);
BPTable[tokens.TOKEN_EQUAL_EQUAL] = bp(POWER_EQUALITY, null, binary);
BPTable[tokens.TOKEN_EXC_MARK] = bp(POWER_NONE, dictLiteral, null);
BPTable[tokens.TOKEN_NOT_EQUAL] = bp(POWER_EQUALITY, null, binary);
BPTable[tokens.TOKEN_BITWISE_LSHIFT] = bp(POWER_BITWISE_SHIFT, null, binary);
BPTable[tokens.TOKEN_BITWISE_RSHIFT] = bp(POWER_BITWISE_SHIFT, null, binary);
BPTable[tokens.TOKEN_MINUS_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_PLUS_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_DIV_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_STAR_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_MOD_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_LSHIFT_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_RSHIFT_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_AND_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_OR_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_XOR_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_STAR_STAR] = bp(POWER_FACTOR, null, binary);
BPTable[tokens.TOKEN_STAR_STAR_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_ARROW] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_FAT_ARROW] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_PLUS_PLUS] = bp(POWER_POSTFIX, unary, postfix);
BPTable[tokens.TOKEN_MINUS_MINUS] = bp(POWER_POSTFIX, unary, postfix);
BPTable[tokens.TOKEN_DOT_DOT] = bp(POWER_CALL, null, rangeLiteral);
BPTable[tokens.TOKEN_PIPE] = bp(POWER_FACTOR, null, pipeExpr);
BPTable[tokens.TOKEN_DOT_DOT_DOT] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_HEXINT_NUMBER] = bp(POWER_NONE, number, null);
BPTable[tokens.TOKEN_INT_NUMBER] = bp(POWER_NONE, number, null);
BPTable[tokens.TOKEN_FLOAT_NUMBER] = bp(POWER_NONE, number, null);
BPTable[tokens.TOKEN_IDENTIFIER] = bp(POWER_NONE, variable, null);
BPTable[tokens.TOKEN_ISTRING_START] = bp(POWER_NONE, iStringLiteral, null);
BPTable[tokens.TOKEN_ISTRING_END] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_STRING] = bp(POWER_NONE, stringLiteral, null);
BPTable[tokens.TOKEN_FOR] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_OR] = bp(POWER_OR, null, OrExprNode);
BPTable[tokens.TOKEN_IN] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_OF] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_AND] = bp(POWER_AND, null, AndExprNode);
BPTable[tokens.TOKEN_NOT] = bp(POWER_UNARY, unary, null);
BPTable[tokens.TOKEN_DO] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_IF] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_ELSE] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_WHILE] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_FN] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_NULL] = bp(POWER_NONE, literal, null);
BPTable[tokens.TOKEN_LET] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_TRUE] = bp(POWER_NONE, literal, null);
BPTable[tokens.TOKEN_FALSE] = bp(POWER_NONE, literal, null);
BPTable[tokens.TOKEN_REF] = bp(POWER_NONE, refExpr, null);
BPTable[tokens.TOKEN_CONST] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_SHOW] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_RETURN] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_CLASS] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_DEREF] = bp(POWER_NONE, derefExpr, null);
BPTable[tokens.TOKEN_BREAK] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_CONTINUE] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_LOOP] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_CASE] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_STATIC] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_TRY] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_EXCEPT] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_STRUCT] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_DEFINE] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_DERIVE] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_PANIC] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_ERROR] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_EOF] = bp(POWER_NONE, null, null);

function Parser(src) {
    // has the parser encountered an error?
    this.hadError = false;
    // sho n para lowo?
    this.panicking = false;
    this.lexer = new Lexer(src);
    this.currentToken = null;
    this.previousToken = null;
    // a linked object of binding powers - for assignment
    this.currentBp = { bp: POWER_NONE, prev: null };
    this.pstack = [];
    // a chain of environments for tracking constness
    this.currentScope = { name: "global", enclosingScope: null };
    this.scopeCount = 1;
    this.inLoop = 0;
    // are we parsing/in a function?:
    this.inFunction = 0;
    // are we in the body of a 'define' declaration? (define var{...})
    this.inDefinition = 0;
    // is the current node being parsed an init*() method?:
    this.inInitFn = 0;
    // backtrack from a current path
    this.backtrack = false;
    // init function name
    this.initializerFnName = "__init__";
    // track derivation
    this.currentBaseDef = { name: "", prev: null };
    // number of free variables currently present
    this.freeVars = 0;
}

Parser.prototype.push = function (val) {
    this.pstack.push(val);
};

Parser.prototype.pop = function () {
    return this.pstack.pop();
};

Parser.prototype.peek = function () {
    return this.pstack[this.pstack.length - 1];
};

Parser.prototype.advance = function () {
    this.previousToken = this.currentToken;
    this.currentToken = this.lexer.getToken();
    if (this.currentToken.type === tokens.TOKEN_ERROR) {
        this.pError(this.currentToken.errorCode); // todo:
    }
};

Parser.prototype.specialMethodNames = function () {
    return [this.initializerFnName, "__str__", "__next__", "__iter__"];
};

Parser.prototype.isDunderFunction = function (name) {
    return name.startsWith("__") && name.endsWith("__");
};

Parser.prototype.isSpecialMethod = function (name) {
    return this.specialMethodNames().includes(name);
};

Parser.prototype.getFreeVar = function (name) {
    return `$var_${name}${this.freeVars++}`;
};

Parser.prototype.lookup = function (name, currentScopeOnly = false) {
    let currentScope = this.currentScope;
    while (currentScope && !(name in currentScope)) {
        if (currentScopeOnly) break;
        currentScope = currentScope.enclosingScope;
    }
    return currentScope && currentScope[name];
};

Parser.prototype.insert = function (name, isConst) {
    this.currentScope[name] = { name, isConst };
};

Parser.prototype.enterScope = function () {
    const newScope = { name: `local-${++this.scopeCount}` };
    newScope.enclosingScope = this.currentScope;
    this.currentScope = newScope;
};

Parser.prototype.leaveScope = function () {
    this.scopeCount--;
    this.currentScope = this.currentScope.enclosingScope;
};

Parser.prototype.enterDerivation = function (baseDef) {
    this.currentBaseDef = { name: baseDef, prev: this.currentBaseDef };
};

Parser.prototype.leaveDerivation = function () {
    this.currentBaseDef = this.currentBaseDef.prev;
};

Parser.prototype.pError = function (errorCode, args) {
    /*
       2 |[EP0002] 'let' keyword used in an indirect assignment context.
         | let x += 5;
         |       ^^
         | Consider changing the operator to '='
     */

    // return if an error was previously reported, helpful when the parser is
    // panicking - to prevent too many error reports/cascading error messages.
    if (this.panicking) return;
    let isWarning = args && args.warn;
    this.hadError = Boolean(!isWarning);
    this.panicking = this.hadError;
    let error = errors.RError[errorCode];
    let warningMsg = isWarning ? "[Warning] " : " ";
    let token = args ? (args["token"] || this.currentToken) : this.currentToken;
    let helpMsg = args ? (args["helpMsg"] || error.helpMsg) : error.helpMsg;
    let helpInfo = "";
    let lineNum = `${token.line}`.padStart(4, " ");
    let errMsg = ` |[${errorCode}]${warningMsg}${error.errorMsg}\n`;
    let padding = "|".padStart(6, " ") + " ";
    let [src, squigglePadding] = this.lexer.getSrcWithPaddingAtLine(token);
    let errSrc = padding + src + "\n";
    let squiggles =
        padding
        + "".padStart(squigglePadding, " ")
        + "^".padStart(token.length, "^")
        + "\n";
    errSrc += squiggles;
    if (helpMsg) {
        helpInfo += padding + "Help:" + "\n"; // todo: remove?
        if (helpMsg.includes(errors.SEP)) {
            helpMsg.split(errors.SEP).forEach((msg) => {
                helpInfo += padding + msg + "\n";
            });
        } else {
            helpInfo += padding + helpMsg + "\n";
        }
    }
    console.error(lineNum + errMsg + errSrc + helpInfo);
};

Parser.prototype.consume = function (tokenType, errorCode) {
    if (this.currentToken.type === tokenType) {
        this.advance();
    } else {
        if (!errorCode) {
            const helpMsg =
                `Expected token '${Token.typeToString(tokenType)}'` +
                `, got '${Token.typeToString(this.currentToken.type)}'`;
            this.pError(errors.EP0001, { helpMsg });
        } else {
            this.pError(errorCode);
        }
    }
};

Parser.prototype.parsePrefix = function () {
    const prefix = BPTable[this.currentToken.type].prefix;
    if (prefix) {
        prefix.call(this);
    } else {
        this.pError(errors.EP0001);
        this.advance();
    }
};

Parser.prototype.parseInfix = function () {
    const infix = BPTable[this.currentToken.type].infix;
    if (infix) {
        infix.call(this);
    } else {
        this.pError(errors.EP0001);
        this.advance();
    }
};

Parser.prototype.parse = function (bp) {
    this.currentBp = { bp, prev: this.currentBp };
    this.parsePrefix();
    while (bp < BPTable[this.currentToken.type].power) {
        this.parseInfix();
    }
    this.currentBp = this.currentBp.prev;
};

Parser.prototype.check = function (tokenType) {
    return this.currentToken.type === tokenType;
};

Parser.prototype.isNotMatching = function (tokenType) {
    return (
        !this.check(tokenType) &&
        !this.check(tokens.TOKEN_EOF) &&
        !this.check(tokens.TOKEN_ERROR) &&
        !this.hadError
    );
};

Parser.prototype.match = function (tokenType) {
    if (this.check(tokenType)) {
        this.advance();
        return true;
    }
    return false;
};

Parser.prototype.expression = function () {
    this.parse(POWER_NONE);
};

function grouping() {
    this.consume(tokens.TOKEN_LEFT_BRACKET);
    if (
        this.check(tokens.TOKEN_RIGHT_BRACKET) ||
        this.check(tokens.TOKEN_DOT_DOT_DOT)
    ) {
        lambdaExpr.call(this);
        return;
    }
    this.expression();
    if (this.check(tokens.TOKEN_COMMA)) {
        lambdaExpr.call(this, this.pop());
        return;
    }
    this.consume(tokens.TOKEN_RIGHT_BRACKET);
    if (this.check(tokens.TOKEN_FAT_ARROW)) {
        lambdaExpr.call(this, this.pop(), true);
    }
}

function number() {
    let val;
    let isInteger = false;
    switch (this.currentToken.type) {
        case tokens.TOKEN_INT_NUMBER:
        case tokens.TOKEN_HEXINT_NUMBER:
            val = Number.parseInt(this.currentToken.value);
            isInteger = true;
            break;
        case tokens.TOKEN_FLOAT_NUMBER:
            val = Number.parseFloat(this.currentToken.value);
            break;
        default:
            utils.unreachable("Parser::number()");
    }
    this.push(new ast.NumberNode(val, isInteger, this.currentToken.line));
    this.advance();
}

function literal() {
    let val;
    const line = this.currentToken.line;
    switch (this.currentToken.type) {
        case tokens.TOKEN_FALSE:
            val = new ast.BooleanNode(false, line);
            break;
        case tokens.TOKEN_TRUE:
            val = new ast.BooleanNode(true, line);
            break;
        case tokens.TOKEN_NULL:
            val = new ast.NullNode(line);
            break;
        default:
            utils.unreachable("Parser::literal()");
    }
    this.push(val);
    this.advance();
}

function stringLiteral() {
    const str = new ast.StringNode(
        this.currentToken.value,
        this.currentToken.length,
        this.currentToken.line
    );
    this.push(str);
    this.advance();
}

function iStringLiteral() {
    // init with previous and current token, as well as the currentScope
    // object for effective tracking of variables during assignment
    // (const, etc.), and correct error reporting.
    let parser = new IStringParser(
        this.lexer,
        this.previousToken,
        this.currentToken,
        this.currentScope
    );
    // parse the istring
    parser.iStringExpression();
    // reset the previous and current token since `parser` would have moved
    // the lexer forward over the initial token values
    this.previousToken = parser.previousToken;
    this.currentToken = parser.currentToken;
    // push to the stack
    this.push(parser.pop());
}

function unary() {
    const op = ast.getOperator(this.currentToken.type);
    let isPreOp = false;
    let code;
    switch (op) {
        case ast.OpType.OPTR_PLUS:
        case ast.OpType.OPTR_MINUS:
        case ast.OpType.OPTR_BW_INVERT:
        case ast.OpType.OPTR_NOT:
            break;
        case ast.OpType.OPTR_PLUS_PLUS:
            isPreOp = true;
            code = errors.EP0025;
            break;
        case ast.OpType.OPTR_MINUS_MINUS:
            isPreOp = true;
            code = errors.EP0026;
            break;
        default:
            utils.unreachable("Parser::unary()");
    }
    const line = this.currentToken.line;
    const token = this.currentToken;
    this.advance();
    this.parse(POWER_UNARY);
    const right = this.pop();

    if (isPreOp) {
        // check if the pre-operation target is valid
        if (
            !(right instanceof ast.VarNode) &&
            !(right instanceof ast.IndexExprNode) &&
            !(right instanceof ast.DotExprNode)
        ) {
            this.pError(code, { token });
        }
        // check for const modification attempts on VarNode (e.g. ++a)
        if (right instanceof ast.VarNode) {
            this.inspectConstAssignment(right.name, { token });
        }
    }

    const unaryNode = new ast.UnaryNode(right, line, op);
    this.push(unaryNode);
}

function binary() {
    const op = ast.getOperator(this.currentToken.type);
    if (!op) {
        this.pError(errors.EP0002);
    }
    const leftNode = this.pop();
    const bPower = BPTable[this.currentToken.type].power;
    this.advance();
    this.parse(bPower);
    const rightNode = this.pop();
    const node = new ast.BinaryNode(leftNode, rightNode, op);
    this.push(node);
}

function pipeExpr() {
    // x |> f -> f(x)
    const leftNode = this.pop();
    const bPower = BPTable[this.currentToken.type].power;
    this.advance();
    const line = this.currentToken.line;
    this.parse(bPower);
    const rightNode = this.pop();
    const node = new ast.CallNode(rightNode, line);
    node.args.push(leftNode);
    this.push(node);
}

function AndExprNode() {
    const left = this.pop();
    const line = this.currentToken.line;
    this.advance(); // skip 'and'
    this.parse(BPTable[this.previousToken.type].power);
    const right = this.pop();
    this.push(new ast.AndExprNode(left, right, line));
}

function OrExprNode() {
    const left = this.pop();
    const line = this.currentToken.line;
    this.advance(); // skip 'or'
    this.parse(BPTable[this.previousToken.type].power);
    const right = this.pop();
    this.push(new ast.OrExprNode(left, right, line));
}

function postfix() {
    const errCode =
        this.currentToken.type === tokens.TOKEN_PLUS_PLUS
            ? errors.EP0025
            : errors.EP0026;
    const left = this.pop();

    if (
        !(left instanceof ast.VarNode) &&
        !(left instanceof ast.IndexExprNode) &&
        !(left instanceof ast.DotExprNode)
    ) {
        this.pError(errCode);
    }

    // check for const modification attempts on VarNode (e.g. a++)
    if (left instanceof ast.VarNode) {
        this.inspectConstAssignment(left.name);
    }
    let node = new ast.PostfixNode(
        left,
        ast.getOperator(this.currentToken.type),
        this.currentToken.line
    );
    this.push(node);
    this.advance();
}

function conditionalExpr() {
    const conditionExpr = this.pop();
    this.consume(tokens.TOKEN_QMARK);
    this.expression();
    const ifExpr = this.pop();
    this.consume(tokens.TOKEN_COLON, errors.EP0010);
    this.expression();
    const elseExpr = this.pop();
    // reusing the IfElseNode ast object, since conditional
    // expressions are if-else statements producing values
    this.push(new ast.IfElseNode(conditionExpr, ifExpr, elseExpr));
}

function ofStmt() {
    // of * -> yyyyy,
    // should always be in the last arm, and should not be
    // mixed with other conditions in the expression:
    // of a, x, * -> something,
    let node = new ast.OfNode(this.currentToken.line);
    let hasPrevExpr = false;
    this.consume(tokens.TOKEN_OF);
    let starToken;
    do {
        if (this.match(tokens.TOKEN_STAR)) {
            starToken = this.previousToken;
            node.hasDefault = true;
            if (hasPrevExpr) {
                // mixed usage: of a, b, * -> ...
                this.pError(errors.EP0009, { token: this.previousToken });
            }
        } else {
            if (node.hasDefault) {
                // mixed usage: of a, b, * -> ...
                this.pError(errors.EP0009, { token: this.previousToken });
            }
            this.expression();
            node.conditions.push(this.pop());
            hasPrevExpr = true;
        }
    } while (this.match(tokens.TOKEN_COMMA));
    this.consume(tokens.TOKEN_ARROW);
    this.statement();
    // check that star arm exists, it is the last arm in the case expression
    if (starToken && !this.check(tokens.TOKEN_RIGHT_CURLY)) {
        // this.pError(errors.EP0001, {helpMsg: errors.RError.EP0016.helpMsg});
        // star arm not the last arm in the expression
        this.pError(errors.EP0016, { token: starToken });
    }
    const bodyNode = this.pop();
    // check if the block is truly a BlockNode,
    // if not, make it a BlockNode
    if (bodyNode.type !== ast.ASTType.AST_NODE_BLOCK) {
        node.block = new ast.BlockNode([bodyNode]);
    } else {
        node.block = bodyNode;
    }
    return node;
}

function listLiteral() {
    let list = new ast.ListNode(this.currentToken.line);
    this.advance();
    if (!this.check(tokens.TOKEN_RIGHT_SQR_BRACKET)) {
        do {
            let line = this.currentToken.line;
            if (this.match(tokens.TOKEN_DOT_DOT_DOT)) {
                this.expression();
                list.nodes.push(new ast.SpreadNode(this.pop(), line));
                list.hasSpread = true;
            } else {
                this.expression();
                list.nodes.push(this.pop());
            }
        } while (this.match(tokens.TOKEN_COMMA));
    }
    // we do not want the list size to exceed the 2 bytes encoding limit
    if (list.nodes.length > utils.UINT16_MAX) {
        // too many items
        this.pError(errors.EP0006);
    }
    if (list.hasSpread) {
        // turn all non-spread params to lists for OP_*_UNPACK opcode
        for (let i = 0, elem = null, tmp; i < list.nodes.length; ++i) {
            elem = list.nodes[i];
            if (elem.type !== ast.ASTType.AST_NODE_SPREAD) {
                tmp = new ast.ListNode(list.line);
                tmp.nodes.push(elem);
                list.nodes[i] = tmp;
            }
        }
    }
    this.consume(tokens.TOKEN_RIGHT_SQR_BRACKET, errors.EP0012);
    this.push(list);
}

function dictLiteral() {
    const node = new ast.DictNode(this.currentToken.line);
    this.advance();
    this.consume(tokens.TOKEN_LEFT_CURLY);
    if (!this.match(tokens.TOKEN_RIGHT_CURLY)) {
        do {
            this.expression();
            const key = this.pop();
            this.consume(tokens.TOKEN_COLON);
            this.expression();
            const value = this.pop();
            node.entries.push([key, value]);
        } while (this.match(tokens.TOKEN_COMMA));
        this.consume(tokens.TOKEN_RIGHT_CURLY);
    }
    if (node.entries.length > utils.UINT16_MAX) {
        // too many items
        this.pError(errors.EP0018);
    }
    this.push(node);
}

function rangeLiteral() {
    let start = this.pop();
    const line = this.currentToken.line;
    this.consume(tokens.TOKEN_DOT_DOT);
    this.parse(BPTable[this.previousToken.type].power);
    let end = this.pop();
    let step = null;
    if (this.match(tokens.TOKEN_DOT_DOT)) {
        this.parse(BPTable[this.previousToken.type].power);
        step = this.pop();
    } else {
        step = new ast.NumberNode(1, true, this.previousToken.line);
    }
    this.push(new ast.RangeNode(start, end, step, line));
}

function indexExpression() {
    let node = this.pop();
    const line = this.currentToken.line;
    // const bp = this.currentBp;
    this.consume(tokens.TOKEN_LEFT_SQR_BRACKET);
    this.expression();
    this.consume(tokens.TOKEN_RIGHT_SQR_BRACKET);
    let indexNode = new ast.IndexExprNode(node, this.pop(), line);
    let op;
    if ((op = ast.getAssignmentOp(this.currentToken.type))) {
        assignmentExpr.call(this, indexNode, op);
    } else {
        this.push(indexNode);
    }
}

function refExpr() {
    // ref.x | ref.foo()
    // treat a `ref` as a regular variable and forward
    // the rest of the expression to dotExpr()
    const line = this.currentToken.line;
    this.push(new ast.VarNode(this.currentToken.value, line));
    this.advance();
    if (this.check(tokens.TOKEN_DOT)) {
        dotExpr.call(this);
    } else if (this.currentToken.value.includes("=")) {
        // can't assign to ref
        this.pError(errors.EP0047);
    }
}

function derefExpr() {
    // deref->foo | deref->bar()
    if (!this.currentBaseDef.name) {
        this.pError(errors.EP0043);
    }
    const line = this.currentToken.line;
    this.push(new ast.VarNode(this.currentToken.value, line));
    this.advance(); // skip `deref`
    // handle the rest of the expression by shelling out to dotExpr()
    dotExpr.call(this);
}

function argsList(args) {
    let hasSpread = false,
        line = this.currentToken.line;
    if (!this.check(tokens.TOKEN_RIGHT_BRACKET)) {
        do {
            let line = this.currentToken.line;
            if (this.match(tokens.TOKEN_DOT_DOT_DOT)) {
                hasSpread = true;
                this.expression();
                args.push(new ast.SpreadNode(this.pop(), line));
            } else {
                this.expression();
                args.push(this.pop());
            }
        } while (this.match(tokens.TOKEN_COMMA));
    }
    if (args.length > utils.MAX_FUNCTION_PARAMS) {
        this.pError(errors.EP0007);
        return hasSpread;
    }
    if (hasSpread) {
        for (let i = 0, elem = null, tmp; i < args.length; ++i) {
            elem = args[i];
            if (elem.type !== ast.ASTType.AST_NODE_SPREAD) {
                tmp = new ast.ListNode(line);
                tmp.nodes.push(elem);
                args[i] = tmp;
            }
        }
    }
    return hasSpread;
}

function dotExpr() {
    const left = this.pop();
    const line = this.currentToken.line;
    const isDeref = this.previousToken.type === tokens.TOKEN_DEREF;
    isDeref ? this.consume(tokens.TOKEN_ARROW) : this.consume(tokens.TOKEN_DOT);
    const node = new ast.DotExprNode(
        left,
        new ast.VarNode(this.parseName(), line),
        line
    );
    node.isDerefExpr = isDeref;
    let op;
    if ((op = ast.getAssignmentOp(this.currentToken.type))) {
        assignmentExpr.call(this, node, op);
    } else if (this.check(tokens.TOKEN_LEFT_BRACKET)) {
        methodCall.call(this, node, isDeref);
    } else {
        this.push(node);
    }
}

function methodCall(node, isDeref) {
    /*
     * isDeref indicates that `node` (DotExprNode) is
     * a dot/arrow expression involving a `deref`.
     * e.g (deref->fx, deref->method()), i.e. dot expressions
     * involving a base def's methods/properties
     */
    const line = this.currentToken.line;
    const args = [];
    this.consume(tokens.TOKEN_LEFT_BRACKET);
    const hasSpread = argsList.call(this, args);
    this.consume(tokens.TOKEN_RIGHT_BRACKET);
    let method;
    if (hasSpread && !isDeref) {
        // use CallNode() in handling spread arg in method call
        method = new ast.CallNode(node, line);
    } else {
        method = new ast.MethodCallNode(node, isDeref, this.currentToken.line);
    }
    method.hasSpread = hasSpread;
    method.args = args;
    this.push(method);
}

function assignmentExpr(indexNode, op) {
    if (this.currentBp.bp <= POWER_ASSIGNMENT) {
        this.advance();
        this.expression();
        let rightNode = this.pop();
        this.push(new ast.AssignNode(indexNode, rightNode, op, indexNode.line));
    } else {
        // error:
        // the binding power wasn't sufficient for the assignment
        // to be processed.
        this.pError(errors.EP0028);
    }
}

function variable() {
    const node = new ast.VarNode(this.parseName(), this.previousToken.line);
    let op;
    if (
        (op = ast.getAssignmentOp(this.currentToken.type)) &&
        this.currentBp.bp <= POWER_ASSIGNMENT
    ) {
        this.inspectConstAssignment(node.name);
        this.advance();
        this.expression();
        const value = this.pop();
        this.push(new ast.AssignNode(node, value, op, node.line));
    } else if (this.check(tokens.TOKEN_FAT_ARROW)) {
        lambdaExpr.call(this, node, true);
    } else {
        this.push(node);
        // check if an operator was specified but the binding power wasn't
        // sufficient for the assignment to be processed.
        if (op !== undefined) {
            this.pError(errors.EP0028);
        }
    }
}

function lambdaExpr(firstParam, skipRightBracket) {
    // (x, y) => expr; | (x, y) => {}
    this.inFunction++;
    const fn = new ast.FunctionNode(null, true, this.currentToken.line);
    // parse parameters if `skipRightBracket` flag is false. This holds only
    // when there are multiple parameters in the lambda function declaration.
    if (!skipRightBracket) {
        this.parseFunctionParams(
            fn,
            firstParam,
            this.check(tokens.TOKEN_DOT_DOT_DOT)
        );
        this.consume(tokens.TOKEN_RIGHT_BRACKET);
    }
    // drops here if there's only one argument
    else if (firstParam) {
        let line = firstParam.line,
            left,
            right;
        // we get an `AssignNode` if a default parameter was declared
        if (firstParam instanceof ast.AssignNode) {
            right = firstParam.rightNode;
            left = firstParam.leftNode;
            fn.defaultParamsCount++;
        } else if (firstParam instanceof ast.VarNode) {
            // else a `VarNode`
            left = firstParam;
        } else {
            this.pError(errors.EP0045, { token: this.previousToken });
        }
        fn.params.push(new ast.ParameterNode(left, right, line));
    }
    this.consume(tokens.TOKEN_FAT_ARROW);
    const beginLine = this.currentToken.line;
    if (!this.check(tokens.TOKEN_LEFT_CURLY)) {
        this.exprStatement();
    } else {
        this.block();
    }
    fn.block = this.pop();
    if (fn.block.type !== ast.ASTType.AST_NODE_BLOCK) {
        const endLine = this.previousToken.line;
        fn.block = new ast.BlockNode([fn.block], beginLine, endLine);
    }
    this.injectReturn(fn.block);
    this.push(fn);
    this.inFunction--;
}

function callExpr() {
    const node = new ast.CallNode(this.pop(), this.currentToken.line);
    this.advance(); // skip '('
    node.hasSpread = argsList.apply(this, [node.args]);
    this.consume(tokens.TOKEN_RIGHT_BRACKET);
    this.push(node);
}

/*
 * methods
 */

Parser.prototype.parseName = function () {
    this.consume(tokens.TOKEN_IDENTIFIER);
    return this.previousToken.value;
};

Parser.prototype.inspectConstAssignment = function (name, args) {
    // check if var is a const todo: fine-tune implementation
    const var_ = this.lookup(name);
    if (var_ && var_.isConst) {
        this.pError(errors.EP0004, args);
    }
};

Parser.prototype.inspectConstRedefinition = function (name, isConst) {
    // check if var is a const todo: fine-tune implementation
    const var_ = this.lookup(name, true);
    if (var_ && isConst) {
        this.pError(errors.EP0013);
    } else if (var_ && var_.isConst) {
        this.pError(errors.EP0027);
    }
};

Parser.prototype.injectReturn = function (blockNode) {
    const decls = blockNode.decls;
    const lastNode = decls[decls.length - 1];
    const insertNullNode = () => {
        const node = new ast.NullNode(this.previousToken.line);
        decls.push(new ast.ReturnNode(node, this.previousToken.line));
    };
    // handle implicit return
    if (!lastNode) {
        insertNullNode();
    } else if (lastNode.type === ast.ASTType.AST_NODE_EXPR) {
        // replace ExprStatementNode with ReturnNode
        decls[decls.length - 1] = new ast.ReturnNode(
            lastNode.expr,
            lastNode.line
        );
    } else {
        // (lastNode.type !== ast.ASTType.AST_NODE_RETURN)
        insertNullNode();
    }
};

Parser.prototype.parseFunctionParams = function (fn, firstParam, atSpread) {
    // f(a, b='a', c=x(), ...d)
    const params = fn.params;
    let hasSpreadParameter = false,
        defaultParamsCount = 0,
        isSpread = false,
        right = null,
        left = null,
        line,
        token;
    // todo: improve this code, it's too gnarly atm.
    if (!this.check(tokens.TOKEN_RIGHT_BRACKET) || firstParam || atSpread) {
        do {
            // ensure spread param is the last param
            if (hasSpreadParameter && this.check(tokens.TOKEN_IDENTIFIER)) {
                // spread parameter not the last parameter
                this.pError(errors.EP0030, { token });
                return;
            }
            // `atSpread` helps enter this loop, when we drop into this function
            // due to a lambda expression having the first parameter to be
            // a spread parameter, i.e. (...x) => {...}
            // so we reset it here after gaining entrance, to prevent it from
            // distorting the loop logic.
            atSpread = false;

            // `firstParam` indicates that a lambda function was encountered,
            // with the first parameter already parsed. We just use it directly
            // if it's available, and also reset it to prevent distorting the
            // loop logic.
            if (firstParam) {
                // handle when dropping from a lambda function
                left = firstParam;
                token = this.previousToken;
                line = this.previousToken.line;
                firstParam = null;
            } else {
                // handle the spread parameter
                if (this.match(tokens.TOKEN_DOT_DOT_DOT)) {
                    if (hasSpreadParameter) {
                        // multiple spread params
                        this.pError(errors.EP0029, {
                            token: this.previousToken,
                        });
                        return;
                    }
                    isSpread = hasSpreadParameter = true;
                }
                line = this.currentToken.line;
                token = this.currentToken;
                variable.call(this);
                left = this.pop();
            }
            if (left instanceof ast.AssignNode) {
                if (isSpread) {
                    // spread parameter can have no default
                    this.pError(errors.EP0033, {
                        token: this.previousToken,
                    });
                    return;
                }
                right = left.rightNode;
                left = left.leftNode;
                defaultParamsCount++;
            } else if (defaultParamsCount && !isSpread) {
                // positional parameter after a default parameter;
                // only a spread parameter is allowed after a parameter
                // with a default value
                this.pError(errors.EP0032, { token: this.previousToken });
                return;
            }
            utils.assert(
                left instanceof ast.VarNode,
                "Parser::parseFunctionParams()"
            );
            // check for duplicate parameter variables
            params.forEach((param) => {
                if (param.leftNode.name === left.name) {
                    this.pError(errors.EP0031, { token });
                }
            });
            if (this.hadError) return;
            // store param
            params.push(new ast.ParameterNode(left, right, line));
            // reset variables for processing of the next parameter
            isSpread = false;
            right = null;
        } while (this.match(tokens.TOKEN_COMMA));
    }
    fn.isVariadic = hasSpreadParameter;
    fn.defaultParamsCount = defaultParamsCount;
    // validate parameter list size of the function
    if (fn.params.length > utils.MAX_FUNCTION_PARAMS) {
        // use the previousToken -
        // the last variable/default parameter consumed
        this.pError(errors.EP0007, { token: this.previousToken });
    }
};

Parser.prototype.handleMethodSymbols = function (fn, token) {
    fn.isSpecial = this.isSpecialMethod(fn.name);
    const isDunder = this.isDunderFunction(fn.name);
    // handle invalid use of 'static'
    if (this.inDefinition) {
        // handle 'static' used with a function marked special
        if (fn.isStatic && fn.isSpecial) {
            this.pError(errors.EP0038, { token });
        } else if (isDunder && !fn.isSpecial) {
            this.pError(errors.EP0044, {
                token: this.previousToken,
                warn: true,
            });
        }
        return;
    }
    // handle `special` functions outside definition
    if (fn.isSpecial) {
        this.pError(errors.EP0015, { token: this.previousToken });
    }
    // warn if a non-special dunder method name is used
    if (isDunder) {
        this.pError(errors.EP0044, { token: this.previousToken, warn: true });
    }
};

Parser.prototype.isInitializerFn = function (fn) {
    return (
        this.inDefinition && fn.isSpecial && fn.name === this.initializerFnName
    );
};

Parser.prototype.purgeReturn = function (blockNode, token) {
    const decls = blockNode.decls;
    const lastNode = decls[decls.length - 1];
    if (lastNode) {
        if (lastNode.type === ast.ASTType.AST_NODE_EXPR) {
            this.pError(errors.EP0040, { token, warn: true });
        } else if (lastNode.type === ast.ASTType.AST_NODE_RETURN) {
            this.pError(errors.EP0039, { token });
        }
    }
    // implicitly inject a return value of `ref`.
    const line = this.previousToken.line;
    decls.push(new ast.ReturnNode(new ast.VarNode("ref", line), line));
};

Parser.prototype.synchronize = function () {
    // reset the panic flag;
    this.panicking = false;
    // skip tokens until we hit a new statement boundary.
    while (this.currentToken.type !== tokens.TOKEN_EOF) {
        switch (this.currentToken.type) {
            case tokens.TOKEN_FOR:
            case tokens.TOKEN_SHOW:
            case tokens.TOKEN_IF:
            case tokens.TOKEN_WHILE:
            case tokens.TOKEN_DO:
            case tokens.TOKEN_LOOP:
            case tokens.TOKEN_CASE:
            case tokens.TOKEN_BREAK:
            case tokens.TOKEN_CONTINUE:
            case tokens.TOKEN_RETURN:
            case tokens.TOKEN_LET:
            case tokens.TOKEN_FN:
            case tokens.TOKEN_STATIC:
            case tokens.TOKEN_DEFINE:
            case tokens.TOKEN_AT:
            case tokens.TOKEN_DERIVE:
            case tokens.TOKEN_PANIC:
                return;
            default: // pass
        }
        this.advance();
    }
};

Parser.prototype.exprStatement = function () {
    const line = this.currentToken.line;
    this.expression();
    const node = new ast.ExprStatementNode(this.pop(), line);
    this.push(node);
};

Parser.prototype.caseStatement = function () {
    // "case"  expression? "{" (of ("*" | expression)
    // ("," ("*" | expression))* "->" statement)+ "}"
    this.consume(tokens.TOKEN_CASE);
    const caseNode = new ast.CaseNode(this.previousToken.line);
    if (!this.check(tokens.TOKEN_LEFT_CURLY)) {
        this.expression();
        caseNode.conditionExpr = this.pop();
    }
    this.consume(tokens.TOKEN_LEFT_CURLY);
    while (this.isNotMatching(tokens.TOKEN_RIGHT_CURLY)) {
        const node = ofStmt.call(this);
        caseNode.arms.push(node);
    }
    this.consume(tokens.TOKEN_RIGHT_CURLY);
    const curlyToken = this.previousToken;
    if (!caseNode.arms.length) {
        // empty case expression
        this.pError(errors.EP0011, { token: curlyToken });
    }
    this.push(caseNode);
};

Parser.prototype.returnStatement = function () {
    if (!this.inFunction) {
        // can't return in top level script
        this.pError(errors.EP0019);
    } else if (this.inInitFn) {
        // can't return in init function
        this.pError(errors.EP0039);
    }
    this.advance();
    const line = this.previousToken.line;
    let node;
    if (!this.check(tokens.TOKEN_SEMI_COLON)) {
        this.expression();
        node = this.pop();
    } else {
        node = new ast.NullNode(line);
    }

    this.push(new ast.ReturnNode(node, line));
};

Parser.prototype.continueStatement = function () {
    if (!this.inLoop) {
        this.pError(errors.EP0005);
    }
    this.push(new ast.ControlNode(this.currentToken.line, false));
    this.advance();
};

Parser.prototype.breakStatement = function () {
    if (!this.inLoop) {
        this.pError(errors.EP0003);
    }
    this.push(new ast.ControlNode(this.currentToken.line, true));
    this.advance();
};

Parser.prototype.unbLoopStatement = function () {
    // loop 0xaceface; loop {forever}
    this.inLoop++;
    this.advance();
    this.statement();
    let body = this.pop();
    this.push(new ast.UnboundedLoopNode(body));
    this.inLoop--;
};

Parser.prototype.forStatement = function () {
    this.inLoop++;
    this.advance();
    if (!this.check(tokens.TOKEN_LEFT_BRACKET)) {
        this.forInStatement();
        return;
    }
    this.consume(tokens.TOKEN_LEFT_BRACKET);
    let initExpr = null,
        conditionExpr = null,
        incExpr = null;
    if (!this.match(tokens.TOKEN_SEMI_COLON)) {
        this.varDecl();
        initExpr = this.pop();
    }
    if (!this.match(tokens.TOKEN_SEMI_COLON)) {
        this.expression();
        conditionExpr = this.pop();
        this.consume(tokens.TOKEN_SEMI_COLON);
    }
    if (!this.match(tokens.TOKEN_RIGHT_BRACKET)) {
        this.expression();
        incExpr = this.pop();
        this.consume(tokens.TOKEN_RIGHT_BRACKET);
    }
    this.statement();
    const block = this.pop();
    this.push(new ast.ForLoopNode(initExpr, conditionExpr, incExpr, block));
    this.inLoop--;
};

Parser.prototype.forInStatement = function () {
    variable.call(this);
    const varNode = this.pop();
    this.consume(tokens.TOKEN_IN);
    this.expression();
    const exprNode = this.pop();
    this.statement();
    let blockNode = this.pop();
    if (blockNode.type !== ast.ASTType.AST_NODE_BLOCK) {
        blockNode = new ast.BlockNode([blockNode]);
    }
    this.push(new ast.ForInLoopNode(varNode, exprNode, blockNode));
};

Parser.prototype.doWhileStatement = function () {
    this.inLoop++;
    this.advance();
    this.block();
    let body = this.pop();
    this.consume(tokens.TOKEN_WHILE);
    this.expression();
    this.consume(tokens.TOKEN_SEMI_COLON, errors.EP0014);
    let conditionExpr = this.pop();
    this.push(new ast.DoWhileLoopNode(conditionExpr, body));
    this.inLoop--;
};

Parser.prototype.whileStatement = function () {
    this.inLoop++;
    this.advance();
    this.expression();
    let conditionExpr = this.pop();
    this.statement();
    let body = this.pop();
    this.push(new ast.WhileLoopNode(conditionExpr, body));
    this.inLoop--;
};

Parser.prototype.ifStatement = function () {
    this.advance();
    this.expression();
    const conditionExpr = this.pop();
    this.statement();
    const ifBlock = this.pop();
    let elseBlock,
        elseLine = null;
    if (this.match(tokens.TOKEN_ELSE)) {
        elseLine = this.previousToken.line;
        this.statement();
        elseBlock = this.pop();
    }
    this.push(new ast.IfElseNode(conditionExpr, ifBlock, elseBlock, elseLine));
};

Parser.prototype.showStatement = function () {
    let node = new ast.ShowNode(this.currentToken.line);
    this.advance();
    this.expression();
    node.nodes.push(this.pop());
    while (this.match(tokens.TOKEN_COMMA)) {
        this.expression();
        node.nodes.push(this.pop());
    }
    if (node.nodes.length >= utils.MAX_FUNCTION_PARAMS) {
        this.pError(errors.EP0007);
    }
    this.push(node);
};

Parser.prototype.tryStatement = function () {
    const line = this.currentToken.line;
    this.advance();
    this.block();
    const tryBlock = this.pop();
    if (tryBlock.type !== ast.ASTType.AST_NODE_BLOCK) {
        this.pError(errors.EP0046);
    }
    this.consume(tokens.TOKEN_EXCEPT);
    let handler = null;
    if (this.match(tokens.TOKEN_LEFT_BRACKET)) {
        variable.call(this);
        handler = this.pop();
        this.consume(tokens.TOKEN_RIGHT_BRACKET);
    }
    this.block();
    const exceptBlock = this.pop();
    if (exceptBlock.type !== ast.ASTType.AST_NODE_BLOCK) {
        this.pError(errors.EP0046);
    }
    let elseBlock = null;
    if (this.match(tokens.TOKEN_ELSE)) {
        this.block();
        elseBlock = this.pop();
        if (elseBlock.type !== ast.ASTType.AST_NODE_BLOCK) {
            this.pError(errors.EP0046);
        }
    }
    this.push(new ast.TryNode(tryBlock, handler, exceptBlock, elseBlock, line));
};

Parser.prototype.panicStatement = function () {
    const line = this.currentToken.line;
    this.advance();
    this.expression();
    this.push(new ast.PanicNode(this.pop(), line));
};

Parser.prototype.funDecl = function () {
    // fn name() {}
    const line = this.currentToken.line;
    let isStatic = false;
    let token = this.currentToken;
    // handle 'static' keyword
    if (this.check(tokens.TOKEN_STATIC)) {
        this.advance();
        if (!this.inDefinition) {
            this.pError(errors.EP0036, { token: this.previousToken });
        }
        isStatic = true;
    }
    this.consume(tokens.TOKEN_FN);
    this.inFunction++;
    const fn = new ast.FunctionNode(this.pop(), false, line);
    fn.isStatic = isStatic; // a static member?
    fn.name = this.parseName();
    // handle invalid use of 'static' and other method symbols
    this.handleMethodSymbols(fn, token);
    this.consume(tokens.TOKEN_LEFT_BRACKET);
    this.parseFunctionParams(fn);
    this.consume(tokens.TOKEN_RIGHT_BRACKET);
    this.isInitializerFn(fn) ? this.inInitFn++ : void 0;
    this.block();
    fn.block = this.pop();
    if (this.inInitFn) {
        this.purgeReturn(fn.block, token);
    } else {
        this.injectReturn(fn.block);
    }
    this.push(fn);
    this.isInitializerFn(fn) ? this.inInitFn-- : void 0;
    this.inFunction--;
};

Parser.prototype.decoratorDecl = function () {
    // skip '@'
    this.advance();
    const token = this.currentToken;
    // @decorator | @decorator(...)
    variable.call(this);
    if (this.check(tokens.TOKEN_LEFT_BRACKET)) {
        callExpr.call(this);
    }
    const decorator = this.pop();
    if (!this.check(tokens.TOKEN_FN)) {
        this.pError(errors.EP0035, { token });
    }
    this.funDecl();
    const fn = this.pop();
    /*
     * `emitDefinition` is a flag that controls the emission of the function's
     * definition instructions by the compiler.
     * we use it here to indicate that the function is being wrapped
     * by a decorator, so the compiler shouldn't emit definition instructions.
     * this is because the function definition will be rewritten (as described
     * below), and we NEED the function on the stack when this happens.
     */
    fn.emitDefinition = false;
    /*
     *  @decorator
     *  fn fun(){...}
     *  |--> let fun = decorator(fun);
     */
    const rvalue = new ast.CallNode(decorator, token.line);
    rvalue.args.push(fn);
    const node = new ast.VarDeclNode(fn.name, rvalue, false, token.line);
    this.push(node);
};

Parser.prototype.defDecl = function (consumeArrow) {
    this.advance();
    this.inDefinition++;
    const line = this.previousToken.line;
    variable.apply(this);
    const node = new ast.DefNode(this.pop(), line);
    // derivations
    if (consumeArrow) {
        this.consume(tokens.TOKEN_ARROW);
        variable.apply(this);
        node.derivingNode = this.pop();
        // deriving from itself
        if (node.derivingNode.name === node.defVar.name) {
            this.pError(errors.EP0042, { token: this.previousToken });
        }
        // set a flag indicating that a derivation is currently occurring
        this.enterDerivation(node.derivingNode.name);
    }
    this.consume(tokens.TOKEN_LEFT_CURLY);
    // methods
    while (this.isNotMatching(tokens.TOKEN_RIGHT_CURLY)) {
        if (this.check(tokens.TOKEN_AT)) {
            // decorators aren't yet supported for methods
            this.pError(errors.EP0041);
        } else {
            this.funDecl();
        }
        const func = this.pop();
        func.fnType = func.isStatic ? func.fnType : ast.FnTypes.TYPE_METHOD;
        /*
         * do not emit instructions to define the function, since that may
         * pop the function off the stack, and we need the function on
         * the stack in order to process it as a method.
         */
        func.emitDefinition = false;
        node.methods.push(new ast.MethodNode(func));
    }
    this.consume(tokens.TOKEN_RIGHT_CURLY);
    this.inDefinition--;
    this.push(node);
    if (consumeArrow) {
        // clear the flag indicating that derivation is done/completed
        this.leaveDerivation();
    }
};

Parser.prototype.varDecl = function () {
    // let const? var.. (= expr)? (, var.. (= expr)?)* ;
    let line = this.currentToken.line;
    this.advance();
    // const ?
    let isConst = false;
    if (this.match(tokens.TOKEN_CONST)) {
        isConst = true;
    }
    let decls = [];
    do {
        const name = this.parseName();
        // check const redefinition
        this.inspectConstRedefinition(name, isConst);
        let value = null;
        // (= expr)?
        if (this.check(tokens.TOKEN_EQUAL)) {
            this.advance();
            this.expression();
            value = this.pop();
        } else {
            value = new ast.NullNode(line);
        }
        this.insert(name, isConst);
        decls.push(new ast.VarDeclNode(name, value, isConst, line));
    } while (this.match(tokens.TOKEN_COMMA));
    this.consume(tokens.TOKEN_SEMI_COLON);
    if (decls.length === 1) {
        this.push(decls[0]);
    } else {
        this.push(new ast.VarDeclListNode(decls));
    }
};

Parser.prototype.statement = function () {
    let consumeSemicolon = false;
    switch (this.currentToken.type) {
        case tokens.TOKEN_SHOW:
            this.showStatement();
            consumeSemicolon = true;
            break;
        case tokens.TOKEN_TRY:
            this.tryStatement();
            break;
        case tokens.TOKEN_PANIC:
            this.panicStatement();
            consumeSemicolon = true;
            break;
        case tokens.TOKEN_LEFT_CURLY:
            this.block();
            break;
        case tokens.TOKEN_IF:
            this.ifStatement();
            break;
        case tokens.TOKEN_WHILE:
            this.whileStatement();
            break;
        case tokens.TOKEN_FOR:
            this.forStatement();
            break;
        case tokens.TOKEN_DO:
            this.doWhileStatement();
            break;
        case tokens.TOKEN_LOOP:
            this.unbLoopStatement();
            break;
        case tokens.TOKEN_CASE:
            this.caseStatement();
            break;
        case tokens.TOKEN_BREAK:
            this.breakStatement();
            consumeSemicolon = true;
            break;
        case tokens.TOKEN_CONTINUE:
            this.continueStatement();
            consumeSemicolon = true;
            break;
        case tokens.TOKEN_RETURN:
            this.returnStatement();
            consumeSemicolon = true;
            break;
        default:
            this.exprStatement();
            consumeSemicolon = true;
    }
    if (consumeSemicolon) {
        this.consume(tokens.TOKEN_SEMI_COLON);
    }
};

Parser.prototype.declaration = function declaration() {
    switch (this.currentToken.type) {
        case tokens.TOKEN_LET:
            this.varDecl();
            break;
        case tokens.TOKEN_FN:
        case tokens.TOKEN_STATIC:
            this.funDecl();
            break;
        case tokens.TOKEN_DEFINE:
            this.defDecl();
            break;
        case tokens.TOKEN_AT:
            this.decoratorDecl();
            break;
        case tokens.TOKEN_DERIVE:
            this.defDecl(true);
            break;
        default:
            this.statement();
    }
    if (this.panicking) this.synchronize();
};

Parser.prototype.block = function () {
    this.enterScope();
    const lineStart = this.currentToken.line;
    this.consume(tokens.TOKEN_LEFT_CURLY);
    const decls = [];
    while (this.isNotMatching(tokens.TOKEN_RIGHT_CURLY)) {
        this.declaration();
        decls.push(this.pop());
    }
    this.consume(tokens.TOKEN_RIGHT_CURLY);
    this.leaveScope();
    this.push(new ast.BlockNode(decls, lineStart, this.previousToken.line));
};

Parser.prototype.program = function program() {
    let node = new ast.ProgramNode();
    while (!this.match(tokens.TOKEN_EOF)) {
        this.declaration();
        node.decls.push(this.pop());
    }
    this.push(node);
};

function IStringParser(lexer, previousToken, currentToken, currentScope) {
    // call parser's constructor with a bogus string, then replace `lexer`
    Parser.call(this, "");
    this.lexer = null; // intentional
    this.lexer = lexer;
    this.previousToken = previousToken;
    this.currentToken = currentToken;
    this.currentScope = currentScope;
}

IStringParser.prototype = Object.create(Parser.prototype);

Object.defineProperty(IStringParser.prototype, "constructor", {
    value: IStringParser,
    writable: true,
    enumerable: false,
});

IStringParser.prototype.replacementExpr = function () {
    this.consume(tokens.TOKEN_LEFT_CURLY);
    this.expression();
    this.consume(tokens.TOKEN_RIGHT_CURLY);
};

IStringParser.prototype.iStringExpression = function () {
    this.advance();
    const node = new ast.IStringNode(this.currentToken.line);
    while (!this.match(tokens.TOKEN_ISTRING_END)) {
        if (this.check(tokens.TOKEN_STRING)) {
            stringLiteral.call(this);
            node.exprs.push(this.pop());
        } else {
            this.replacementExpr();
            node.exprs.push(this.pop());
        }
    }
    this.push(node);
};

function parseSourceInternal(src) {
    const parser = new Parser(src);
    parser.advance();
    parser.program();
    return [parser.hadError ? new ast.ProgramNode() : parser.pop(), parser];
}

function parseSource(src) {
    const [node] = parseSourceInternal(src);
    return node;
}

module.exports = { parseSourceInternal, parseSource };
