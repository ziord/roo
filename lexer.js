/*
 * lexer
 */

"use strict";

const { assert } = require("./utils");
const tokens = require("./tokens");
const errors = require("./errors");

function Token(src, line, column, tokenType, errorCode) {
    this.value = src;
    this.type = tokenType;
    this.errorCode = errorCode;
    this.length = this.value.length;
    this.line = line;
    this.column = column;
}

Token.prototype.toString = function() {
    return `Token(value='${this.value}', type=${this.type}, ` +
        `line=${this.line}, column=${this.column}, ` +
        `length=${this.length}, errorCode=${this.errorCode})`;
};

Token.typeToString = function(tokenType) {
    switch (tokenType){
        case tokens.TOKEN_SEMI_COLON:           return ";";
        case tokens.TOKEN_LESS_THAN:            return "<";
        case tokens.TOKEN_GREATER_THAN:         return ">";
        case tokens.TOKEN_LEFT_BRACKET:         return "(";
        case tokens.TOKEN_RIGHT_BRACKET:        return ")";
        case tokens.TOKEN_LEFT_SQR_BRACKET:     return "[";
        case tokens.TOKEN_RIGHT_SQR_BRACKET:    return "]";
        case tokens.TOKEN_LEFT_CURLY:           return "{";
        case tokens.TOKEN_RIGHT_CURLY:          return "}";
        case tokens.TOKEN_STAR:                 return "*";
        case tokens.TOKEN_MINUS:                return "-";
        case tokens.TOKEN_PLUS:                 return "+";
        case tokens.TOKEN_F_SLASH:              return "/";
        case tokens.TOKEN_B_SLASH:              return "\\";
        case tokens.TOKEN_COMMA:                return ",";
        case tokens.TOKEN_DOT:                  return ".";
        case tokens.TOKEN_MOD:                  return "%";
        case tokens.TOKEN_EQUAL:                return "=";
        case tokens.TOKEN_QMARK:                return "?";
        case tokens.TOKEN_COLON:                return ":";
        case tokens.TOKEN_BITWISE_AND:          return "&";
        case tokens.TOKEN_BITWISE_XOR:          return "^";
        case tokens.TOKEN_BITWISE_OR:           return "|";
        case tokens.TOKEN_BITWISE_INVERT:       return "~";
        case tokens.TOKEN_LESS_THAN_EQUAL:      return "<=";
        case tokens.TOKEN_GREATER_THAN_EQUAL:   return ">=";
        case tokens.TOKEN_EQUAL_EQUAL:          return "==";
        case tokens.TOKEN_NOT:                  return "!";
        case tokens.TOKEN_NOT_EQUAL:            return "!=";
        case tokens.TOKEN_BITWISE_LSHIFT:       return "<<";
        case tokens.TOKEN_BITWISE_RSHIFT:       return ">>";
        case tokens.TOKEN_MINUS_EQUAL:          return "-=";
        case tokens.TOKEN_PLUS_EQUAL:           return "+=";
        case tokens.TOKEN_DIV_EQUAL:            return "/=";
        case tokens.TOKEN_STAR_EQUAL:           return "*=";
        case tokens.TOKEN_MOD_EQUAL:            return "%=";
        case tokens.TOKEN_LSHIFT_EQUAL:         return "<<=";
        case tokens.TOKEN_RSHIFT_EQUAL:         return ">>=";
        case tokens.TOKEN_AND_EQUAL:            return "&=";
        case tokens.TOKEN_OR_EQUAL:             return "|=";
        case tokens.TOKEN_XOR_EQUAL:            return "^=";
        case tokens.TOKEN_STAR_STAR:            return "**";
        case tokens.TOKEN_STAR_STAR_EQUAL:      return "**=";
        case tokens.TOKEN_ARROW:                return "->";
        case tokens.TOKEN_PLUS_PLUS:            return "++";
        case tokens.TOKEN_MINUS_MINUS:          return "--";
        case tokens.TOKEN_DOT_DOT:              return "..";
        case tokens.TOKEN_HEXINT_NUMBER:        return "hex";
        case tokens.TOKEN_INT_NUMBER:           return "int";
        case tokens.TOKEN_FLOAT_NUMBER:         return "float";
        case tokens.TOKEN_IDENTIFIER:           return "identifier";
        case tokens.TOKEN_STRING:               return "string";
        case tokens.TOKEN_FOR:                  return "for";
        case tokens.TOKEN_OR:                   return "or";
        case tokens.TOKEN_OF:                   return "of";
        case tokens.TOKEN_AND:                  return "and";
        case tokens.TOKEN_DO:                   return "do";
        case tokens.TOKEN_IF:                   return "if";
        case tokens.TOKEN_ELSE:                 return "else";
        case tokens.TOKEN_WHILE:                return "while";
        case tokens.TOKEN_FN:                   return "fn";
        case tokens.TOKEN_NULL:                 return "null";
        case tokens.TOKEN_LET:                  return "let";
        case tokens.TOKEN_TRUE:                 return "true";
        case tokens.TOKEN_FALSE:                return "false";
        case tokens.TOKEN_REF:                  return "ref";
        case tokens.TOKEN_CONST:                return "const";
        case tokens.TOKEN_SHOW:                 return "show";
        case tokens.TOKEN_RETURN:               return "return";
        case tokens.TOKEN_CLASS:                return "class";
        case tokens.TOKEN_DEREF:                return "deref";
        case tokens.TOKEN_BREAK:                return "break";
        case tokens.TOKEN_CONTINUE:             return "continue";
        case tokens.TOKEN_LOOP:                 return "loop";
        case tokens.TOKEN_MATCH:                return "match";
        case tokens.TOKEN_CASE:                 return "case";
        case tokens.TOKEN_STATIC:               return "static";
        case tokens.TOKEN_STRUCT:               return "struct";
        case tokens.TOKEN_ISTRING_START:        return "$";
        case tokens.TOKEN_ISTRING_END:          return "end of $";
        case tokens.TOKEN_DEFINE:               return "define";
        case tokens.TOKEN_DERIVE:               return "derive";
        case tokens.TOKEN_ERROR:                return "ERROR";
        case tokens.TOKEN_EOF:                  return "EOF";
    }
};

