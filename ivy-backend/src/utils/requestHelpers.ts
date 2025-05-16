import { Request, Response, NextFunction } from "express";
import { Keypair, PublicKey } from "@solana/web3.js";

// Type definitions for request validation
type FieldType =
    | "string"
    | "number"
    | "object"
    | "boolean"
    | "array"
    | ["string", "number"];

interface FieldValidation {
    name: string;
    type: FieldType | FieldType[];
    optional?: boolean;
}

// Error handler for async routes
export const handleAsync = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            return res.status(400).json({
                status: "err",
                msg: message,
            });
        });
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

// Validate request body fields
export function validateRequestBody(body: any, fields: FieldValidation[]) {
    if (typeof body !== "object" || body === null) {
        throw new Error("Request body must be a JSON object");
    }

    const result: Record<string, any> = {};

    for (const field of fields) {
        const value = body[field.name];
        if (value === undefined || value === null) {
            if (!field.optional) {
                throw new Error(`Missing required field: ${field.name}`);
            }
            continue;
        }

        const expectedTypes = Array.isArray(field.type)
            ? field.type
            : [field.type];
        const actualType = typeof value;
        let typeMatch = false;
        let processedValue = value;

        if (
            expectedTypes.some(
                (type) => type === actualType || type === "object",
            )
        ) {
            typeMatch = true;
        } else if (expectedTypes.includes("array") && Array.isArray(value)) {
            typeMatch = true;
        } else if (
            expectedTypes.includes("number") &&
            actualType === "string" &&
            !isNaN(parseInt(value))
        ) {
            typeMatch = true;
            processedValue = parseInt(value);
        } else if (
            expectedTypes.includes("boolean") &&
            (value === "true" ||
                value === "false" ||
                value === true ||
                value === false)
        ) {
            typeMatch = true;
            // Convert string "true"/"false" to actual boolean if needed
            processedValue =
                typeof value === "string" ? value === "true" : value;
        }

        if (!typeMatch) {
            throw new Error(
                `Field '${field.name}' must be of type ${expectedTypes.join(" or ")}, received ${actualType}`,
            );
        }

        result[field.name] = processedValue;
    }

    return result;
}
