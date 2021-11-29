/*
 errors
 */

"use strict";

const SEP = "[[-]]";
const TAB = "\t";
const EL0000 = 'EL0000',  // no error
    EL0001 = 'EL0001',  // (lexer) comments (multiline) not properly closed
    EL0002 = 'EL0002',  // (lexer) unknown token
    EL0003 = 'EL0003',  // (lexer) unclosed string
    EL0004 = 'EL0004',  // (lexer) invalid number token
    EL0005 = 'EL0005',  // (lexer) invalid escape sequence
    EL0006 = 'EL0006',  // (lexer) backslash in interpolation {string}
    EP0001 = 'EP0001',
    EP0002 = 'EP0002',
    EP0003 = 'EP0003',
    EP0004 = 'EP0004',
    EP0005 = 'EP0005',
    EP0006 = 'EP0006',
    EP0007 = 'EP0007',
    EP0008 = 'EP0008',
    EP0009 = 'EP0009',
    EP0010 = 'EP0010',
    EP0011 = 'EP0011',
    EP0012 = 'EP0012',
    EP0013 = 'EP0013',
    EP0014 = 'EP0014',
    EP0015 = 'EP0015',
    EP0016 = 'EP0016',
    EP0017 = 'EP0017',
    EP0018 = 'EP0018',
    EP0019 = 'EP0019',
    EP0020 = 'EP0020',
    EP0021 = 'EP0021',
    EP0022 = 'EP0022',
    EP0023 = 'EP0023',
    EP0024 = 'EP0024',
    EP0025 = 'EP0025',
    EP0026 = 'EP0026',
    EP0027 = 'EP0027',
    EP0028 = 'EP0028',
    EP0029 = 'EP0029',
    EP0030 = 'EP0030',
    EP0031 = 'EP0031',
    EP0032 = 'EP0032',
    EP0033 = 'EP0033',
    EP0034 = 'EP0034',
    EP0035 = 'EP0033',
    EP0036 = 'EP0036',
    EP0037 = 'EP0037',
    EP0038 = 'EP0038',
    EP0039 = 'EP0039',
    EP0040 = 'EP0040',
    EP0041 = 'EP0041',
    EP0042 = 'EP0042',
    EP0043 = 'EP0043',
    EP0044 = 'EP0044',
    EP0045 = 'EP0045',
    EP0046 = 'EP0046',
    EP0047 = 'EP0047',
    EP0048 = 'EP0048',
    EP0049 = 'EP0049',
    EP0050 = 'EP0050',
    EP0051 = 'EP0051',
    EP0052 = 'EP0052',
    EP0053 = 'EP0053',
    EP0054 = 'EP0054',
    EP0055 = 'EP0055',
    EP0056 = 'EP0056',
    EP0057 = 'EP0057',
    EP0058 = 'EP0058',
    EP0059 = 'EP0059',
    EP0060 = 'EP0060'
;


function RError(errorCode, errorMsg, helpMsg) {
    this.code = errorCode;
    this.errorMsg = errorMsg;
    this.helpMsg = helpMsg;
}

function createError(errCode, errMsg, helpMsg = "") {
    return new RError(errCode, errMsg, helpMsg);
}

RError[EL0001] = createError(EL0001,
    "Comment not properly closed",
    "Consider closing the comment with a `*/`");

RError[EL0002] = createError(EL0002,
    "Unknown token",
    "The token found at this context is illegal/unknown.");

RError[EL0003] = createError(EL0003, "String not properly closed");

RError[EL0004] = createError(EL0004,
    "Invalid number token",
    "Some examples of valid numbers include hex (0x12345), " +
    "int (12345), decimal (.12345, 1.2345e-6)");

RError[EL0005] = createError(EL0005,
    "Invalid escape sequence",
    "The escape sequence used isn't recognized. " +
    "Some valid escape sequences are `\\n`, `\\b`, etc.");

RError[EP0001] = createError(EP0001,
    "Found at unexpected position",
    "The token was found at a position it should never have been.");

RError[EP0002] = createError(EP0002,
    "Invalid operator",
    "That isn't a valid/recognized operator. Consider changing it.");

RError[EP0003] = createError(EP0003,
    "break outside loop.",
    "Cannot use the 'break' keyword outside a loop.");

RError[EP0004] = createError(EP0004,
    "Assignment to constant variable.",
    "Cannot assign to a variable declared const.");