function LexerIterator(lexerObj){
    this.lexer = lexerObj;
    this.done = false;
}

LexerIterator.prototype.next = function(){
    let token = this.lexer.getToken();
    // hook to display the EOF token
    if (token.type === tokens.TOKEN_EOF){
        if (!this.done){
            this.done = true;
            return {value: token, done: false};
        }
    }
    return {value: token, done: this.done};
};

function Lexer(src) {
    assert(typeof src === "string",
        "Expected source string");
    this.src = src;
    this.line = 1;
    this.column = 1;
    this.atError = false;
    this.startIndex = 0;
    this.currentIndex = 0;
    this.errorCode = errors.EL0000;
    this.lines = [this.currentIndex];
    this.keywords = new Map(Lexer.keywords());
    this.lexStack = []; //(new.target !== undefined) ? [] : null;
}

Lexer.prototype[Symbol.iterator] = function() {
    return new LexerIterator(this);
};

Lexer.keywords = function() {
    return [
        ["or", tokens.TOKEN_OR], ["of", tokens.TOKEN_OF],
        ["and", tokens.TOKEN_AND], ["break", tokens.TOKEN_BREAK],
        ["if", tokens.TOKEN_IF], ["else", tokens.TOKEN_ELSE],
        ["while", tokens.TOKEN_WHILE], ["null", tokens.TOKEN_NULL],
        ["let", tokens.TOKEN_LET], ["true", tokens.TOKEN_TRUE],
        ["false", tokens.TOKEN_FALSE], ["match", tokens.TOKEN_MATCH],
        ["return", tokens.TOKEN_RETURN], ["do", tokens.TOKEN_DO],
        ["loop", tokens.TOKEN_LOOP], ["for", tokens.TOKEN_FOR],
        ["fn", tokens.TOKEN_FN], ["static", tokens.TOKEN_STATIC],
        ["deref", tokens.TOKEN_DEREF], ["ref", tokens.TOKEN_REF],
        ["show", tokens.TOKEN_SHOW], ["class", tokens.TOKEN_CLASS],
        ["continue", tokens.TOKEN_CONTINUE], ["const", tokens.TOKEN_CONST],
        ["struct", tokens.TOKEN_STRUCT], ["case", tokens.TOKEN_CASE],
        ["define", tokens.TOKEN_DEFINE], ["derive", tokens.TOKEN_DERIVE],
    ];
};

