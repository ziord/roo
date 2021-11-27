"use strict";

const ast = require("../parser/ast");
const ASTType = ast.ASTType;

/*
 *   x  | int   | float | bool
 * ---------------------------
 * int  | int   | float | int
 * ----------------------------
 * float| float | float | float
 * ----------------------------
 * bool | int   | float | int
 * ----------------------------
 */
/*
 * TODO:
 *  - work on correctness
 *  - work on error messages
 *  - refactor, and ensure robustness
 */
class ConstantFolder extends ast.AST{
    constructor(root, parser){
        super();
        this.root = root;
        this.lineGen = parser.lexer;
    }

    visit(node){
        const prop = `visit${node.constructor.name}`;
        return Reflect.apply(this[prop], this, [node]);
    }

    isConstant(node){
        switch(node.type){
            case ASTType.AST_NODE_NUMBER:
            case ASTType.AST_NODE_STRING:
            case ASTType.AST_NODE_BOOL:     return true;
            default:                        return false;
        }
    }

    getASTType(node){
        switch (node.type) {
            case ASTType.AST_NODE_BOOL:
            case ASTType.AST_NODE_NUMBER:
                return ASTType.AST_NODE_NUMBER;
            default: return node.type;
        }
    }

    isInteger(leftNode, rightNode){
        return !(!leftNode.isInteger || !rightNode.isInteger);
    }

    oError(msg){
        // todo: improve error reporting.
        throw new Error(msg);
    }

    bwErrorMsg(leftNode, rightNode, op){
        const getType = ((n) => (n.isInteger) ?
            (n.type === ASTType.AST_NODE_BOOL) ? "bool" : "int" : "float");
        return `Unsupported types for operand ${op}: ` +
            `'${getType(leftNode)}' and '${getType(rightNode)}'`;
    }

    applyNumBinaryOp(leftNode, op, rightNode, originNode){
        let isInteger = this.isInteger(leftNode, rightNode);
        let res;
        switch (op){
            case ast.OpType.OPTR_PLUS:
                res = leftNode.value + rightNode.value;
                break;
            case ast.OpType.OPTR_MINUS:
                res = leftNode.value - rightNode.value;
                break;
            case ast.OpType.OPTR_MUL:
                res = leftNode.value * rightNode.value;
                break;
            case ast.OpType.OPTR_POW:
                res = leftNode.value ** rightNode.value;
                break;
            case ast.OpType.OPTR_DIV:
                if (rightNode.value === 0){
                    this.oError("Attempt to divide by zero");
                }
                isInteger = false;
                res = leftNode.value / rightNode.value;
                break;
            case ast.OpType.OPTR_MOD:
                if (rightNode.value === 0){
                    this.oError("Attempt to divide by zero");
                }
                res = leftNode.value % rightNode.value;
                break;
            case ast.OpType.OPTR_BW_LSHIFT:
                if (!isInteger) this.oError(
                    this.bwErrorMsg(leftNode, rightNode, "<<"));
                res = leftNode.value << rightNode.value;
                break;
            case ast.OpType.OPTR_BW_RSHIFT:
                if (!isInteger) this.oError(
                    this.bwErrorMsg(leftNode, rightNode, ">>"));
                res = leftNode.value >> rightNode.value;
                break;
            case ast.OpType.OPTR_BW_AND:
                if (!isInteger) this.oError(
                    this.bwErrorMsg(leftNode, rightNode, "&"));
                res = leftNode.value & rightNode.value;
                break;
            case ast.OpType.OPTR_BW_XOR:
                if (!isInteger) this.oError(
                    this.bwErrorMsg(leftNode, rightNode, "^"));
                res = leftNode.value ^ rightNode.value;
                break;
            case ast.OpType.OPTR_BW_OR:
                if (!isInteger) this.oError(
                    this.bwErrorMsg(leftNode, rightNode, "|"));
                res = leftNode.value | rightNode.value;
                break;
            // conditional ops
            case ast.OpType.OPTR_OR:
                res = leftNode.value || rightNode.value;
                break;
            case ast.OpType.OPTR_AND:
                res = leftNode.value && rightNode.value;
                break;
            // relational ops
            case ast.OpType.OPTR_LT:
                res = leftNode.value < rightNode.value;
                return new ast.BooleanNode(res, leftNode.line);
            case ast.OpType.OPTR_GT:
                res = leftNode.value > rightNode.value;
                return new ast.BooleanNode(res, leftNode.line);
            case ast.OpType.OPTR_LEQ:
                res = leftNode.value <= rightNode.value;
                return new ast.BooleanNode(res, leftNode.line);
            case ast.OpType.OPTR_GEQ:
                res = leftNode.value >= rightNode.value;
                return new ast.BooleanNode(res, leftNode.line);
            case ast.OpType.OPTR_EQEQ:
                res = leftNode.value === rightNode.value;
                return new ast.BooleanNode(res, leftNode.line);
            case ast.OpType.OPTR_NEQ:
                res = leftNode.value !== rightNode.value;
                return new ast.BooleanNode(res, leftNode.line);
            // -- todo -- remove
            case ast.OpType.OPTR_COND:
            case ast.OpType.OPTR_EQ:
            case ast.OpType.OPTR_PLUS_PLUS:
            case ast.OpType.OPTR_MINUS_MINUS:
            case ast.OpType.OPTR_MINUS_ASSIGN:
            case ast.OpType.OPTR_PLUS_ASSIGN:
            case ast.OpType.OPTR_DIV_ASSIGN:
            case ast.OpType.OPTR_MUL_ASSIGN:
            case ast.OpType.OPTR_MOD_ASSIGN:
            case ast.OpType.OPTR_BW_LSHIFT_ASSIGN:
            case ast.OpType.OPTR_BW_RSHIFT_ASSIGN:
            case ast.OpType.OPTR_BW_AND_ASSIGN:
            case ast.OpType.OPTR_BW_OR_ASSIGN:
            case ast.OpType.OPTR_BW_XOR_ASSIGN:
            case ast.OpType.OPTR_POW_ASSIGN:
                return originNode;
            default:
                this.oError("Illegal operator used in binary context");
        }
        return new ast.NumberNode(res, isInteger, leftNode.line);
    }