RError[EP0005] = createError(EP0005,
    "continue outside loop.",
    "Cannot use the 'continue' keyword outside a loop.");

RError[EL0006] = createError(EL0006,
    "Interpolation string expression part cannot include a backslash.",
    "Consider eliminating the backslash within '{}'.");

RError[EP0006] = createError(EP0006,
    "Too many items in list.",
    "The items found exceeds the maximum list capacity. " +
    "Consider reducing this.");

RError[EP0007] = createError(EP0007,
    "Parameters exceeds 255 limit.",
    `The parameters found exceeds the maximum limit.${SEP}` +
    `You probably don't want to have a function with over 255 arguments,${SEP}` +
    "and even if you do, I can't allow it.");

RError[EP0008] = createError(EP0008,
    "Token found mismatches expected token.");

RError[EP0009] = createError(EP0009,
    "star arm mixed usage",
    "Consider placing star in a separate arm.");

RError[EP0010] = createError(EP0010,
    "Expected ':' after expression.",
    "Consider adding a ':' after the expression.");

RError[EP0011] = createError(EP0011,
    "case expression cannot be empty.",
    "Consider adding 'of' arms.");

RError[EP0012] = createError(EP0012,
    "Expected ']'",
    "Consider closing with a ']'.");

RError[EP0013] = createError(EP0013,
    "Variable redefinition.",
    "Cannot redefine this variable as const because it is already " +
    "defined in this scope.");

RError[EP0014] = createError(EP0014,
    "Expected ';'",
    "Consider adding a ';' to terminate the statement/expression.");

RError[EP0015] = createError(EP0015,
    "Special method outside definition.",
    `You can't use this special method outside a valid definition.${SEP}` +
    "Consider renaming the function.");

RError[EP0016] = createError(EP0016,
    "star arm not last",
    "star arm must be the last arm in a case expression, when used.");

RError[EP0017] = createError(EP0017,
    "Expected ')'",
    "Consider closing with a ')'");

RError[EP0018] = createError(EP0018,
    "Too many items in dict.",
    "The items found exceeds the maximum dict capacity. " +
    "Consider reducing this.");

RError[EP0019] = createError(EP0019,
    "'return' outside function",
    "The 'return' keyword cannot be used in this context.");

RError[EP0020] = createError(EP0020,
    "Cannot use 'self' outside class method.");

RError[EP0021] = createError(EP0021,  // todo: refactor
    "Special method __str__() takes no arguments.",
    "Consider making the method static, or eliminate all arguments " +
    "in the declaration.");

RError[EP0022] = createError(EP0022,
    "Can't use 'super' outside of a class.",
    "Consider eliminating the use of super");

RError[EP0023] = createError(EP0023,
    "Can't use 'super' in a class with no superclass.",
    "Consider eliminating the use of super");

RError[EP0024] = createError(EP0024,
    "A class cannot inherit from itself.",
    "Consider using a different superclass name");

RError[EP0025] = createError(EP0025,
    "Invalid target for ++",
    "The ++ operator is only valid when used with a variable, "
    + "index or dot expression.");

RError[EP0026] = createError(EP0026,
    "Invalid target for --",
    "The -- operator is only valid when used with a variable, "
    + "index or dot expression.");

RError[EP0027] = createError(EP0027,
    "Constant variable redefinition.",
    "Cannot redefine a variable declared const.");

RError[EP0028] = createError(EP0028,
    "Invalid assignment target.",
    "Consider using parenthesis to group assignment if valid.");

RError[EP0029] = createError(EP0029,
    "Multiple spread parameters.",
    "Consider specifying only a single parameter with the spread operator.");

RError[EP0030] = createError(EP0030,
    "Spread parameter not last.",
    "Consider placing the spread parameter as the last " +
    "parameter in the function.");

RError[EP0031] = createError(EP0031,
    "Duplicate parameter found.",
    `Consider renaming the parameter. Multiple parameters having the same${SEP}` +
    "variable name doesn't really make sense.");

RError[EP0032] = createError(EP0032,
    "Positional parameter after default parameter.",
    `Consider placing the positional parameter before the default parameter,` +
    `${SEP}or making the positional parameter a default parameter.${SEP}` +
    `For example:${SEP}` +
    `${TAB}fn foo(x, z="bar", y) {...} can be rewritten as:${SEP}` +
    `${TAB}fn foo(x, y, z="bar") {...} or fn foo(x, z="bar", y="some-default") {...}`);