Lexer.prototype.hasStackedLexer = function (){
    return this.lexStack.length > 0;
};

Lexer.prototype.getStackedLexer = function (){
    return this.lexStack[this.lexStack.length - 1];
};

Lexer.prototype.newToken = function(tokenType, value = null) {
    return new Token(value !== null ? value : this.src.slice(
        this.startIndex, this.currentIndex),
        this.line, this.column, tokenType, errors.EL0000);
};

Lexer.prototype.customToken = function(tokenType, value, line, column) {
    return new Token(value, line, column, tokenType, errors.EL0000);
};

Lexer.prototype.eofToken = function() {
    return new Token(
        "", this.line, this.column,
        tokens.TOKEN_EOF, errors.EL0000);
};

Lexer.prototype.errorToken = function(errorCode){
    return new Token(
        this.src.slice(this.startIndex, this.currentIndex),
        this.line, this.column,
        tokens.TOKEN_ERROR, errorCode);
};

Lexer.prototype.move = function() {
    if (this.src[this.currentIndex] === '\n'){
        this.line++;
        this.column = 1;
        this.lines.push(this.currentIndex);
    }else{
        this.column++;
    }
    this.currentIndex++;
    return this.src[this.currentIndex - 1];
};

Lexer.prototype.moveN = function(n){
  while (n--) this.move();
};

Lexer.prototype.getSrcWithPaddingAtLine = function (token){
    /*
     *          currentIndex
     *                |
     *  xyxyxyxyxyxyxyxyxyx  <- lineEnd
     *              ^^  <- token
     */
    let skipNewLine = token.line > 1 ? 1 : 0; // move past '\n' if not at line 1
    let lineStart = this.lines[token.line - 1] + skipNewLine;
    let lineEnd;
    for (lineEnd = lineStart; lineEnd < this.src.length; lineEnd++){
        if ((this.src[lineEnd] === '\r' && this.src[lineEnd + 1] === '\n')
            || (this.src[lineEnd] === '\n'))
        {
            break;
        }
    }
    const src = this.src.slice(lineStart, lineEnd);
    // -1 'cause column starts from 1 not 0.
    // Note that column resets to 1 on every new line
    const errorPadding = (token.column - token.length - 1);
    return [src, errorPadding];
};

Lexer.prototype.getSrcAtLine = function (line){
    const skipNewLine = line > 1 ? 1 : 0;   // move past '\n' if not at line 1
    const lineStart = this.lines[line - 1] + skipNewLine;
    let lineEnd;
    for (lineEnd = lineStart; lineEnd < this.src.length; lineEnd++){
        if ((this.src[lineEnd] === '\r' && this.src[lineEnd + 1] === '\n')
            || (this.src[lineEnd] === '\n'))
        {
            break;
        }
    }
    return this.src.slice(lineStart, lineEnd);
};


Lexer.prototype.atEnd = function() {
    return this.currentIndex >= this.src.length
        || this.src[this.currentIndex] === "";
};

Lexer.prototype.peek = function(n=0){
    return this.src.charAt(this.currentIndex + n);
};

