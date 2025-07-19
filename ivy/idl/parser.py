import json
from typing import Dict, List, Mapping, Optional, Tuple
from pygments.lexers.c_cpp import CLexer
from pygments.token import Token, _TokenType
from ty import CFunction, CVariable, CFile, CStruct
import sys

def parse_pragma(comment: str) -> Optional[str]:
    comment = comment.strip()
    if comment.startswith("///"):
        comment = comment[3:]
    elif comment.startswith("/*"):
        comment = comment[2:-2]
    elif comment.startswith("//"):
        comment = comment[2:]
    comment = comment.strip()
    if comment.startswith("#idl"):
        comment = comment[4:].strip()
        return comment
    return None

def parse_statement(statement: List[_TokenType]) -> Optional[CVariable]:
    """Parse a statement to extract variable type, name, is_const, and value if it's a state variable declaration."""
    type_ = ""
    name = ""
    is_const = False
    depth = 0
    the_value = None

    for kind, value in statement:
        # If we're after eq sign, it all goes to value
        if the_value is not None:
            the_value += value
            continue

        # If depth > 0, it all goes to type
        if depth > 0:
            type_ += value
            if kind == Token.Punctuation:
                if value in "([<":
                    depth += 1
                elif value in ")]>" and depth > 0:
                    depth -= 1
            continue

        if kind == Token.Punctuation:
            if type_ == "":
                print("exit: punct")
                return None  # Type must come before punctuation
            if value in "([<":
                depth += 1
                type_ += value
                continue
        elif kind == Token.Operator and value == "=":
            # found eq!
            the_value = ""
        elif kind in Token.Keyword and value == "const":
            is_const = True
        elif kind in Token.Keyword.Type:
            type_ = type_ or value
        elif kind in Token.Name:
            if not type_:
                type_ = value
            else:
                name = name or value
    if type_ == "" or len(name) == 0:
        return None

    if the_value is not None:
        the_value = the_value.strip()
    return CVariable(type_, name, is_const, the_value, None)

class TokenStream:
    def __init__(self, tokens: list[tuple[_TokenType, str]]):
        self.tokens = tokens
        self.position = 0

    def peek(self) -> Optional[tuple[_TokenType, str]]:
        if self.position < len(self.tokens):
            return self.tokens[self.position]
        else:
            return None

    def next(self) -> tuple[_TokenType, str]:
        if self.position < len(self.tokens):
            token = self.tokens[self.position]
            self.position += 1
            return token
        else:
            raise Exception("No more tokens")

    def has_more(self) -> bool:
        """Returns True if there are more tokens to process."""
        return self.position < len(self.tokens)

# parses a struct. expects to begin at the first token after `struct`
# should start at depth = 1 and return control at depth = 1
def parse_struct(ts: TokenStream) -> tuple[str, List[CVariable]]:
    struct_name = ""
    struct_vars = []

    # Skip until opening brace
    while ts.has_more():
        kind, value = ts.next()
        if kind in Token.Name and not struct_name:
            # If we find the name, great!
            struct_name = value
        if kind == Token.Punctuation and value == "{":
            break

    # Parse struct body
    depth = 1
    statement = []
    pragma = None

    while ts.has_more() and depth > 0:
        token = ts.next()
        kind, value = token

        if kind == Token.Punctuation and value == "{":
            depth += 1
        elif kind == Token.Punctuation and value == "}":
            depth -= 1
            if depth == 0:
                break  # End of struct
        elif kind == Token.Punctuation and value == ";" and depth == 1:
            # Parse statement to extract struct members
            result = parse_statement(statement)
            if result is not None:
                result.pragma = pragma
                struct_vars.append(result)
            pragma = None
            statement = []
        elif kind in Token.Comment:
            pragma = pragma or parse_pragma(value)
        else:
            # Collect tokens for the current statement
            statement.append(token)

    # Skip to semicolon
    while ts.has_more():
        kind, value = ts.next()
        if kind in Token.Name and not struct_name:
            # If we find the name, great!
            struct_name = value
        if kind == Token.Punctuation and value == ";":
            break

    return struct_name, struct_vars

def parse_function(tokens: List[_TokenType]) -> Optional[CFunction]:
    name = ""
    # Find first name token before '('
    for kind, value in tokens:
        if kind in Token.Name:
            if value:
                name = value
        elif kind in Token.Punctuation and value == "(":
            if name:
                return CFunction(name, None)
            else:
                return None
    return None

def parse_file(code: str) -> CFile:
    """Extract file objects from code."""
    contracts = []
    tokens = TokenStream(list(CLexer().get_tokens(code)))

    # Parse contract body
    depth = 1
    statement = []
    contract_vars = []
    structs = []
    functions = []
    pragma = None
    is_function = False

    while tokens.has_more() and depth > 0:
        token = tokens.next()
        kind, value = token

        if kind == Token.Punctuation and value == "{":
            depth += 1
            if is_function:
                func = parse_function(statement)
                if func:
                    func.pragma = pragma
                    pragma = None
                    functions.append(func)
                is_function = False
        elif kind == Token.Punctuation and value == "}":
            depth -= 1
            statement = []  # tokens preceding blocks are not statements
        elif kind == Token.Punctuation and value == ";" and depth == 1:
            # We're done, parse statement
            result = parse_statement(statement)
            if result is not None:
                result.pragma = pragma
                contract_vars.append(result)
            statement = []
            pragma = None
            is_function = False # it wasn't a function after all
        elif kind in Token.Comment:
            pragma = pragma or parse_pragma(value)
        elif kind in Token.Keyword and value == "struct" and depth == 1:
            struct_name, struct_vars = parse_struct(tokens)
            if struct_name:
                structs.append(CStruct(struct_name, struct_vars, pragma))
            pragma = None
        elif kind in Token.Keyword and value == "void" and depth == 1:
            # void marks beginning of function, be ready!
            is_function = True
            statement.append(token)
        elif depth == 1:
            # Only append tokens at the contract's top level
            statement.append(token)

    return CFile(contract_vars, structs, functions)

if __name__ == "__main__":
    text = ""
    with open(sys.argv[1], "r") as f:
        text = f.read()

    file = parse_file(text)

    # Pretty print the objects
    print("\nState Variables:")
    for var in file.vars:
        pragma_str = f" [pragma: {var.pragma}]" if var.pragma else ""
        const_str = " (constant)" if var.is_const else ""
        value_str = f" = {var.value}" if var.value else ""
        print(f"  - {var.type} {var.name}{const_str}{value_str}{pragma_str}")

    if file.structs:
        print("\nStructs:")
        for struct in file.structs:
            pragma_str = f" [pragma: {struct.pragma}]" if struct.pragma else ""
            print(f"  - {struct.name}{pragma_str}")

            for field in struct.vars:
                const_str = " (constant)" if field.is_const else ""
                pragma_str = f" [pragma: {field.pragma}]" if field.pragma else ""
                print(f"    * {field.type} {field.name}{const_str}{pragma_str}")

    if file.functions:
        print("\nFunctions:")
        for function in file.functions:
            pragma_str = f" [pragma: {function.pragma}]" if function.pragma else ""
            print(f"  - {function.name}{pragma_str}")

    print("\n" + "-" * 50)
