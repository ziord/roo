/*
 * parser.js
 */

"use strict";

const ast = require("./ast");
const errors = require("./errors");
const tokens = require("./tokens");
const { Token, Lexer } = require("./lexer");
const { assert, out, print, unreachable, error, UINT16_COUNT } = require("./utils");

// token-type -> binding-power | prefix | infix

/*
 * Binding Powers
 */
const POWER_NONE = 0,
    POWER_ASSIGNMENT = 1,         // = | *= | += | /= | &= ...
    POWER_CONDITIONAL_EXPR = 2,   // cond ? expr : expr
    POWER_OR = 3,               // or
    POWER_AND = 4,              // and
    POWER_BITWISE_OR = 5,       // |
    POWER_BITWISE_XOR = 6,      // ^
    POWER_BITWISE_AND = 7,      // &
    POWER_EQUALITY = 8,         // == | !=
    POWER_COMPARISON = 9,       // >= | <= | > | <
    POWER_BITWISE_SHIFT = 10,   // >> | <<
    POWER_TERM = 11,            // + | -
    POWER_FACTOR = 12,          // * | / | ** | %
    POWER_UNARY = 13,           // - | + | ~ | ! | ++ | --
    POWER_POSTFIX = 14,         // ++ | -- | [..]
    POWER_CALL = 15;            // . | ( )

function bp(power, prefix, infix) {
    return { power, prefix, infix };
}

/*
 * Binding Power Table
 */
function BPTable() {
}

BPTable[tokens.TOKEN_SEMI_COLON] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_LESS_THAN] = bp(POWER_COMPARISON, null, binary); // d
BPTable[tokens.TOKEN_GREATER_THAN] = bp(POWER_COMPARISON, null, binary);  // d
BPTable[tokens.TOKEN_LEFT_BRACKET] = bp(POWER_CALL, grouping, callExpr);
BPTable[tokens.TOKEN_RIGHT_BRACKET] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_LEFT_SQR_BRACKET] = bp(POWER_POSTFIX, listLiteral, indexExpression);
BPTable[tokens.TOKEN_RIGHT_SQR_BRACKET] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_LEFT_CURLY] = bp(POWER_NONE, dictLiteral, null);
BPTable[tokens.TOKEN_RIGHT_CURLY] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_STAR] = bp(POWER_FACTOR, null, binary);  // d
BPTable[tokens.TOKEN_MINUS] = bp(POWER_TERM, unary, binary);  // d
BPTable[tokens.TOKEN_PLUS] = bp(POWER_TERM, unary, binary);  // d
BPTable[tokens.TOKEN_F_SLASH] = bp(POWER_FACTOR, null, binary);  // d
BPTable[tokens.TOKEN_B_SLASH] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_COMMA] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_DOT] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_MOD] = bp(POWER_FACTOR, null, binary);  // d
BPTable[tokens.TOKEN_EQUAL] = bp(POWER_ASSIGNMENT, null, null);
BPTable[tokens.TOKEN_QMARK] = bp(POWER_CONDITIONAL_EXPR, null, conditionalExpr);
BPTable[tokens.TOKEN_COLON] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_BITWISE_AND] = bp(POWER_BITWISE_AND, null, binary);  // d
BPTable[tokens.TOKEN_BITWISE_XOR] = bp(POWER_BITWISE_XOR, null, binary);  // d
BPTable[tokens.TOKEN_BITWISE_OR] = bp(POWER_BITWISE_OR, null, binary);   // d
BPTable[tokens.TOKEN_BITWISE_INVERT] = bp(POWER_UNARY, unary, null);  // d
BPTable[tokens.TOKEN_LESS_THAN_EQUAL] = bp(POWER_COMPARISON, null, binary);  // d
BPTable[tokens.TOKEN_GREATER_THAN_EQUAL] = bp(POWER_COMPARISON, null, binary);  // d
BPTable[tokens.TOKEN_EQUAL_EQUAL] = bp(POWER_EQUALITY, null, binary);  // d
BPTable[tokens.TOKEN_NOT] = bp(POWER_UNARY, unary, null);   // d
BPTable[tokens.TOKEN_NOT_EQUAL] = bp(POWER_EQUALITY, null, binary);  // d
BPTable[tokens.TOKEN_BITWISE_LSHIFT] = bp(POWER_BITWISE_SHIFT, null, binary);  // d
BPTable[tokens.TOKEN_BITWISE_RSHIFT] = bp(POWER_BITWISE_SHIFT, null, binary);  // d
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
BPTable[tokens.TOKEN_STAR_STAR] = bp(POWER_FACTOR, null, binary);  // d
BPTable[tokens.TOKEN_STAR_STAR_EQUAL] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_ARROW] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_FAT_ARROW] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_PLUS_PLUS] = bp(POWER_POSTFIX, unary, postfix);
BPTable[tokens.TOKEN_MINUS_MINUS] = bp(POWER_POSTFIX, unary, postfix);
BPTable[tokens.TOKEN_DOT_DOT] = bp(POWER_CALL, null, rangeLiteral);  // d
BPTable[tokens.TOKEN_HEXINT_NUMBER] = bp(POWER_NONE, number, null);  // d
BPTable[tokens.TOKEN_INT_NUMBER] = bp(POWER_NONE, number, null);  // d
BPTable[tokens.TOKEN_FLOAT_NUMBER] = bp(POWER_NONE, number, null);  // d
BPTable[tokens.TOKEN_IDENTIFIER] = bp(POWER_NONE, variable, null);
BPTable[tokens.TOKEN_ISTRING_START] = bp(POWER_NONE, iStringLiteral, null);  // d
BPTable[tokens.TOKEN_ISTRING_END] = bp(POWER_NONE, null, null);  // d
BPTable[tokens.TOKEN_STRING] = bp(POWER_NONE, stringLiteral, null);  // d
BPTable[tokens.TOKEN_FOR] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_OR] = bp(POWER_OR, null, OrExprNode);
BPTable[tokens.TOKEN_OF] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_AND] = bp(POWER_AND, null, AndExprNode);
BPTable[tokens.TOKEN_DO] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_IF] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_ELSE] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_WHILE] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_FN] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_NULL] = bp(POWER_NONE, literal, null);
BPTable[tokens.TOKEN_LET] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_TRUE] = bp(POWER_NONE, literal, null);    // d
BPTable[tokens.TOKEN_FALSE] = bp(POWER_NONE, literal, null);    // d
BPTable[tokens.TOKEN_SELF] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_CONST] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_SHOW] = bp(POWER_NONE, null, null);  // d
BPTable[tokens.TOKEN_RETURN] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_CLASS] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_SUPER] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_BREAK] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_CONTINUE] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_LOOP] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_MATCH] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_CASE] = bp(POWER_NONE, caseExpr, null);
BPTable[tokens.TOKEN_STATIC] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_STRUCT] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_ERROR] = bp(POWER_NONE, null, null);
BPTable[tokens.TOKEN_EOF] = bp(POWER_NONE, null, null);

