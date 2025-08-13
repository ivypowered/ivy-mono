import {
    ComputeBudgetProgram,
    Connection,
    PublicKey,
    Transaction,
} from "@solana/web3.js";
import { LISTEN_PORT, MAX_UPLOAD_LENGTH } from "./constants";
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
