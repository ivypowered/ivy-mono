import { NextFunction, Request, Response } from "express";
import { Keypair, PublicKey } from "@solana/web3.js";
import { ZodError } from "zod";

// Error handler + automatic JSON envelope for async routes
// - Wraps successful responses as { status: "ok", data: <return value> }
// - Wraps errors as { status: "err", msg }
export const handleAsync = <T = unknown>(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<T>,
) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await fn(req, res, next);
            if (!res.headersSent) {
                res.status(200).json({ status: "ok", data });
            }
        } catch (err) {
            let message =
                err instanceof Error
                    ? err.message
                    : String(err ?? "Unknown error");
            if (err instanceof ZodError) {
                message = err.issues
                    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
                    .join("; ");
            }
            if (!res.headersSent) {
                res.status(400).json({ status: "err", msg: message });
            }
        }
    };
};

// Parse string to PublicKey
export const parsePublicKey = (
    keyStr: string,
    fieldName: string,
): PublicKey => {
    try {
        return new PublicKey(keyStr);
    } catch (e) {
        throw new Error(`Invalid public key format for field '${fieldName}'`);
    }
};

// Parse authority information from either public or private key
export interface AuthorityInfo {
    publicKey: PublicKey;
    keypair: Keypair | null;
}

export const parseAuthority = (
    publicKeyStr: string | undefined,
    privateKeyStr: string | undefined,
    fieldName: string,
): AuthorityInfo => {
    if (privateKeyStr) {
        try {
            // Try decoding as base64 private key
            const keypair = Keypair.fromSecretKey(
                Buffer.from(privateKeyStr, "base64"),
            );
            return { publicKey: keypair.publicKey, keypair };
        } catch (e) {
            throw new Error(
                `Invalid format for field '${fieldName}_key'. Must be a base64 encoded private key.`,
            );
        }
    } else if (publicKeyStr) {
        try {
            // Parse as public key
            const publicKey = new PublicKey(publicKeyStr);
            return { publicKey, keypair: null };
        } catch (pubKeyError) {
            throw new Error(
                `Invalid format for field '${fieldName}'. Must be a base58 public key.`,
            );
        }
    } else {
        throw new Error(
            `Either '${fieldName}' or '${fieldName}_key' must be provided.`,
        );
    }
};

// Helper function to convert hex string to Uint8Array
export function parseHex(hexId: string, idName: string): Uint8Array {
    try {
        // Remove '0x' prefix if present
        if (hexId.startsWith("0x")) {
            hexId = hexId.substring(2);
        }
        return Uint8Array.from(Buffer.from(hexId, "hex"));
    } catch (error) {
        throw new Error(`Invalid ${idName} format: ${error}`);
    }
}
