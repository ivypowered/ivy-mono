#!/usr/bin/env python3

import json
from re import S
import sys
import glob
import os
import time
from typing import Any, cast

from solders.pubkey import Pubkey
from anchor import parse_c_type
from parser import parse_file
from ty import CFile, CVariable

# Define color codes for terminal output
class Colors:
    RED = "\033[31m"
    GREEN = "\033[32m"
    BOLD = "\033[1m"
    END = "\033[0m"

def eprintln(s: str):
    print(s, file=sys.stderr)

def fail(s: str):
    eprintln(f"{Colors.RED}{Colors.BOLD}error{Colors.END}: {s}")
    exit(1)

if len(sys.argv) < 3:
    fail("pass the desired name as first argument, base58-encoded program ID as the second")

program_name = sys.argv[1]
if not program_name:
    fail("program name not found")
program_id = sys.argv[2]

# Derive event authority account
event_authority = str(Pubkey.find_program_address(
    [b"__event_authority"],
    Pubkey.from_string(program_id)
)[0])

# Known account addresses
known_accounts = {
    "clock": "SysvarC1ock11111111111111111111111111111111",
    "systemprogram": "11111111111111111111111111111111",
    "associatedtokenprogram": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "ataprogram": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "rent": "SysvarRent111111111111111111111111111111111",
    "tokenprogram": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "metadataprogram": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
    "usdcmint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "altprogram": "AddressLookupTab1e1111111111111111111111111",
    "thisprogram": program_id,
    "eventauthority": event_authority,
    "ixsysvar": "Sysvar1nstructions1111111111111111111111111",
    "instructionsysvar": "Sysvar1nstructions1111111111111111111111111",
    "wsolmint": "So11111111111111111111111111111111111111112"
}

# 1. Create target directories
os.makedirs("./target/idl", exist_ok=True)

# Get all source files
src_files = glob.glob("./src/**/*.h", recursive=True)
if not src_files:
    fail("No source files found; make sure that you're in the directory that contains `src`")

all_files: list[CFile] = []
for src_file in src_files:
    with open(src_file, "rb") as f:
        source = f.read().decode("utf-8")
        all_files.append(parse_file(source))

def parse_u64(s: str) -> int:
    l_idx = s.index("(")
    r_idx = s.index(")")
    disc_str = ""
    if l_idx >= 0 and r_idx >= 0:
        disc_str = s[l_idx + 1:r_idx]
    else:
        disc_str = s
    base = 10
    if disc_str.startswith("0x"):
        base = 16
    return int(disc_str, base)

def to_u64_list(n: int) -> list[int]:
    return [(n >> (8 * i)) & 0xFF for i in range(8)]

def to_pascal_case(s: str) -> str:
    # Split the string by non-alphanumeric characters
    words = ''.join(c if c.isalnum() else ' ' for c in s).split()

    # Capitalize each word and join them together
    return ''.join(word.capitalize() for word in words)

idl_accounts_by_struct_name: dict[str, list[Any]] = {}
ins_accounts = {}
ins_args = {}
accounts = []
events = []
types = []
instructions = []

