import { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export interface PreparedTransaction {
    insName: string;
    base64: string;
    feePayer: string;
    derived: {
        seeds: string[];
        programId: string;
    }[];
}

export const NULL_BLOCKHASH: string = PublicKey.default.toBase58();

export function prepareTransaction(
    insName: string,
    tx: Transaction | VersionedTransaction,
    feePayer: PublicKey | Keypair,
    derived?: {
        seeds: PublicKey[];
        program_id: PublicKey;
    }[],
): PreparedTransaction {
    let txData: Buffer;
    if (tx instanceof Transaction) {
        tx.recentBlockhash = NULL_BLOCKHASH;
        if (feePayer instanceof Keypair) {
            tx.feePayer = feePayer.publicKey;
        } else {
            tx.feePayer = feePayer;
        }
        txData = tx.serialize({ requireAllSignatures: false });
    } else {
        // VersionedTransaction requires a recentBlockhash to serialize
        tx.message.recentBlockhash = NULL_BLOCKHASH;
        if (!(feePayer instanceof Keypair)) {
            throw new Error(
                "When preparing VersionedTransaction, we need a fake keypair",
            );
        }
        // Avoids "Expected signatures length to be equal to the number of required signatures"
        tx.sign([feePayer]);
        txData = Buffer.from(tx.serialize());
    }

    return {
        insName,
        base64: txData.toString("base64"),
        feePayer:
            feePayer instanceof Keypair
                ? feePayer.publicKey.toBase58()
                : feePayer.toBase58(),
        derived:
            derived?.map((x) => ({
                seeds: x.seeds.map((s) => s.toBase58()),
                programId: x.program_id.toBase58(),
            })) || [],
    };
}
