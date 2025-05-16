import { IVY_MINT } from "@/import/ivy-sdk";
import { PublicKey } from "@solana/web3.js";

// Transparent 1x1 pixel for placeholders
export const TRANSPARENT_1X1 =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// API base URL
export const API_BASE = "/api";

// Decimal configurations
export const USDC_DECIMALS = 6;

// Default slippage
export const DEFAULT_SLIPPAGE_BPS = 50;

// Token mint addresses
export const SOL_MINT = new PublicKey(
    "So11111111111111111111111111111111111111112",
);
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

// Other constants
export const MAX_SF = 8;
