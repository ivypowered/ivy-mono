import re
import sys

# Get and read header file
header_file = sys.argv[1]
with open(header_file, 'r') as f:
    content = f.read()

# Find all r128 _internal functions with their return types and arguments
pattern = r"([a-zA-Z0-9_]+\s*\*?)\s+(r128_[a-zA-Z0-9_]+_internal)\s*\((.*?)\)\s*;"
matches = re.findall(pattern, content, re.DOTALL)

wrappers = "\n// ---- Generated Wrapper Functions ----\n\n"

for return_type, func_name, args_str in matches:
    # Extract base function name without _internal suffix
    base_func_name = func_name[:-9]  # remove "_internal"

    # Parse arguments
    raw_args = re.findall(r'([^,]+?)(?:,|$)', args_str)
    raw_args = [arg.strip() for arg in raw_args if arg.strip()]

    # Check if this is a void function with struct r128 *dst as first parameter
    is_dst_based = (return_type.strip() == "void" and
                    raw_args and
                    "struct r128 *" in raw_args[0] and
                    raw_args[0].split()[-1].strip('*') == "dst")

    # Prepare parameters and arguments for the wrapper function
    wrapper_params = []
    call_args = []

    for i, arg in enumerate(raw_args):
        # Skip the dst parameter for dst-based functions
        if i == 0 and is_dst_based:
            call_args.append("&dst")
            continue

        parts = arg.strip().split()
        param_name = parts[-1].strip('*')

        # Handle struct r128* parameters
        if "struct r128" in arg and "*" in arg:
            wrapper_params.append(f"r128 {param_name}")
            call_args.append(f"&{param_name}")
        else:
            # Handle primitive types
            param_type = ' '.join(parts[:-1])
            wrapper_params.append(f"{param_type} {param_name}")
            call_args.append(param_name)

    # Generate the wrapper function
    wrapper_params_str = ", ".join(wrapper_params)
    call_args_str = ", ".join(call_args)

    if is_dst_based:
        wrapper = f"""static r128 {base_func_name}({wrapper_params_str}) {{
  r128 dst;
  {func_name}({call_args_str});
  return dst;
}}"""
    else:
        wrapper = f"""static {return_type} {base_func_name}({wrapper_params_str}) {{
  return {func_name}({call_args_str});
}}"""

    wrappers += wrapper + "\n\n"

wrappers += "// ---- End Generated Wrapper Functions ----"

# Insert wrappers before the closing #endif
modified_content = re.sub(r'(#endif\s*(?:/\*.*?\*/)?\s*)$', wrappers + "\n\n\\1", content, flags=re.MULTILINE)

# Write the modified content back to the file
with open(header_file, "w") as f:
    f.write(modified_content)

print(f"Successfully patched {header_file} with generated wrappers.")