for file in all_files:
    ins_discs: dict[str, int] = {}
    struct_discs: dict[str, int] = {}
    evt_discs: dict[str, int] = {}

    # First process all discriminators
    for var in file.vars:
        if not var.pragma:
            continue
        args = var.pragma.split()
        if len(args) >= 3 and args[0] == "event" and args[1] == "discriminator":
            name = args[2]
            if evt_discs.get(args[2], None):
                fail(f"duplicate event discriminator for {name}")
            if not var.value:
                continue
            evt_discs[args[2]] = parse_u64(var.value)
        elif len(args) >= 3 and args[0] == "struct" and args[1] == "discriminator":
            name = args[2]
            if struct_discs.get(args[2], None):
                fail(f"duplicate struct discriminator for {name}")
            if not var.value:
                continue
            struct_discs[args[2]] = parse_u64(var.value)
        elif len(args) >= 3 and args[0] == "instruction" and args[1] == "discriminator":
            name = args[2]
            if ins_discs.get(args[2], None):
                fail(f"duplicate instruction discriminator for {name}")
            if not var.value:
                continue
            ins_discs[args[2]] = parse_u64(var.value)
        else:
            eprintln(f"unrecognized pragma {json.dumps(var.pragma)}")

    # Process structs and events
    for struct in file.structs:
        if not struct.pragma:
            continue
        args = struct.pragma.split()
        if len(args) >= 2 and args[0] == "event" and args[1] == "declaration":
            # add to events list
            evt_name = struct.name
            evt_disc = evt_discs.get(evt_name, None)
            if not evt_disc:
                fail(f"can't find discriminator for event {json.dumps(evt_name)}")
                exit()
            ins_disc_bytes = to_u64_list(evt_disc)
            events.append({
                "name": evt_name,
                "discriminator": ins_disc_bytes,
            })

            # parse struct args
            if len(struct.vars) < 1:
                fail(f"in {struct.name}: event must have at least 1 field")
            disc_sv = struct.vars[0]
            if disc_sv.name != "discriminator" or disc_sv.type != "u64":
                fail(f"in {struct.name}: event's 1st field must be `u64 discriminator`")
            struct_fields = []
            for sv in struct.vars[1:]:
                if sv.is_const:
                    continue
                if sv.pragma:
                    pragma_args = sv.pragma.split()
                    if len(pragma_args) != 1 or pragma_args[0] != "string":
                        fail(f"in {struct.name}: pragma in event must be of type string")
                        continue
                    struct_fields.append({
                        "name": sv.name,
                        "type": "string"
                    })
                    continue
                struct_fields.append({
                    "name": sv.name,
                    "type": parse_c_type(sv.type).anchor_type
                })
            types.append({
                "name": struct.name,
                "type": {
                    "kind": "struct",
                    "fields": struct_fields,
                }
            })
        elif len(args) >= 2 and args[0] == "struct" and args[1] == "declaration":
            # parse struct args
            if len(struct.vars) < 1:
                fail("struct must have at least 1 field")
            disc_sv = struct.vars[0]
            if disc_sv.name != "discriminator" or disc_sv.type != "u64":
                fail("struct's 1st field must be `u64 discriminator`")
            struct_disc = struct_discs.get(struct.name, None)
            if struct_disc:
                accounts.append({
                    "name": struct.name,
                    "discriminator": to_u64_list(struct_disc)
                })
            struct_fields = []
            for sv in struct.vars[1:]:
                if sv.is_const:
                    continue
                struct_fields.append({
                    "name": sv.name,
                    "type": parse_c_type(sv.type).anchor_type
                })
            types.append({
                "name": struct.name,
                "type": {
                    "kind": "struct",
                    "fields": struct_fields,
                }
            })
        elif len(args) >= 2 and args[0] == "instruction" and args[1] == "accounts":
            ins_name = args[2]
            accounts_list = []
            for sv in struct.vars:
                if sv.pragma:
                    args = sv.pragma.split()
                    if len(args) > 0 and args[0] == "reference":
                        if len(args) < 2:
                            fail(f"in {ins_name}: pragma reference requires 1 argument")
                        struct_name = args[1]
                        idl_accounts = idl_accounts_by_struct_name.get(struct_name, None)
                        if idl_accounts is None:
                            fail(f"in {ins_name}: can't find referenced account struct " + struct_name)
                            exit(1)
                        accounts_list.extend(idl_accounts)
                        continue
                account: dict[str, Any] = {"name": sv.name}
                name = "".join(c for c in sv.name if c.isalpha()).lower()
                address = known_accounts.get(name, None)
                if address is not None:
                    account["address"] = address
                if sv.pragma:
                    acc_args = sv.pragma.split()
                    for acc_arg in acc_args:
                        if acc_arg == "writable":
                            account["writable"] = True
                        elif acc_arg == "signer":
                            account["signer"] = True
                        elif acc_arg == "readonly":
                            if account.get("writable", False):
                                fail(f"in {json.dumps(ins_name)}: account cannot be both writable and readonly")
                        else:
                            fail(f"in {json.dumps(ins_name)}: unknown modifier {json.dumps(acc_arg)}")
                accounts_list.append(account)
            ins_accounts[ins_name] = accounts_list
            idl_accounts_by_struct_name[struct.name] = accounts_list
        elif len(args) >= 2 and args[0] == "instruction" and args[1] == "data":
            ins_name = args[2]
            args_list = []
            current_offset = 0
            pad_index = 0
            max_alignment = 0
            seen_string = False

            for sv in struct.vars:
                if sv.pragma:
                    fp_args = sv.pragma.split()
                    if len(fp_args) < 1 or (fp_args[0] != "string" and fp_args[0] != "strings"):
                        fail(f"in {json.dumps(ins_name)}: instruction data pragma must be of type string or strings")
                        continue
                    seen_string = True
                    if fp_args[0] == "string":
                        # insert it directly, program must handle padding
                        args_list.append({
                            "name": sv.name,
                            "type": "string"
                        })
                        continue
                    fp_strings = fp_args[1:]
                    if len(fp_strings) == 0:
                        fail(f"in {json.dumps(ins_name)}: no string names provided to strings pragma")
                    for s in fp_strings:
                        # insert it directly
                        args_list.append({
                            "name": s,
                            "type": "string"
                        })
                    continue
                if seen_string:
                    fail(f"in {json.dumps(ins_name)}: padding issues: cannot have normal fields following string pragma")
                c_type = parse_c_type(sv.type)
                name = sv.name

                # Determine field alignment
                field_alignment = c_type.alignment
                max_alignment = max(max_alignment, field_alignment)

                # Calculate and add padding needed before this field
                if current_offset % field_alignment != 0:
                    padding_size = field_alignment - (current_offset % field_alignment)
                    args_list.append({
                        "name": f"pad{pad_index}",
                        "type": {"array": ["u8", padding_size]}
                    })
                    current_offset += padding_size
                    pad_index += 1

                # Add the field
                args_list.append({
                    "name": name,
                    "type": c_type.anchor_type
                })

                # Update current offset
                current_offset += c_type.size

            # Add padding at the end to make the total struct size a multiple of its max alignment
            if not seen_string and max_alignment > 0 and current_offset % max_alignment != 0:
                end_padding = max_alignment - (current_offset % max_alignment)
                args_list.append({
                    "name": f"pad{pad_index}",
                    "type": {"array": ["u8", end_padding]}
                })

            ins_args[ins_name] = args_list

    # Process functions as instructions
    ins_names: set[str] = set()
    for func in file.functions:
        if not func.pragma:
            continue
        args = func.pragma.split()
        if len(args) >= 2 and args[0] == "instruction" and args[1] == "declaration":
            ins_name = func.name
            ins_names.add(ins_name)
            ins_disc = ins_discs.get(ins_name, None)
            if not ins_disc:
                fail(f"can't find discriminator for instruction {json.dumps(ins_name)}")
                exit()
            ins_disc_bytes = to_u64_list(ins_disc)

            instruction = {
                "name": to_pascal_case(ins_name),
                "discriminator": ins_disc_bytes,
                "accounts": ins_accounts.get(ins_name, []),
                "args": ins_args.get(ins_name, [])
            }

            instructions.append(instruction)
    # Ensure that all discriminator+account pairs
    # have corresponding functions
    for ins_name in ins_discs.keys():
        if ins_name not in ins_names:
            fail(f"can't find declaration for instruction {json.dumps(ins_name)}")

# Create the IDL
idl = {
    "address": program_id,
    "metadata": {
        "name": program_name.capitalize(),
        "version": "0.0.1",
        "spec": "0.1.0"
    },
    "instructions": instructions,
    "accounts": accounts,
    "types": types,
    "events": events
}

out_file = f"./target/idl/{program_name.lower()}.json"

# Write IDL to file
with open(out_file, "w") as f:
    json.dump(idl, f, indent=4)
