import {
    AddressLookupTableProgram,
    Connection,
    Keypair,
    PublicKey,
} from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import ivy_idl from "./idl/ivy.json";
import metadata_idl from "./idl/Metadata.json";
import { Ivy } from "./types/ivy";
import { TokenMetadata } from "./types/Metadata";

// Text encoder
export const TEXT_ENCODER = new TextEncoder();

// Constants
export const MAX_TEXT_LEN = 128;
export const GAME_DECIMALS = 9;
export const IVY_DECIMALS = 9;

// Program IDs
export const IVY_PROGRAM_ID = new PublicKey(ivy_idl.address);
export const METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);

// Program prefixes
export const GAME_PREFIXES = {
    game: Buffer.from("game"),
    mint: Buffer.from("game_mint"),
    withdraw: Buffer.from("game_withdraw"),
    burn: Buffer.from("game_burn"),
    deposit: Buffer.from("game_deposit"),
    ivy_wallet: Buffer.from("game_ivy_wallet"),
    curve_wallet: Buffer.from("game_curve_wallet"),
    treasury_wallet: Buffer.from("game_treasury_wallet"),
};

export const WORLD_PREFIXES = {
    world: Buffer.from("world"),
    usdc: Buffer.from("world_usdc"),
    curve: Buffer.from("world_curve"),
    treasury: Buffer.from("world_treasury"),
    vesting: Buffer.from("world_vesting"),
    mint: Buffer.from("world_mint"),
};

export const ITEM_PREFIXES = {
    item: Buffer.from("item"),
    mint: Buffer.from("item_mint"),
};

export const ACHIEVEMENT_PREFIXES = {
    achievement: Buffer.from("achievement"),
    mint: Buffer.from("achievement_mint"),
};

// fake connection to placate anchor
// never actually gets used
const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed",
);
const rpc_provider = new AnchorProvider(connection, {
    signTransaction: (tx) => Promise.resolve(tx),
    signAllTransactions: (txs) => Promise.resolve(txs),
    publicKey: Keypair.generate().publicKey,
});
export const ivy_program = new Program<Ivy>(
    ivy_idl as unknown as Ivy,
    rpc_provider,
);
let IVY_DISC_MAP: Record<string, string> | null = null;
const HEX_ALPHABET = "0123456789abcdef";
export function getIvyInstructionName(data: Uint8Array): string | null {
    if (!IVY_DISC_MAP) {
        IVY_DISC_MAP = {};
        // build discriminator -> instruction name cache
        for (const ins of ivy_idl.instructions) {
            let hex = "";
            for (const v of ins.discriminator) {
                hex += HEX_ALPHABET[(v >> 4) & 0xf];
                hex += HEX_ALPHABET[v & 0xf];
            }
            IVY_DISC_MAP[hex] = ins.name;
        }
    }
    if (data.length < 8) {
        return null;
    }
    let discHex = "";
    for (let i = 0; i < 8; i++) {
        const v = data[i];
        discHex += HEX_ALPHABET[(v >> 4) & 0xf];
        discHex += HEX_ALPHABET[v & 0xf];
    }
    return IVY_DISC_MAP[discHex] || null;
}

export const meta_program = new Program<TokenMetadata>(
    metadata_idl as unknown as TokenMetadata,
    rpc_provider,
);

// Common PDAs
export const [WORLD_ADDRESS, WORLD_NONCE] = PublicKey.findProgramAddressSync(
    [Buffer.from(WORLD_PREFIXES.world)],
    IVY_PROGRAM_ID,
);
export const WORLD_USDC_WALLET = PublicKey.findProgramAddressSync(
    [Buffer.from(WORLD_PREFIXES.usdc)],
    IVY_PROGRAM_ID,
)[0];
export const WORLD_CURVE_WALLET = PublicKey.findProgramAddressSync(
    [Buffer.from(WORLD_PREFIXES.curve)],
    IVY_PROGRAM_ID,
)[0];

export const IVY_MINT = PublicKey.findProgramAddressSync(
    [Buffer.from(WORLD_PREFIXES.mint)],
    IVY_PROGRAM_ID,
)[0];
export const IVY_MINT_B58 = IVY_MINT.toBase58();
export const USDC_MINT_B58 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_MINT = new PublicKey(USDC_MINT_B58);

export type GameData = Awaited<
    ReturnType<Program<Ivy>["account"]["game"]["fetch"]>
>;

export function decodeGame(buf: Buffer): GameData {
    return ivy_program.coder.accounts.decode<GameData>("game", buf);
}

export type VaultData = Awaited<
    ReturnType<Program<Ivy>["account"]["vault"]["fetch"]>
>;

export function decodeVault(buf: Buffer): VaultData {
    return ivy_program.coder.accounts.decode<VaultData>("vault", buf);
}

