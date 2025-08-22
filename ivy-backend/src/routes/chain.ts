import { z } from "zod";
import { Request } from "express";
import { Deps } from "../types/deps";
import { parsePublicKey } from "../utils/requestHelpers";
import {
    AccountLayout,
    getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Game } from "ivy-sdk";
import { WSOL_MINT } from "../constants";

const metadataSchema = z.object({
    name: z.string().optional(),
    image: z.string().optional(),
    symbol: z.string().optional(),
    description: z.string().optional(),
    twitter: z.string().optional(),
    website: z.string().optional(),
});
const fetchMetadataSchema = z.object({
    url: z.string(),
});
export const getWebMetadata = (_deps: Deps) => async (req: Request) => {
    const { url } = fetchMetadataSchema.parse(req.body);

    try {
        new URL(url);
    } catch {
        // Invalid URL
        return null;
    }

    // Enforce URL pattern matching
    const ALLOWED_PREFIX = "https://cdn.ivypowered.com/ipfs/";
    if (!url.startsWith(ALLOWED_PREFIX)) {
        return null; // Invalid URL format
    }

    // Extract and validate the CID part
    const cid = url.slice(ALLOWED_PREFIX.length);

    // Basic CID validation (CIDv0 starts with Qm, CIDv1 often starts with baf)
    // and should only contain alphanumeric characters
    const cidPattern = /^[a-zA-Z0-9]+$/;
    if (!cid || !cidPattern.test(cid)) {
        return null; // Invalid CID
    }

    // Additional check: reasonable CID length (typically 46-59 chars for CIDv0/v1)
    if (cid.length < 46 || cid.length > 100) {
        return null; // Invalid CID length
    }

    let metadataStr: string;
    try {
        metadataStr = await (await fetch(url)).text();
    } catch (error: any) {
        // Return null for 404s or similar "not found" errors
        // These are non-retryable validity errors
        if (error?.response?.status === 404 || error?.code === "ENOTFOUND") {
            return null;
        }
        // For other errors (network issues, timeouts, etc.), throw to indicate retry is needed
        throw new Error(`Failed to fetch metadata: ${error}`);
    }

    try {
        return metadataSchema.parse(JSON.parse(metadataStr));
    } catch (error: any) {
        console.log(error);
        // Metadata invalid, return null
        return null;
    }
};

const accountsDataSchema = z.object({
    accounts: z.array(z.string()),
});

export const getAccountsData =
    ({ connection }: Deps) =>
    async (req: Request) => {
        const { accounts } = accountsDataSchema.parse(req.body);

        if (accounts.length > 100) {
            throw new Error("Maximum of 100 accounts allowed");
        }

        const publicKeys = accounts.map((a, i) =>
            parsePublicKey(a, `accounts[${i}]`),
        );
        const accountsData =
            await connection.getMultipleAccountsInfo(publicKeys);

        const result = accountsData.map((account) => {
            if (!account) return null;
            return account.data.toString("base64");
        });

        return result;
    };

const tokenBalanceSchema = z.object({
    user: z.string(),
    mint: z.string(),
});

export const getTokenBalance =
    ({ connection }: Deps) =>
    async (req: Request) => {
        const { user: userStr, mint: mintStr } = tokenBalanceSchema.parse(
            req.body,
        );

        const user = parsePublicKey(userStr, "user");
        const mint = parsePublicKey(mintStr, "mint");
        let balance: string; // raw, so it's in u64
        if (mint.equals(WSOL_MINT)) {
            const info = await connection.getAccountInfo(user);
            balance = info ? info.lamports.toString() : "0";
        } else {
            const ata = getAssociatedTokenAddressSync(mint, user);
            const info = await connection.getAccountInfo(ata);
            if (info) {
                balance = String(AccountLayout.decode(info.data).amount);
            } else {
                balance = "0";
            }
        }
        return balance;
    };

const treasuryBalanceSchema = z.object({
    game: z.string(),
});

export const getTreasuryBalance =
    ({ connection }: Deps) =>
    async (req: Request) => {
        const { game: gameStr } = treasuryBalanceSchema.parse(req.body);
        const game = parsePublicKey(gameStr, "game");
        const { treasury_wallet } = Game.deriveAddresses(game);
        const v = await connection.getTokenAccountBalance(treasury_wallet);
        return v.value.amount;
    };

const ctxParamsSchema = z.object({
    insName: z.string(),
});

export const getContext =
    ({ cache, priorityFeeService }: Deps) =>
    async (req: Request) => {
        const { insName } = ctxParamsSchema.parse(req.params);
        const [glb, reasonablePriorityFee] = await Promise.all([
            cache.blockhash.get(),
            priorityFeeService?.getFor(insName) || 1_000,
        ]);
        return {
            blockhash: glb.blockhash,
            lastValidBlockHeight: glb.lastValidBlockHeight,
            reasonablePriorityFee,
        };
    };

export const getWorldAlt =
    ({ cache }: Deps) =>
    async (_req: Request) => {
        const { alt, data } = await cache.worldAlt.get();
        return {
            key: alt.key.toBase58(),
            data: data.toString("base64"),
        };
    };
