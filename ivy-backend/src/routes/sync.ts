import { z } from "zod";
import { Request } from "express";
import { Deps } from "../types/deps";
import { Sync } from "ivy-sdk";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, Transaction } from "@solana/web3.js";
import { prepareTransaction } from "../utils/transactions";
import { parsePublicKey } from "../utils/requestHelpers";

const createSyncSchema = z.object({
    pump_mint: z.string(),
    seed: z.string(),
    name: z.string(),
    symbol: z.string(),
    metadata_url: z.string(),
    game_url: z.string(),
});

export const createSyncTx = (_deps: Deps) => async (req: Request) => {
    const data = createSyncSchema.parse(req.body);

    // Parse pump mint
    const pumpMint = parsePublicKey(data.pump_mint, "pump_mint");

    // Handle optional seed override
    const seed = Uint8Array.from(Buffer.from(data.seed, "hex"));

    // Derive the sync address
    const sync = Sync.deriveAddress(seed);

    // Derive the sync mint
    const syncMint = Sync.deriveMint(sync);

    // Generate a user keypair for the transaction
    const user = Keypair.generate().publicKey;

    // Create the sync instruction
    const instruction = await Sync.create(
        user,
        seed,
        pumpMint,
        data.name,
        data.symbol,
        data.metadata_url,
        data.game_url,
    );

    // Convert instruction to transaction
    const tx = new Transaction().add(instruction);

    // Prepare transaction with proper ALTs
    const prepared = prepareTransaction("SyncCreate", tx, user, [
        // User's sync mint ATA
        {
            seeds: [user, TOKEN_PROGRAM_ID, syncMint],
            program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
        },
        // User's pump mint ATA (might be needed for future swaps)
        {
            seeds: [user, TOKEN_PROGRAM_ID, pumpMint],
            program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
        },
    ]);

    return {
        sync_address: sync.toString(),
        sync_mint: syncMint.toString(),
        seed: Buffer.from(seed).toString("hex"),
        tx: prepared,
    };
};