Lexer.prototype.lookAhead = function(len){
    let i = 0;
    while ((this.peek(i).trim() === "" || i < len) && i < this.src.length){
        ++i;
    }
    const start = this.currentIndex + i;
    return this.src.slice(start, start + len);
};

Lexer.prototype.skipLineComment = function(){
    this.moveN(2);
    while (this.move() !== '\n' && !this.atEnd()) {}
};

Lexer.prototype.skipMultiLineComment = function (){
    this.moveN(2);
    while (!this.atEnd()){
        if (this.move() === '*' && this.peek() === '/'){
            // skip '/'
            this.move();
            return;
        }
    }
    this.atError = true;
    this.errorCode = errors.EL0001;
};

Lexer.prototype.skipWhitespace = function(){
    for (;;){
        switch (this.peek()){
            case ' ':
            case '\r':
            case '\t':
            case '\n':
                this.move();
                break;
            case '/':
                const tmp = this.peek(1);
                if (tmp === '/'){
                    this.skipLineComment();
                    break;
                } else if (tmp === '*'){
                    this.skipMultiLineComment();
                    break;
                }else{
                    return;
                }
            default:
                return;
        }
    }
};

function isAlpha(char){
    return (char === '_')
        || (char >= 'A' && char <= 'Z')
        || (char >= 'a' && char <= 'z');
}

function isDigit(char){
    return (char >= '0' && char <= '9');
}

function isXDigit(char){
    return (char >= "A" && char <= "F")
        || (char >= "a" && char <= "f");
}

function checkDigitsOrHex(str, checkHex){
    if (!checkHex){
        return str.split("").every((char) => isDigit(char));
    }
    return str.split("").every((char) => isDigit(char) || isXDigit(char));
}

/*
 *
===========================================
Number      :=  Sign?  Digit+
                | Sign? HexStart HexDigit+
Sign        :=  '+' | '-'
HexStart    :=  '0x' | '0X'
HexDigit    :=  [A-F] | [a-f] | Digit
Digit       :=  [0-9]
===========================================
 */

function isInteger(str){
    if ((str.charAt(0) === '0') &&
        (str.charAt(1).toLowerCase() === 'x')){
        return checkDigitsOrHex(str, true);
    }else if (isDigit(str.charAt(0))){
        return checkDigitsOrHex(str, false);
    }
    return false;
}

/*
==========================================================
Number          :=  Sign? Digit* DecimalPoint Digit+ Exp?
                    | Sign? Digit+ DecimalPoint Digit* Exp?
                    | Sign? Digit+ DecimalPoint? Exp
Number          :=  Sign? Digit* DecimalPoint Digit+ Exp?
Exp             :=  Exponent Sign? Digit+
Exponent        :=  'e' | 'E'
Sign            :=  '+' | '-'
DecimalPoint    :=  '.'
Digit           :=  [0-9]
==========================================================
 */

function isFloat(str) {
    let digitCount = 0, signCount = 0,
        hasExp = 0, hasPoint = 0, currIdx = 0;
    // Sign? Digit+ DecimalPoint Digit* Exp?
    // Sign? Digit+ DecimalPoint? Exp
    // Sign? Digit* DecimalPoint Digit+ Exp?
    if (isDigit(str[currIdx]) || str[currIdx] === '.') {
        while (isDigit(str[currIdx])) {
            currIdx++;
            digitCount++;
        }
        if (str.charAt(currIdx) === ".") {  // DecimalPoint
            hasPoint = 1;
            currIdx++;
        }
        while (isDigit(str.charAt(currIdx))) {  // Digit*
            currIdx++;
            digitCount++;
        }
        if (str.charAt(currIdx).toLowerCase() === "e") { // Exp?
            // check:
            currIdx++;
            hasExp = 1;
            if (str.charAt(currIdx) === "+"
                || str.charAt(currIdx) === "-")
            {
                currIdx++;
                signCount++;
            }
            while (isDigit(str.charAt(currIdx))) { // Digit*
                currIdx++;
                digitCount++;
            }
        }
        return (digitCount + signCount +
            hasExp + hasPoint) === str.length;
    }
    return 0;
}

