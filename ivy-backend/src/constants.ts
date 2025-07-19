import { Keypair, PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

export const WSOL_MINT = new PublicKey(
    "So11111111111111111111111111111111111111112",
);
export const LISTEN_PORT = process.env["LISTEN_PORT"] || 4000;
export const RPC_URL = process.env["RPC_URL"] || "http://127.0.0.1:8899";
export const PINATA_JWT = process.env["PINATA_JWT"] || "";
export const PINATA_GATEWAY = process.env["PINATA_GATEWAY"] || "";
export const MAX_UPLOAD_LENGTH = 2 * 1024 * 1024; // 2 MB
export const MAX_UPLOAD_B64_LENGTH =
    Math.ceil((MAX_UPLOAD_LENGTH * 4) / 3) + 814; // 2 MB in base64 + account for extra characters
export const DEBUG_MINT_KEYPAIR = Keypair.fromSecretKey(
    Uint8Array.from([
        21, 213, 209, 87, 15, 96, 193, 240, 200, 105, 169, 76, 118, 208, 228,
        158, 35, 203, 197, 114, 152, 254, 173, 79, 245, 197, 131, 211, 22, 31,
        131, 227, 155, 94, 60, 193, 110, 147, 9, 132, 198, 192, 109, 82, 184,
        145, 212, 168, 71, 82, 121, 35, 199, 156, 242, 198, 60, 132, 40, 4, 51,
        26, 126, 8,
    ]),
);
export const EVENTS_MAX_CONCURRENT_REQUESTS = 10;
export const EVENTS_USE_BATCH = true;