function Parser(src) {
    this.atError = false;
    this.lexer = new Lexer(src);
    this.currentToken = null;
    this.previousToken = null;
    // a linked object of binding powers - for assignment
    this.currentBp = { bp: POWER_NONE, prev: null };
    this.pstack = [];
    // a chain of environments used for tracking constness
    this.currentScope = { name: "global", enclosingScope: null };
    this.scopeCount = 1;
    this.inLoop = 0;
    this.inFunction = 0;
    this.backtrack = false;
}

Parser.prototype.push = function(val) {
    this.pstack.push(val);
};

Parser.prototype.pop = function() {
    return this.pstack.pop();
};

Parser.prototype.advance = function() {
    this.previousToken = this.currentToken;
    this.currentToken = this.lexer.getToken();
    if (this.currentToken.type === tokens.TOKEN_ERROR) {
        this.pError(this.currentToken.errorCode);  // todo:
    }
};

Parser.prototype.lookAhead = function (tokenLen){
    return this.lexer.lookAhead(tokenLen);
};

Parser.prototype.lookup = function(name, currentScopeOnly = false) {
    let currentScope = this.currentScope;
    while (currentScope && !(name in currentScope)) {
        if (currentScopeOnly) break;
        currentScope = currentScope.enclosingScope;
    }
    return currentScope && currentScope[name];
};

Parser.prototype.insert = function(name, isConst) {
    this.currentScope[name] = { name, isConst };
};

Parser.prototype.enterScope = function() {
    const newScope = { name: `local-${++this.scopeCount}` };
    newScope.enclosingScope = this.currentScope;
    this.currentScope = newScope;
};

Parser.prototype.leaveScope = function() {
    this.scopeCount--;
    this.currentScope = this.currentScope.enclosingScope;
};