Lexer.prototype.isKeyword = function(){
    const id = this.src.slice(this.startIndex, this.currentIndex);
    let kwType = this.keywords.get(id);
    if (kwType !== undefined){
        return this.newToken(kwType, id);
    }
    return this.newToken(tokens.TOKEN_IDENTIFIER, id);
};

Lexer.prototype.check = function (char){
    if (!this.atEnd() && (this.peek() === char)){
        this.move();
        return true;
    }
    return false;
};

Lexer.prototype.lexNumber = function(){
    function determine(totalStr, _this) {
        if (isInteger(totalStr)) {
            return _this.newToken(tokens.TOKEN_INT_NUMBER);
        }
        else if (isFloat(totalStr)){
            return _this.newToken(tokens.TOKEN_FLOAT_NUMBER);
        }
        return _this.errorToken(errors.EL0004); // invalid number
    }
    // hex
    if (this.peek(-1) === '0' &&
        this.peek().toLowerCase() === 'x')
    {
        this.move();
        if (isDigit(this.peek()) || isXDigit(this.peek()))
        {
            while (isDigit(this.peek())  || isXDigit(this.peek()))
            {
                this.move();
            }
            return this.newToken(tokens.TOKEN_HEXINT_NUMBER);
        }
    }
    while (isDigit(this.peek())){
        this.move();
    }
    if ((this.peek() === "." && this.peek(1) !== ".")
        || this.peek().toLowerCase() === "e")
    {
        this.move();
        if (this.peek(-1) !== ".") {
            this.move();
            while (isDigit(this.peek())) {
                this.move();
            }
            return determine(this.src.slice(
                this.startIndex, this.currentIndex), this);
        }
        if (this.peek().toLowerCase() === "e") {
            this.moveN(2); // +2 cos we expect the sign
        }
        while (isDigit(this.peek())) {
            this.move();
            if (this.peek().toLowerCase() === "e") {
                this.moveN(2);  // +2 cos we expect the sign
            }
        }
    }
    // check:
    return determine(this.src.slice(
        this.startIndex, this.currentIndex), this);
};

Lexer.prototype.lexIdentifier = function (){
    while (isAlpha(this.peek()) || isDigit(this.peek())){
        this.move();
    }
    return this.isKeyword();
};

Lexer.prototype.lexString = function (start, isIString){
    let str = '', tmp;
    // depth of {} encountered
    let interpCount = 0;
    while (!this.atEnd()){
        tmp = this.move();
        if (isIString){
            if (tmp === '{') interpCount++;
            else if (tmp === '}') interpCount--;
        }
        if (tmp === '\\'){
            if (isIString && interpCount){
                this.move();
                return this.errorToken(errors.EL0006);
            }
            switch(this.peek()){
                case '\\': str += '\\';  break;
                case "'": str += "'";  break;
                case '"': str += '"';  break;
                case 'a': str += '\a';  break;
                case 'b': str += '\b';  break;
                case 'f': str += '\f';  break;
                case 'n': str += '\n';  break;
                case 'r': str += '\r';  break;
                case 't': str += '\t';  break;
                default:
                    return this.errorToken(errors.EL0005);
            }
            this.move();
            continue;
        }
        if (tmp === start){
            break;
        }
        str += tmp;
    }
    if (this.atEnd() && tmp !== start) return this.errorToken(errors.EL0003);
    return this.newToken(tokens.TOKEN_STRING, str);
};

