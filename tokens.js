/*
 * tokens.js
 */

module.exports = {
    // single character tokens
    TOKEN_SEMI_COLON: "TOKEN_SEMI_COLON",           // ;
    TOKEN_LESS_THAN: "TOKEN_LESS_THAN",            // <
    TOKEN_GREATER_THAN: "TOKEN_GREATER_THAN",         // >
    TOKEN_LEFT_BRACKET: "TOKEN_LEFT_BRACKET",         // (
    TOKEN_RIGHT_BRACKET: "TOKEN_RIGHT_BRACKET",        // )
    TOKEN_LEFT_SQR_BRACKET: "TOKEN_LEFT_SQR_BRACKET",     // [
    TOKEN_RIGHT_SQR_BRACKET: "TOKEN_RIGHT_SQR_BRACKET",    // ]
    TOKEN_LEFT_CURLY: "TOKEN_LEFT_CURLY",           // {
    TOKEN_RIGHT_CURLY: "TOKEN_RIGHT_CURLY",          // }
    TOKEN_STAR: "TOKEN_STAR",                 // *
    TOKEN_MINUS: "TOKEN_MINUS",                // -
    TOKEN_PLUS: "TOKEN_PLUS",                 // +
    TOKEN_F_SLASH: "TOKEN_F_SLASH",              // /
    TOKEN_B_SLASH: "TOKEN_B_SLASH",              // '\'
    TOKEN_COMMA: "TOKEN_COMMA",                // ,
    TOKEN_DOT: "TOKEN_DOT",                  // .
    TOKEN_MOD: "TOKEN_MOD",                  // %
    TOKEN_EQUAL: "TOKEN_EQUAL",                // =
    TOKEN_QMARK: "TOKEN_QMARK",                // ?
    TOKEN_COLON: "TOKEN_COLON",                // :
    TOKEN_BITWISE_AND: "TOKEN_BITWISE_AND",          // &
    TOKEN_BITWISE_XOR: "TOKEN_BITWISE_XOR",          // ^
    TOKEN_BITWISE_OR: "TOKEN_BITWISE_OR",           // |
    TOKEN_BITWISE_INVERT: "TOKEN_BITWISE_INVERT",        // ~

    // two character tokens
    // TOKEN_DOUBLE_LEFT_CURLY: "TOKEN_DOUBLE_LEFT_CURLY",        // {{
    // TOKEN_DOUBLE_RIGHT_CURLY: "TOKEN_DOUBLE_LEFT_CURLY",        // }}
    TOKEN_LESS_THAN_EQUAL: "TOKEN_LESS_THAN_EQUAL",      // <=
    TOKEN_GREATER_THAN_EQUAL: "TOKEN_GREATER_THAN_EQUAL",   // >=
    TOKEN_EQUAL_EQUAL: "TOKEN_EQUAL_EQUAL",          // ==
    TOKEN_NOT: "TOKEN_NOT",                  // !
    TOKEN_NOT_EQUAL: "TOKEN_NOT_EQUAL",            // !=
    TOKEN_BITWISE_LSHIFT: "TOKEN_BITWISE_LSHIFT",        // <<
    TOKEN_BITWISE_RSHIFT: "TOKEN_BITWISE_RSHIFT",       // >>
    TOKEN_MINUS_EQUAL: "TOKEN_MINUS_EQUAL",          // -=
    TOKEN_PLUS_EQUAL: "TOKEN_PLUS_EQUAL",           // +=
    TOKEN_DIV_EQUAL: "TOKEN_DIV_EQUAL",           // /=
    TOKEN_STAR_EQUAL: "TOKEN_STAR_EQUAL",          // *=
    TOKEN_MOD_EQUAL: "TOKEN_MOD_EQUAL",          // %=
    TOKEN_LSHIFT_EQUAL: "TOKEN_LSHIFT_EQUAL",         // <<=
    TOKEN_RSHIFT_EQUAL: 'TOKEN_RSHIFT_EQUAL',         // <<=
    TOKEN_AND_EQUAL: 'TOKEN_AND_EQUAL',           // &=
    TOKEN_OR_EQUAL: 'TOKEN_OR_EQUAL',            // |=
    TOKEN_XOR_EQUAL: 'TOKEN_XOR_EQUAL',           // ^=
    TOKEN_STAR_STAR: 'TOKEN_STAR_STAR',         // **
    TOKEN_STAR_STAR_EQUAL: 'TOKEN_STAR_STAR_EQUAL',   // **=
    TOKEN_ARROW: 'TOKEN_ARROW',             // ->
    TOKEN_FAT_ARROW: 'TOKEN_FAT_ARROW',     // =>
    TOKEN_PLUS_PLUS: 'TOKEN_PLUS_PLUS',        // ++
    TOKEN_MINUS_MINUS: 'TOKEN_MINUS_MINUS',      // --
    TOKEN_DOT_DOT: 'TOKEN_DOT_DOT',          // ..
    TOKEN_DOT_DOT_DOT: 'TOKEN_DOT_DOT_DOT',          // ...

    // literal tokens
    TOKEN_HEXINT_NUMBER: 'TOKEN_HEXINT_NUMBER',    // 0x...
    TOKEN_INT_NUMBER: 'TOKEN_INT_NUMBER',       // 23...4
    TOKEN_FLOAT_NUMBER: 'TOKEN_FLOAT_NUMBER',     // 23...4 | 2.43e-1
    TOKEN_IDENTIFIER: 'TOKEN_IDENTIFIER',       // abc
    TOKEN_STRING: 'TOKEN_STRING',           // "..."
    TOKEN_ISTRING_START: 'TOKEN_ISTRING_START',  // $"..."
    TOKEN_ISTRING_END: 'TOKEN_ISTRING_END',      // end of $"..."

    // keyword tokens
    TOKEN_FOR: 'TOKEN_FOR',              // for
    TOKEN_OR: 'TOKEN_OR',               // or
    TOKEN_OF: 'TOKEN_OF',               // of
    TOKEN_AND: 'TOKEN_AND',              // and
    TOKEN_DO: 'TOKEN_DO',               // do
    TOKEN_IF: 'TOKEN_IF',               // if
    TOKEN_ELSE: 'TOKEN_ELSE',             // else
    TOKEN_WHILE: 'TOKEN_WHILE',            // while
    TOKEN_FN: 'TOKEN_FN',               // fn
    TOKEN_NULL: 'TOKEN_NULL',             // null
    // TOKEN_VAR: 'TOKEN_VAR',              // var  // todo: remove
    TOKEN_LET: 'TOKEN_LET',              // let
    TOKEN_TRUE: 'TOKEN_TRUE',             // true
    TOKEN_FALSE: 'TOKEN_FALSE',            // false
    TOKEN_SELF: 'TOKEN_SELF',             // self
    TOKEN_CONST: 'TOKEN_CONST',            // const
    TOKEN_SHOW: 'TOKEN_SHOW',             // show
    TOKEN_RETURN: 'TOKEN_RETURN',           // return
    TOKEN_CLASS: 'TOKEN_CLASS',            // class
    TOKEN_SUPER: 'TOKEN_SUPER',            // super
    TOKEN_BREAK: 'TOKEN_BREAK',            // break
    TOKEN_CONTINUE: 'TOKEN_CONTINUE',         // continue
    TOKEN_LOOP: 'TOKEN_LOOP',             // loop
    TOKEN_MATCH: 'TOKEN_MATCH',           // match
    TOKEN_CASE: 'TOKEN_CASE',             // case
    TOKEN_STATIC: 'TOKEN_STATIC',           // static
    TOKEN_STRUCT: 'TOKEN_STRUCT',           // struct

    // others
    TOKEN_ERROR: 'TOKEN_ERROR',
    TOKEN_EOF: 'TOKEN_EOF'
};