RError[EP0033] = createError(EP0033,
    "Spread parameter with default value.",
    `A spread parameter cannot have a default value.${SEP}` +
    "Consider eliminating the default value passed.");

RError[EP0034] = createError(EP0034,
    "Trailing comma not supported.",
    `Consider removing the trailing comma; it's currently not supported.`);

RError[EP0035] = createError(EP0035,
    "Decorator without function declaration.",
    `Consider applying a valid decorator to a valid function declaration.${SEP}` +
    `Here's an example:${SEP}` +
    `${TAB}@decorator${SEP}` +
    `${TAB}fn bar(){${SEP}${TAB}  // some code${SEP}${TAB}}`);

RError[EP0036] = createError(EP0036,
    "'static' outside definition.",
    `You can't use the keyword 'static' outside a valid definition.${SEP}` +
    `Consider removing the keyword 'static'.`);

RError[EP0037] = createError(EP0037,  // todo: remove
    "'static' with initializer method",
    `You can't use the keyword 'static' with an initializer method (__init__()).${SEP}` +
    `Consider removing 'static'.`);

RError[EP0038] = createError(EP0038,
    "'static' with special method",
    `You can't use the keyword 'static' with any method marked special.${SEP}` +
    `Consider removing 'static' or eliminating the token '*'.`);

RError[EP0039] = createError(EP0039,
    "'return' in init method",
    `You can't use the 'return' keyword in the special init method.${SEP}` +
    `Consider eliminating the 'return' statement.`);

RError[EP0040] = createError(EP0040,
    "Implicit return in init method",
    `Implicit return is ignored in the special init method.${SEP}` +
    `The last expression statement will not be returned.`);

RError[EP0041] = createError(EP0041,
    "Decorator on method.",
    `Decorators are not yet supported for methods.${SEP}` +
    `Consider removing this.`);

RError[EP0042] = createError(EP0042,
    "Invalid derivation.",
    `A definition cannot derive from itself.${SEP}` +
    `Consider deriving from another definition apart from this.`);

RError[EP0043] = createError(EP0043,
    "deref outside derivation.",
    `'deref' can only be used when deriving from a definition (def).${SEP}` +
    `Consider eliminating the use of 'deref' at this context.`);

RError[EP0044] = createError(EP0044,
    "Use of dunder name.",
    `functions/methods with leading and trailing '__' is reserved for use internally.${SEP}` +
    `Using this now could break your code when it gets adopted in the future.${SEP}` +
    `Consider eliminating the leading and trailing '__'.`);

RError[EP0045] = createError(EP0045,
    "Illegal parameter list.",
    `The parameter defined in the function is illegal.${SEP}` +
    `Consider declaring valid parameter(s).`);


module.exports = {
    RError,
    EL0000,  // no error
    EL0001,  // (lexer) comments (multiline) not properly closed
    EL0002,  // (lexer) unknown token
    EL0003,  // (lexer) unclosed string
    EL0004,  // (lexer) invalid number token
    EL0005,  // (lexer) invalid escape sequence
    EL0006,  // (lexer) backslash in interpolation {string}
    EP0001,
    EP0002,
    EP0003,
    EP0004,
    EP0005,
    EP0006,
    EP0007,
    EP0008,
    EP0009,
    EP0010,
    EP0011,
    EP0012,
    EP0013,
    EP0014,
    EP0015,
    EP0016,
    EP0017,
    EP0018,
    EP0019,
    EP0020,
    EP0021,
    EP0022,
    EP0023,
    EP0024,
    EP0025,
    EP0026,
    EP0027,
    EP0028,
    EP0029,
    EP0030,
    EP0031,
    EP0032,
    EP0033,
    EP0034,
    EP0035,
    EP0036,
    EP0037,
    EP0038,
    EP0039,
    EP0040,
    EP0041,
    EP0042,
    EP0043,
    EP0044,
    EP0045,
    EP0046,
    EP0047,
    EP0048,
    EP0049,
    EP0050,
    EP0051,
    EP0052,
    EP0053,
    EP0054,
    EP0055,
    EP0056,
    EP0057,
    EP0058,
    EP0059,
    EP0060,
    SEP
};