Lexer.prototype.getToken = function() {
    while (this.hasStackedLexer()){
        let lexer = this.getStackedLexer();
        if (!lexer.done){
            const token = lexer.nextToken();
            // check if a new lexer was added to the stacked lexer's
            // `lexStack` array, if so, forward it to the current lexer.
            if (lexer.lexStack.length){
                lexer.lexStack.forEach(newLexer => this.lexStack.push(newLexer));
                lexer.lexStack = [];
            }
            // was the end of the current interpolation string reached?
            // if so skip, and try to obtain another available stacked lexer
            if (token.type === tokens.TOKEN_EOF) continue;
            // else just return the token lexed.
            return token;
        }else{
            // the stacked lexer is done lexing
            this.lexStack.pop();
            // return a sentinel token indicating the end of the iString
            return this.customToken(tokens.TOKEN_ISTRING_END, "",
                lexer.line, lexer.column);
        }
    }
    this.skipWhitespace();
    if (this.atError) return this.errorToken(this.errorCode);
    if (this.atEnd()) return this.eofToken();
    this.startIndex = this.currentIndex;
    let char = this.move();
    if (isAlpha(char)){
        return this.lexIdentifier();
    }else if (isDigit(char)){
        return this.lexNumber();
    }else if (char === '$'){
        const token = this.newToken(tokens.TOKEN_ISTRING_START);
        const startQuote = this.move();
        const currentColumn = this.column;
        const currentLine = this.line;
        const iStringToken = this.lexString(startQuote, true);
        // check if the string contains errors, if so, return the error token
        if (iStringToken.type === tokens.TOKEN_ERROR) return iStringToken;
        const newLexer = new IStringLexer(iStringToken.value, currentColumn, currentLine);
        this.lexStack.push(newLexer);
        return token;
    }
    switch (char) {
        case '{':
            return this.newToken(tokens.TOKEN_LEFT_CURLY);
        case '}':
            return this.newToken(tokens.TOKEN_RIGHT_CURLY);
        case '@':
            return this.newToken(tokens.TOKEN_AT);
        case  ';':
            return this.newToken(tokens.TOKEN_SEMI_COLON);
        case '(':
            return this.newToken(tokens.TOKEN_LEFT_BRACKET);
        case ')':
            return this.newToken(tokens.TOKEN_RIGHT_BRACKET);
        case '[':
            return this.newToken(tokens.TOKEN_LEFT_SQR_BRACKET);
        case ']':
            return this.newToken(tokens.TOKEN_RIGHT_SQR_BRACKET);
        case '\'':
        case '"':
            return this.lexString(char);
        case ',':
            return this.newToken(tokens.TOKEN_COMMA);
        case '.':
            const p = this.peek();
            if (isDigit(p)){
                // check that a space comes before the '.', if not, error
                if (this.peek(-2).trim() !== ""){
                    return this.errorToken(errors.EL0004);
                }
                return this.lexNumber();
            } else if (p === '.'){
                this.move();
                return this.newToken(this.check(".") ?
                    tokens.TOKEN_DOT_DOT_DOT: tokens.TOKEN_DOT_DOT);
            }
            return this.newToken(tokens.TOKEN_DOT);
        case '?':
            return this.newToken(tokens.TOKEN_QMARK);
        case '~':
            return this.newToken(tokens.TOKEN_BITWISE_INVERT);
        case ':':
            return this.newToken(tokens.TOKEN_COLON);
        case '\\':
            return this.newToken(tokens.TOKEN_B_SLASH);  // optional
        case "&":
            return this.newToken(this.check("=") ?
                tokens.TOKEN_AND_EQUAL : tokens.TOKEN_BITWISE_AND);
        case "!":
            return this.newToken(this.check("=") ?
                tokens.TOKEN_NOT_EQUAL : tokens.TOKEN_NOT);
        case "|":
            return this.newToken(this.check("=") ?
                tokens.TOKEN_OR_EQUAL : tokens.TOKEN_BITWISE_OR);
        case '^':
            return this.newToken(this.check("=") ?
                tokens.TOKEN_XOR_EQUAL : tokens.TOKEN_BITWISE_XOR);
        case "=":
            return this.newToken(this.check("=") ?
                tokens.TOKEN_EQUAL_EQUAL : this.check(">") ?
                    tokens.TOKEN_FAT_ARROW : tokens.TOKEN_EQUAL);
        case "%":
            return this.newToken(this.check("=") ?
                tokens.TOKEN_MOD_EQUAL : tokens.TOKEN_MOD);
        case "/":
            return this.newToken(this.check("=") ?
                tokens.TOKEN_DIV_EQUAL : tokens.TOKEN_F_SLASH);
        case "+":
            return this.newToken(this.check("+") ?
                tokens.TOKEN_PLUS_PLUS : this.check("=") ?
                    tokens.TOKEN_PLUS_EQUAL : tokens.TOKEN_PLUS);
        // bitwise
        case "<":
            return this.newToken(this.check("<") ?
                (this.check("=") ?
                    tokens.TOKEN_LSHIFT_EQUAL : tokens.TOKEN_BITWISE_LSHIFT) :
                this.check("=") ?
                    tokens.TOKEN_LESS_THAN_EQUAL : tokens.TOKEN_LESS_THAN);
        case ">":
            return this.newToken(this.check(">") ?
                (this.check("=") ?
                    tokens.TOKEN_RSHIFT_EQUAL : tokens.TOKEN_BITWISE_RSHIFT) :
                (this.check("=") ?
                    tokens.TOKEN_GREATER_THAN_EQUAL : tokens.TOKEN_GREATER_THAN));
        case "-":
            return this.newToken(this.check("-") ?
                tokens.TOKEN_MINUS_MINUS : this.check(">") ?
                    tokens.TOKEN_ARROW : this.check("=") ?
                        tokens.TOKEN_MINUS_EQUAL : tokens.TOKEN_MINUS);
        case "*":
            return this.newToken(this.check("*") ?
                    (this.check("=") ?
                        tokens.TOKEN_STAR_STAR_EQUAL : tokens.TOKEN_STAR_STAR) :
                    (this.check("=") ?
                        tokens.TOKEN_STAR_EQUAL : tokens.TOKEN_STAR));
        default:
            return this.errorToken(errors.EL0002); // unknown token
    }
};

