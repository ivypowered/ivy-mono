import { IVY_MINT } from "@/import/ivy-sdk";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js-light";

// Transparent 1x1 pixel for placeholders
export const TRANSPARENT_1X1 =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// API base URLs
export const API_BASE = "/api";
export const API_STREAM_BASE = "/api";

// Decimal configurations
export const USDC_DECIMALS = 6;

// Default slippage
export const DEFAULT_SLIPPAGE_BPS = 200;

// Token mint addresses
export const WSOL_MINT_B58 = "So11111111111111111111111111111111111111112";
export const WSOL_MINT = new PublicKey(WSOL_MINT_B58);
export const USDC_MINT = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
export const USDC_MINT_B58 = USDC_MINT.toBase58();
export const USDT_MINT = new PublicKey(
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
);
export const IVY_MINT_B58 = IVY_MINT.toBase58();

// Program IDs
export const JUP_PROGRAM_ID = new PublicKey(
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
);
export const JUP_IX_ROUTE_TAG = Buffer.from([
    0xe5, 0x17, 0xcb, 0x97, 0x7a, 0xe3, 0xad, 0x2a,
]);
export const JUP_IX_SHARED_ACCOUNTS_ROUTE_TAG = Buffer.from([
    0xc1, 0x20, 0x9b, 0x33, 0x41, 0xd6, 0x9c, 0x81,
]);
export const JUP_IX_CREATE_TOKEN_ACCOUNT_TAG = Buffer.from([
    0x93, 0xf1, 0x7b, 0x64, 0xf4, 0x84, 0xae, 0x76,
]);

export const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

// Other constants
export const MAX_SF = 8;
export const DECIMAL_ZERO = new Decimal(0);

// Mock tokens
export const COMMON_TOKENS = [
    {
        mint: WSOL_MINT.toBase58(),
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        icon: "/assets/images/sol.png",
    },
    {
        mint: USDC_MINT_B58,
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        icon: "/assets/images/usdc.png",
    },
    {
        mint: USDT_MINT.toBase58(),
        symbol: "USDT",
        name: "Tether",
        decimals: 6,
        icon: "/assets/images/usdt.svg",
    },
    {
        mint: IVY_MINT_B58,
        symbol: "IVY",
        name: "Ivy",
        decimals: 9,
        icon: "/assets/images/ivy-icon.svg",
    },
];

export const SOL_TOKEN = COMMON_TOKENS[0];
export const IVY_TOKEN = COMMON_TOKENS[3];
