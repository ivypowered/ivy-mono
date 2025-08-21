from typing import List, Optional

class CVariable:
    """Represents a variable with type, name, is_constant, and optional pragma"""

    def __init__(self, type_: str, name: str, is_const: bool, value: Optional[str], pragma: Optional[str]):
        self.type = type_
        self.name = name
        self.is_const = is_const
        self.value = value
        self.pragma = pragma


class CStruct:
    """Represents a struct declaration."""
    def __init__(self, name: str, vars: List[CVariable], pragma: Optional[str], is_packed: bool):
        self.name = name
        self.vars = vars
        self.pragma = pragma
        self.is_packed = is_packed

class CFunction:
    """Represents a function declaration."""
    def __init__(self, name: str, pragma: Optional[str]):
        self.name = name
        self.pragma = pragma

class CFile:
    """Represents a file and its members."""

    def __init__(self, vars: List[CVariable], structs: List[CStruct], functions: List[CFunction]):
        self.vars = vars
        self.structs = structs
        self.functions = functions

class CType:
    """Represents a C type."""
    def __init__(self, size: int, alignment: int, anchor_type: str | dict):
        self.size = size
        self.alignment = alignment
        self.anchor_type = anchor_type