function IStringLexer(src, currentColumn, currentLine){
    Lexer.call(this, src);
    this.column = currentColumn;
    this.line = currentLine;
    this.done = false;
    this.curlyCount = 0;
}

IStringLexer.prototype = Object.create(Lexer.prototype);
IStringLexer.prototype.constructor = IStringLexer;

IStringLexer.prototype.nextSubstring = function (){
    // $"{'{' + $'{fox}' + '}'}" | $'awesome {fox}'
    while (!this.atEnd()){
        this.move();
        if (this.peek() === '{'){
            // return a string token if we encounter '{' while
            // lexing the current string. This enables the lexer to shell out
            // the responsibility of handling tokens within '{}' to getToken(),
            // as seen in nextToken()
            return this.newToken(tokens.TOKEN_STRING);
        }
    }
    this.done = true;
    return this.newToken(tokens.TOKEN_STRING);
};

IStringLexer.prototype.nextToken = function(){
    if (this.atEnd()){
        this.done = true;
        return this.eofToken();
    }
    if (this.curlyCount){
        // skip skippable whitespace since we're within a '{}'
        // which contains expressions
        this.skipWhitespace();
    }
    let current = this.peek();
    if (current === '{'){
        this.curlyCount++;
        this.move();
        return this.newToken(tokens.TOKEN_LEFT_CURLY, '{');
    } else if (current === '}'){
        this.curlyCount--;
        this.move();
        return this.newToken(tokens.TOKEN_RIGHT_CURLY, '}');
    }
    // curlyCount indicates that tokens may be present within the '{}'
    if (this.curlyCount){
        return this.getToken();
    }
    this.startIndex = this.currentIndex;
    return this.nextSubstring();
};

module.exports = {Token, Lexer};