Parser.prototype.pError = function(errorCode, args) {
    /*
       2 |[EP0002] 'let' keyword used in an indirect assignment context.
         | let x += 5;
         |       ^^
         | Consider changing the operator to '='
     */
    this.atError = true; // todo
    let error = errors.RError[errorCode];
    let token = args ? (args["token"] || this.currentToken) : this.currentToken;
    let helpMsg = args ? (args["helpMsg"] || error.helpMsg) : error.helpMsg;
    let lineNum = `${token.line}`.padStart(4, " ");
    let errMsg = ` |[${errorCode}] ${error.errorMsg}\n`;
    let padding = "|".padStart(6, " ") + " ";
    let [src, squigglePadding] = this.lexer.getSrcWithPaddingAtLine(token);
    let errSrc = padding + src + "\n";
    let squiggles = padding + "".padStart(squigglePadding, " ")
        + "^".padStart(token.length, "^")
        + "\n";
    errSrc += squiggles;
    helpMsg ? errSrc += (padding + helpMsg + "\n") : void 0;
    console.error(lineNum + errMsg + errSrc);
    process.exit(-1);
};

Parser.prototype.consume = function(tokenType, errorCode) {
    if (this.currentToken.type === tokenType) {
        this.advance();
    } else {
        if (!errorCode) {
            const helpMsg = `Expected token '${Token.typeToString(tokenType)}'`
                + `, got '${Token.typeToString(this.currentToken.type)}'`;
            this.pError(errors.EP0001, { helpMsg });
        } else {
            this.pError(errorCode);
        }
    }
};

Parser.prototype.parsePrefix = function() {
    const prefix = BPTable[this.currentToken.type].prefix;
    if (prefix) {
        prefix.call(this);
    } else {
        this.pError(errors.EP0001);
    }
};

Parser.prototype.parseInfix = function() {
    const infix = BPTable[this.currentToken.type].infix;
    if (infix) {
        infix.call(this);
    } else {
        this.pError(errors.EP0001);
    }
};

Parser.prototype.parse = function(bp) {
    this.currentBp = { bp, prev: this.currentBp };
    this.parsePrefix();
    while (bp < BPTable[this.currentToken.type].power) {
        this.parseInfix();
    }
    this.currentBp = this.currentBp.prev;
};

Parser.prototype.check = function(tokenType) {
    return this.currentToken.type === tokenType;
};

Parser.prototype.match = function(tokenType) {
    if (this.check(tokenType)) {
        this.advance();
        return true;
    }
    return false;
};

Parser.prototype.expression = function() {
    this.parse(POWER_NONE);
};