export type WorldData = Awaited<
    ReturnType<Program<Ivy>["account"]["world"]["fetch"]>
>;

export function decodeWorld(buf: Buffer): WorldData {
    return ivy_program.coder.accounts.decode<WorldData>("world", buf);
}

export function deriveMetadataAddress(mint: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        METADATA_PROGRAM_ID,
    )[0];
}

export type Metadata = Awaited<
    ReturnType<Program<TokenMetadata>["account"]["metadata"]["fetch"]>
>;

export function decodeMetadata(data: Buffer): Metadata {
    const buf = Buffer.alloc(data.length + 8);
    data.copy(buf as unknown as Uint8Array, 8);
    const meta = meta_program.coder.accounts.decode<Metadata>("metadata", buf);
    meta.data.name = meta.data.name.replaceAll("\x00", "");
    meta.data.symbol = meta.data.symbol.replaceAll("\x00", "");
    return meta;
}

export interface WebMetadata {
    name?: string;
    image?: string;
    symbol?: string;
    description?: string;
    twitter?: string;
    website?: string;
}

export async function fetchWebMetadata(
    url: string,
    timeoutMs?: number,
): Promise<WebMetadata> {
    const response = await fetch(url, {
        signal:
            timeoutMs !== undefined
                ? AbortSignal.timeout(timeoutMs)
                : undefined,
    });
    const json = await response.json();
    if (typeof json !== "object") {
        throw new Error(`cannot parse web metadata: ${json}`);
    }
    return json;
}

export interface ChainMetadata {
    name: string;
    symbol: string;
    metadata_url: string;
}

export async function loadChainMetadata(
    connection: Connection,
    metadata: PublicKey,
): Promise<ChainMetadata> {
    const metadata_info = await connection.getAccountInfo(metadata);
    if (!metadata_info) {
        throw new Error("can't find item metadata");
    }
    if (!metadata_info.owner.equals(METADATA_PROGRAM_ID)) {
        throw new Error("metadata has wrong owner");
    }

    const m = decodeMetadata(metadata_info.data);
    return {
        name: String(m.data.name || ""),
        symbol: String(m.data.symbol || ""),
        metadata_url: String(m.data.uri || ""),
    };
}

export function deriveAddressLookupTableAddress(
    authority: PublicKey,
    recent_slot: number,
): [PublicKey, number] {
    const recent_slot_buf = Buffer.alloc(8);
    recent_slot_buf.writeBigUint64LE(BigInt(recent_slot));
    return PublicKey.findProgramAddressSync(
        [authority.toBuffer(), recent_slot_buf],
        AddressLookupTableProgram.programId,
    );
}

// Helper function to convert strings to zero-terminated byte arrays of fixed length
export function str2zt(str: string, length: number): number[] {
    const res = new TextEncoder().encode(str);
    if (res.length >= length) {
        throw new Error(`String too long; max length is ${length - 1}`);
    }
    const b = new Uint8Array(length);
    b.set(res);
    const a = Array.from(b);
    return a;
}

// Helper function to convert zero-terminated byte arrays of fixed length to a string
export function zt2str(a: number[]): string {
    let len = 0;
    while (len < a.length && a[len] !== 0) {
        len++;
    }
    return Buffer.from(a.slice(0, len)).toString("utf-8");
}

export function mkpad(len: number): number[] {
    const a = new Array(len);
    for (let i = 0; i < a.length; i++) {
        a[i] = Math.floor(Math.random() * 256);
    }
    return a;
}

/// Converts the provided number string to
/// an 8-number array representing the amount encoded
/// as a little-endian u64.
const MAX_U64_BIGINT = BigInt("18446744073709551615");
const MAX_U8_BIGINT = BigInt(255);
const EIGHT_BIGINT = BigInt(8);
export function str2u64bytes(s: string): number[] {
    const result: number[] = new Array(8).fill(0);
    let num: bigint = BigInt(s);
    if (num > MAX_U64_BIGINT) {
        throw new Error("provided value greater than largest u64");
    }

    // Fill the array with bytes in little-endian order
    for (let i = 0; i < 8; i++) {
        result[i] = Number(num & MAX_U8_BIGINT);
        num >>= EIGHT_BIGINT;
    }

    return result;
}

export const NULL_RECENT_BLOCKHASH =
    "1111111111111111111111111111111111111111111111111111111111111111";

// so we don't have to import spl-token
export const TOKEN_PROGRAM_ID: PublicKey = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID: PublicKey = new PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export function getAssociatedTokenAddressSync(
    tokenMintAddress: PublicKey,
    walletAddress: PublicKey,
): PublicKey {
    return PublicKey.findProgramAddressSync(
        [
            walletAddress.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            tokenMintAddress.toBuffer(),
        ],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    )[0];
}
