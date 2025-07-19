import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
    getMint,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountIdempotentInstruction,
    createMintToInstruction,
} from "@solana/spl-token";
import { DEBUG_MINT_KEYPAIR } from "../constants";

/**
 * Creates a debug mint transaction for testing purposes
 * Must be signed by both `signerKeypair` and `DEBUG_MINT_KEYPAIR`
 */
export async function debugMint(
    connection: Connection,
    amount: number,
    signerKeypair: Keypair,
    mintAddress: string,
    receiverAddress: PublicKey,
): Promise<{ transaction: Transaction; lastValidBlockHeight: number }> {
    if (!signerKeypair.publicKey) throw new Error("Wallet not connected");

    const mint = await getMint(connection, new PublicKey(mintAddress));
    const tokenAccount = await getAssociatedTokenAddress(
        new PublicKey(mintAddress),
        receiverAddress,
    );

    // Create the transaction
    const tx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
            signerKeypair.publicKey,
            tokenAccount,
            receiverAddress,
            new PublicKey(mintAddress),
        ),
        createMintToInstruction(
            new PublicKey(mintAddress),
            tokenAccount,
            DEBUG_MINT_KEYPAIR.publicKey,
            Math.floor(amount * Math.pow(10, mint.decimals)),
        ),
    );

    // Get recent blockhash for the transaction
    const { lastValidBlockHeight, blockhash: recentBlockhash } =
        await connection.getLatestBlockhash();
    tx.recentBlockhash = recentBlockhash;
    tx.feePayer = signerKeypair.publicKey;

    tx.sign(DEBUG_MINT_KEYPAIR, signerKeypair);

    return {
        transaction: tx,
        lastValidBlockHeight,
    };
}