    applyStringBinaryOp(leftNode, op, rightNode, originNode){
        let res;
        switch (op){
            case ast.OpType.OPTR_PLUS:
                res = leftNode.value + rightNode.value;
                break;
            case ast.OpType.OPTR_NEQ:
                res = leftNode.value !== rightNode.value;
                return new ast.BooleanNode(res, leftNode.line);
            case ast.OpType.OPTR_EQEQ:
                res = leftNode.value === rightNode.value;
                return new ast.BooleanNode(res, leftNode.line);
            case ast.OpType.OPTR_OR:
                res = leftNode.value || rightNode.value;
                break;
            case ast.OpType.OPTR_AND:
                res = leftNode.value && rightNode.value;
                break;
            // -- todo -- remove
            case ast.OpType.OPTR_PLUS_PLUS:
            case ast.OpType.OPTR_MINUS_MINUS:
            case ast.OpType.OPTR_MINUS_ASSIGN:
            case ast.OpType.OPTR_PLUS_ASSIGN:
            case ast.OpType.OPTR_DIV_ASSIGN:
            case ast.OpType.OPTR_MUL_ASSIGN:
            case ast.OpType.OPTR_MOD_ASSIGN:
            case ast.OpType.OPTR_BW_LSHIFT_ASSIGN:
            case ast.OpType.OPTR_BW_RSHIFT_ASSIGN:
            case ast.OpType.OPTR_BW_AND_ASSIGN:
            case ast.OpType.OPTR_BW_OR_ASSIGN:
            case ast.OpType.OPTR_BW_XOR_ASSIGN:
            case ast.OpType.OPTR_POW_ASSIGN:
                return originNode;
            default:
                this.oError("Illegal operator used in binary context");
        }
        return new ast.StringNode(res, res.length, leftNode.line);
    }

    applyNumUnaryOp(op, node){
        let res;
        switch (op){
            case ast.OpType.OPTR_MINUS:
                res = -node.value;
                break;
            case ast.OpType.OPTR_BW_INVERT:
                res = ~node.value;
                break;
            case ast.OpType.OPTR_PLUS:
                break;
            case ast.OpType.OPTR_NOT:
                return new ast.BooleanNode(!node.value, node.line);
            case ast.OpType.OPTR_PLUS_PLUS:
            case ast.OpType.OPTR_MINUS_MINUS:
                this.oError("Invalid unary target");
        }
        return new ast.NumberNode(res, node.isInteger, node.line);
    }

    applyStringUnaryOp(op, node){
        if (op === ast.OpType.OPTR_NOT) {
            return new ast.BooleanNode(!node.value, node.line);
        }else{
            this.oError("Illegal operator used in unary context");
        }
    }

    rewriteNode(node, newName, newType){

    }

    visitNumberNode(node){
        return node;
    }

    visitStringNode(node){
        return node;
    }

    visitBooleanNode(node){
        // todo: return number instead ?
        return node;
    }

    visitUnaryNode(node){
        const newNode = this.visit(node.node);
        if (this.isConstant(newNode)){
            if (this.getASTType(newNode) === ASTType.AST_NODE_NUMBER){
                return this.applyNumUnaryOp(node.op, newNode);
            }else if (this.getASTType(newNode) === ASTType.AST_NODE_STRING){
                return this.applyStringUnaryOp(node.op, newNode);
            }
        }
        node.node = newNode;
        return node;
    }

    visitBinaryNode(node){
        const left = this.visit(node.leftNode);
        const right = this.visit(node.rightNode);

        if (this.isConstant(left) && this.isConstant(right)){
            if (this.getASTType(left) === ASTType.AST_NODE_NUMBER
                && this.getASTType(right) === ASTType.AST_NODE_NUMBER)
            {
                return this.applyNumBinaryOp(left, node.op, right, node);
            }else if (left.type === ASTType.AST_NODE_STRING
                && right.type === ASTType.AST_NODE_STRING)
            {
                return this.applyStringBinaryOp(left, node.op, right, node);
            }
            // todo: catch errors from illegal use of operators here
        }
        node.leftNode = left;
        node.rightNode = right;
        return node;
    }

    visitListNode(node) {
        let items = [];
        node.nodes.forEach((item) => items.push(this.visit(item)));
        node.nodes = items;
        return node;
    }

    visitRangeNode(node){
        node.startNode = this.visit(node.startNode);
        node.endNode = this.visit(node.endNode);
        node.stepNode = this.visit(node.stepNode);
        return node;
    }

    visitIndexExprNode(node){
        node.leftExpr = this.visit(node.leftExpr);
        node.indexExpr = this.visit(node.indexExpr);
        return node;
    }

    visitNullNode(node) {
        return node;
    }

    visitShowNode(node) {
        let items = [];
        node.nodes.forEach((expr) => items.push(this.visit(expr)));
        node.nodes = items;
        return node;
    }

    fold(){
        return this.visit(this.root);
    }
}

module.exports = { ConstantFolder };