function grouping() {
    this.consume(tokens.TOKEN_LEFT_BRACKET);
    if (this.check(tokens.TOKEN_RIGHT_BRACKET)) {
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
            unreachable("Parser::number()");
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
            unreachable("Parser::literal()");
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
        this.lexer, this.previousToken,
        this.currentToken, this.currentScope
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
            unreachable("Parser::unary()");
    }
    const line = this.currentToken.line;
    const token = this.currentToken;
    this.advance();
    this.parse(POWER_UNARY);
    const right = this.pop();

    if (isPreOp) {
        // check if the pre-operation target is valid
        // todo: update for dotExpr
        if (!(right instanceof ast.VarNode) &&
            !(right instanceof ast.IndexExprNode)) {
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
    const errCode = (this.currentToken.type === tokens.TOKEN_PLUS_PLUS) ?
        errors.EP0025 : errors.EP0026;
    const left = this.pop();

    // todo: update for DotExpr
    if (!(left instanceof ast.VarNode) &&
        !(left instanceof ast.IndexExprNode)) {
        this.pError(errCode);
    }

    // check for const modification attempts on VarNode (e.g. a++)
    if (left instanceof ast.VarNode) {
        this.inspectConstAssignment(left.name);
    }
    let node = new ast.PostfixNode(left,
        ast.getOperator(this.currentToken.type),
        this.currentToken.line);
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
    this.push(new ast.IfElseNode(
        conditionExpr, ifExpr, elseExpr));
}

function ofExpr() {
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
    this.statement(true);
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
    // inspect the last ast node in the block
    const lastExpr = node.block.decls[node.block.decls.length - 1];
    // if it is an expression statement, convert it to the expression itself,
    // if not, just push a NullNode expression.
    // we convert an expression statement to the expression itself, because
    // expression statements get popped off the vm's stack (after evaluation),
    // we do not want this because 'case' expressions produce results.
    if (lastExpr.type !== ast.ASTType.AST_NODE_EXPR) {
        node.block.decls.push(new ast.NullNode(this.previousToken.line));
    } else {
        node.block.decls[node.block.decls.length - 1] = lastExpr.expr;
    }
    return node;
}

function caseExpr() {
    // "case"  expression? "{" (of ("*" | expression)
    // ("," ("*" | expression))* "->" statement)+ "}"
    this.consume(tokens.TOKEN_CASE);
    const caseNode = new ast.CaseNode(this.previousToken.line);
    if (!this.check(tokens.TOKEN_LEFT_CURLY)){
        this.expression();
        caseNode.conditionExpr = this.pop();
    }
    this.consume(tokens.TOKEN_LEFT_CURLY);
    while (!this.check(tokens.TOKEN_RIGHT_CURLY)
        && !this.check(tokens.TOKEN_EOF)
        && !this.check(tokens.TOKEN_ERROR))
    {
        const node = ofExpr.call(this);
        caseNode.arms.push(node);
        if (!this.check(tokens.TOKEN_RIGHT_CURLY)){
            this.consume(tokens.TOKEN_COMMA);
        }
    }
    const line = this.previousToken.line;
    this.consume(tokens.TOKEN_RIGHT_CURLY);
    const curlyLine = this.previousToken.line;
    if (!caseNode.arms.length) {
        // empty case expression
        this.pError(errors.EP0011);
    }
    const lastArm = caseNode.arms[caseNode.arms.length - 1];
    // if the last arm isn't a star arm, create a synthetic star arm
    if (!lastArm.hasDefault) {
        const starArm = new ast.OfNode(line);
        starArm.hasDefault = true;
        starArm.block = new ast.BlockNode(
            [new ast.NullNode(line)], null, curlyLine
        );
        caseNode.arms.push(starArm);
    }
    this.push(caseNode);
}

function listLiteral() {
    let list = new ast.ListNode(this.currentToken.line);
    this.advance();
    if (!this.check(tokens.TOKEN_RIGHT_SQR_BRACKET)) {
        this.expression();
        list.nodes.push(this.pop());
        while (this.match(tokens.TOKEN_COMMA)) {
            this.expression();
            list.nodes.push(this.pop());
        }
    }
    // we do not want the list size to exceed the 2 bytes encoding limit
    if (list.nodes.length >= UINT16_COUNT) {
        // too many items
        this.pError(errors.EP0006);
    }
    this.consume(tokens.TOKEN_RIGHT_SQR_BRACKET, errors.EP0012);
    this.push(list);
}

function dictLiteral(fromBlock) {
    let node = new ast.DictNode(this.currentToken.line);
    if (fromBlock) {
        this.consume(tokens.TOKEN_COLON);
        const key = this.pop();
        this.expression();
        node.entries.push([key, this.pop()]); // key, value pair
        this.match(tokens.TOKEN_COMMA);
    } else {
        this.consume(tokens.TOKEN_LEFT_CURLY);
    }
    while (!this.check(tokens.TOKEN_RIGHT_CURLY)
        && !this.check(tokens.TOKEN_EOF)
        && !this.check(tokens.TOKEN_ERROR))
    {
        this.expression();
        const key = this.pop();
        this.consume(tokens.TOKEN_COLON);
        this.expression();
        const value = this.pop();
        node.entries.push([key, value]);
        this.match(tokens.TOKEN_COMMA);
    }
    this.consume(tokens.TOKEN_RIGHT_CURLY);
    if (node.entries.length >= UINT16_COUNT) {
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
        indexExprAssignment.call(this, indexNode, op);
    } else {
        this.push(indexNode);
    }
}

function indexExprAssignment(indexNode, op) {
    if (this.currentBp.bp <= POWER_ASSIGNMENT) {
        this.advance();
        this.expression();
        let rightNode = this.pop();
        this.push(new ast.IndexExprAssignNode(
            indexNode, rightNode, op, indexNode.line));
    } else {
        // error:
        // the binding power wasn't sufficient for the assignment
        // to be processed.
        this.pError(errors.EP0028);
    }
}

Parser.prototype.ExprStatement = function() {
    const line = this.currentToken.line;
    this.expression();
    if (this.check(tokens.TOKEN_COLON)) {
        this.backtrack = true;
        dictLiteral.call(this, true);
    }
    // todo: hook here
    const node = new ast.ExprStatementNode(this.pop(), line);
    this.push(node);
};

Parser.prototype.parseName = function() {
    this.consume(tokens.TOKEN_IDENTIFIER);
    return this.previousToken.value;
};

Parser.prototype.inspectConstAssignment = function(name, args) {
    // check if var is a const todo: fine-tune implementation
    const var_ = this.lookup(name);
    if (var_ && var_.isConst) {
        this.pError(errors.EP0004, args);
    }
};

Parser.prototype.inspectConstRedefinition = function(name, isConst) {
    // check if var is a const todo: fine-tune implementation
    const var_ = this.lookup(name, true);
    if (var_ && isConst){
        this.pError(errors.EP0013);
    }else if (var_ && var_.isConst) {
        this.pError(errors.EP0027);
    }
};

function variable() {
    const node = new ast.VarNode(
        this.parseName(),
        this.previousToken.line);
    let op;
    if ((op = ast.getAssignmentOp(this.currentToken.type)) &&
        (this.currentBp.bp <= POWER_ASSIGNMENT))
    {
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
    const params = firstParam ? [firstParam] : [];
    this.inFunction++;
    if (!skipRightBracket) {
        while (!this.check(tokens.TOKEN_RIGHT_BRACKET)
            && !this.check(tokens.TOKEN_EOF)
            && !this.check(tokens.TOKEN_ERROR))
        {
            this.consume(tokens.TOKEN_COMMA);
            variable.call(this);
            params.push(this.pop());
        }
        this.consume(tokens.TOKEN_RIGHT_BRACKET);
    }
    this.consume(tokens.TOKEN_FAT_ARROW);
    const fn = new ast.FunctionNode(null, true);
    const beginLine = this.currentToken.line;
    this.statement(true);
    fn.block = this.pop();
    if (fn.block.type !== ast.ASTType.AST_NODE_BLOCK) {
        const endLine = this.previousToken.line;
        fn.block = new ast.BlockNode([fn.block], beginLine, endLine);
    }
    fn.params = params;
    this.injectReturn(fn.block);
    this.push(fn);
    this.inFunction--;
}

function callExpr() {
    const node = new ast.CallNode(
        this.pop(), this.currentToken.line
    );
    this.advance(); // skip '('
    while (!this.check(tokens.TOKEN_RIGHT_BRACKET)
        && !this.check(tokens.TOKEN_EOF)
        && !this.check(tokens.TOKEN_ERROR))
    {
        this.expression();
        node.args.push(this.pop());
        this.match(tokens.TOKEN_COMMA);
    }
    if (node.args.length > 0xff) {
        this.pError(errors.EP0007);
    }
    this.consume(tokens.TOKEN_RIGHT_BRACKET);
    this.push(node);
}

/*
 * prototype assignments
 */

Parser.prototype.returnStatement = function() {
    if (!this.inFunction) {
        this.pError(errors.EP0019);
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

Parser.prototype.injectReturn = function(blockNode) {
    const lastNode = blockNode.decls[blockNode.decls.length - 1];
    const decls = blockNode.decls;
    // handle implicit return
    if (lastNode.type === ast.ASTType.AST_NODE_EXPR) {
        // replace ExprStatement with Return node
        decls[decls.length - 1] = new ast.ReturnNode(lastNode.expr, lastNode.line);
    } else if (lastNode.type !== ast.ASTType.AST_NODE_RETURN) {
        const node = new ast.NullNode(this.previousToken.line);
        decls.push(new ast.ReturnNode(node, this.previousToken.line));
    }
};

Parser.prototype.funDecl = function() {
    // fn name() {}
    const line = this.currentToken.line;
    this.advance();
    this.inFunction++;
    const fn = new ast.FunctionNode(this.pop(), false, line);
    fn.name = this.parseName();
    this.consume(tokens.TOKEN_LEFT_BRACKET);
    while (!this.check(tokens.TOKEN_RIGHT_BRACKET)
        && !this.check(tokens.TOKEN_EOF)
        && !this.check(tokens.TOKEN_ERROR))
    {
        variable.call(this);
        fn.params.push(this.pop());
        this.match(tokens.TOKEN_COMMA);
    }
    if (fn.params.length > 0xff) {
        this.pError(errors.EP0007);
    }
    this.consume(tokens.TOKEN_RIGHT_BRACKET);
    this.block();
    fn.block = this.pop();
    this.injectReturn(fn.block);
    this.push(fn);
    this.inFunction--;
};

Parser.prototype.continueStatement = function() {
    if (!this.inLoop) {
        this.pError(errors.EP0005);
    }
    this.push(new ast.ControlNode(
        this.currentToken.line, false
    ));
    this.advance();
    // this.consume(tokens.TOKEN_SEMI_COLON);
};

Parser.prototype.breakStatement = function() {
    if (!this.inLoop) {
        this.pError(errors.EP0003);
    }
    this.push(new ast.ControlNode(
        this.currentToken.line, true
    ));
    this.advance();
    // this.consume(tokens.TOKEN_SEMI_COLON);
};

Parser.prototype.unbLoopStatement = function() {
    // loop 0xaceface; loop {forever}
    this.inLoop++;
    this.advance();
    this.statement();
    let body = this.pop();
    this.push(new ast.UnboundedLoopNode(body));
    this.inLoop--;
};

Parser.prototype.forStatement = function() {
    this.inLoop++;
    this.advance();
    this.consume(tokens.TOKEN_LEFT_BRACKET);
    let initExpr = null, conditionExpr = null, incExpr = null;
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
    this.push(new ast.ForLoopNode(
        initExpr, conditionExpr, incExpr, block
    ));
    this.inLoop--;
};

Parser.prototype.doWhileStatement = function() {
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

Parser.prototype.whileStatement = function() {
    this.inLoop++;
    this.advance();
    this.expression();
    let conditionExpr = this.pop();
    this.statement();
    let body = this.pop();
    this.push(new ast.WhileLoopNode(conditionExpr, body));
    this.inLoop--;
};

Parser.prototype.ifStatement = function() {
    this.advance();
    this.expression();
    const conditionExpr = this.pop();
    this.statement();
    const ifBlock = this.pop();
    let elseBlock;
    if (this.match(tokens.TOKEN_ELSE)) {
        this.statement();
        elseBlock = this.pop();
    }
    this.push(new ast.IfElseNode(
        conditionExpr, ifBlock, elseBlock
    ));
};

Parser.prototype.showStatement = function() {
    let node = new ast.ShowNode(this.currentToken.line);
    this.advance();
    this.expression();
    node.nodes.push(this.pop());
    while (this.match(tokens.TOKEN_COMMA)) {
        this.expression();
        node.nodes.push(this.pop());
    }
    if (node.nodes.length >= 256) {
        this.pError(errors.EP0007);
    }
    this.push(node);
};

Parser.prototype.varDecl = function() {
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

Parser.prototype.statement = function(forgetSemi) { // , lookAhead, str
    let consumeSemicolon = false;
    switch (this.currentToken.type) {
        case tokens.TOKEN_SHOW:
            this.showStatement();
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
            this.ExprStatement();
            consumeSemicolon = true;
    }
    if (forgetSemi) { // from lambdaExpr()
        return;
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
            this.funDecl();
            break;
        default:
            this.statement();
    }
};

Parser.prototype.block = function() {
    this.enterScope();
    const lineStart = this.currentToken.line;
    this.consume(tokens.TOKEN_LEFT_CURLY);
    let decls = [];
    while (!this.check(tokens.TOKEN_RIGHT_CURLY)
        && !this.check(tokens.TOKEN_EOF)
        && !this.check(tokens.TOKEN_ERROR))
    {
        this.declaration();
        // are we really in a block? we're not if for example,
        // the declaration found was a dict {'k': v} expression
        if (this.backtrack) {
            this.leaveScope();
            // clear the backtrack flag to indicate we're no
            // longer in a backtracking state
            this.backtrack = false;
            return;
        }
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
    this.lexer = null;  // intentional
    this.lexer = lexer;
    this.previousToken = previousToken;
    this.currentToken = currentToken;
    this.currentScope = currentScope;
}

IStringParser.prototype = Object.create(Parser.prototype);

Object.defineProperty(
    IStringParser.prototype,
    "constructor", {
        value: IStringParser, writable: true, enumerable: false
    }
);

IStringParser.prototype.replacementExpr = function() {
    this.consume(tokens.TOKEN_LEFT_CURLY);
    this.expression();
    this.consume(tokens.TOKEN_RIGHT_CURLY);
};

IStringParser.prototype.iStringExpression = function() {
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
    let parser = new Parser(src);
    parser.advance();
    parser.program();
    return [parser.pop(), parser];
}

function parseSource(src) {
    const [node] = parseSourceInternal(src);
    return node;
}

module.exports = { parseSourceInternal, parseSource };
