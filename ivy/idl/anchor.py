from ty import CType

def parse_c_type(c_type: str) -> CType:
    """
    Get a CType representing the given C type, including size, alignment, and anchor type.

    Args:
        c_type: The type string

    Returns:
        A CType instance
    """
    c_type = c_type.strip()

    # Handle array types
    if c_type.endswith("]"):
        base_type, array_part = c_type.split("[", 1)
        base_type = base_type.strip()
        array_size_str = array_part.rstrip("]").strip()

        base_ctype = parse_c_type(base_type)

        if not array_size_str:  # Dynamic array
            anchor_type = {"vec": base_ctype.anchor_type}
            return CType(size=8, alignment=8, anchor_type=anchor_type)

        try:
            array_size = int(array_size_str)
            anchor_type = {"array": [base_ctype.anchor_type, array_size]}
            return CType(
                size=base_ctype.size * array_size,
                alignment=base_ctype.alignment,
                anchor_type=anchor_type
            )
        except ValueError:
            anchor_type = {
                "array": [
                    base_ctype.anchor_type,
                    {"generic": array_size_str},
                ]
            }
            # Size cannot be determined for generic arrays
            return CType(size=-1, alignment=base_ctype.alignment, anchor_type=anchor_type)

    # Handle primitive types
    if c_type in ("u8", "i8", "bool", "bytes1"):
        return CType(size=1, alignment=1, anchor_type="u8" if c_type == "bytes1" else c_type)
    elif c_type in ("u16", "i16"):
        return CType(size=2, alignment=2, anchor_type=c_type)
    elif c_type in ("u32", "i32", "f32"):
        return CType(size=4, alignment=4, anchor_type=c_type)
    elif c_type in ("u64", "i64", "f64"):
        return CType(size=8, alignment=8, anchor_type=c_type)
    elif c_type in ("u128", "i128"):
        return CType(size=16, alignment=16, anchor_type=c_type)
    elif c_type == "address":
        return CType(size=32, alignment=1, anchor_type="pubkey")
    elif c_type.startswith("bytes") and c_type[5:].isdigit():
        size = int(c_type[5:])
        return CType(
            size=size,
            alignment=1,
            anchor_type={"array": ["u8", size]}
        )

    # For custom or complex types
    return CType(size=8, alignment=8, anchor_type=c_type)
