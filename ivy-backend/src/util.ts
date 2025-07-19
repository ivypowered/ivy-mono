import {
    ComputeBudgetProgram,
    Connection,
    PublicKey,
    Transaction,
} from "@solana/web3.js";
import { LISTEN_PORT, MAX_UPLOAD_LENGTH, RPC_URL } from "./constants";
import { PinataSDK } from "pinata";
import { PINATA_JWT, PINATA_GATEWAY, MAX_UPLOAD_B64_LENGTH } from "./constants";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// Utility function for image validation
export const VALID_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
];

export const validateImageType = (iconType: string): boolean => {
    return VALID_IMAGE_TYPES.includes(iconType);
};

// File size helper
export const getMaxUploadSizeMB = (): number => {
    return Math.floor(MAX_UPLOAD_LENGTH / (1024 * 1024));
};

const pinata =
    PINATA_JWT && PINATA_GATEWAY
        ? new PinataSDK({
              pinataJwt: PINATA_JWT,
              pinataGateway: PINATA_GATEWAY,
          })
        : null;

/**
 * Helper function to save data to local tmp directory
 */
export async function saveToTmp(
    data: string | object,
    extension: string,
    isBase64: boolean = false,
): Promise<string> {
    // Create tmp directory if it doesn't exist
    const tmpDir = "./tmp";
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Generate content to save and hash
    const contentToHash =
        typeof data === "string" ? data : JSON.stringify(data);
    const hash = crypto
        .createHash("sha256")
        .update(contentToHash)
        .digest("hex");
    const filename = `${hash}.${extension}`;
    const filePath = path.join(tmpDir, filename);

    // Save the file
    if (typeof data === "string" && isBase64) {
        // Convert base64 to buffer and save
        const buffer = Buffer.from(data, "base64");
        fs.writeFileSync(filePath, buffer);
    } else if (typeof data === "object") {
        // Save JSON data
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } else {
        // Save string data
        fs.writeFileSync(filePath, data);
    }

    // Return a mock URL
    return `http://127.0.0.1:${LISTEN_PORT}/tmp/${filename}`;
}

/**
 * Uploads an image to IPFS
 */
export async function uploadImageToIPFS(
    iconBase64: string,
    iconType: string,
): Promise<string> {
    // Validate iconType (MIME type)
    if (!validateImageType(iconType)) {
        throw new Error(
            "Invalid image type. Supported types: JPEG, PNG, GIF, WebP",
        );
    }

    // Validate file size
    if (iconBase64.length > MAX_UPLOAD_B64_LENGTH) {
        throw new Error(
            `Image too large. Maximum size is ${getMaxUploadSizeMB()} MB`,
        );
    }

    if (pinata) {
        // Upload directly to Pinata
        const pinataResponse = await pinata.upload.public.base64(iconBase64);

        if (!pinataResponse.cid) {
            throw new Error("Failed to upload icon to IPFS");
        }

        // Create the icon URL using the Pinata gateway
        return `https://${PINATA_GATEWAY}/ipfs/${pinataResponse.cid}`;
    } else {
        // Upload to ./tmp directory (we're in debug mode)
        const extension = iconType.split("/")[1];
        return await saveToTmp(iconBase64, extension, true);
    }
}

/**
 * Creates metadata for a game or world and uploads it to IPFS
 */
export async function createAndUploadMetadata(
    name: string,
    symbol: string,
    iconUrl: string,
    description: string,
): Promise<string> {
    const metadata = {
        name,
        image: iconUrl,
        symbol,
        description,
    };
    if (pinata) {
        // Upload metadata to Pinata
        const metadataResponse = await pinata.upload.public.json(metadata);

        if (!metadataResponse.cid) {
            throw new Error("Failed to upload metadata to IPFS");
        }

        // Create the metadata URL using the Pinata gateway
        return `https://${PINATA_GATEWAY}/ipfs/${metadataResponse.cid}`;
    } else {
        // Upload to ./tmp directory (we're in debug mode)
        return await saveToTmp(metadata, "json");
    }
}

/** Get a reasonable priority fee in micro-lamports. */
const JUPITER_AGGREGATOR_V6 = new PublicKey(
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
);
export async function getReasonablePriorityFee(
    connection: Connection,
): Promise<number> {
    // Retrieve last 1,000 confirmed Jupiter transactions
    const signatures = (
        await connection.getSignaturesForAddress(
            JUPITER_AGGREGATOR_V6,
            {
                limit: 1_000,
            },
            "confirmed",
        )
    ).map((x) => x.signature);
    const transactions = (
        await connection.getParsedTransactions(signatures, {
            maxSupportedTransactionVersion: 0,
        })
    ).filter((x) => !!x);

    // Calculate the priority fee in micro-lamports for each one
    const priorityFees = transactions.map((tx) => {
        // fee_lamports = (5000 * n_signatures) + (budget * (priority_fee_micro_lamports / 1_000_000))
        // priority_fee_micro_lamports = ((fee_lamports - (5000 * n_signatures)) / budget) * 1_000_000
        // (we fudge this slightly by assuming consumption = budget, not true in many cases)
        return Math.floor(
            (((tx.meta?.fee || 0) - 5000 * tx.transaction.signatures.length) /
                (tx.meta?.computeUnitsConsumed || 0)) *
                1_000_000,
        );
    });

    // Take their median
    if (priorityFees.length === 0) {
        return 0;
    }
    priorityFees.sort((a, b) => a - b);
    const medianPriorityFee = priorityFees[Math.floor(priorityFees.length / 2)];

    // Cap final result as a safety measure
    return Math.min(5_000_000, medianPriorityFee);
}
