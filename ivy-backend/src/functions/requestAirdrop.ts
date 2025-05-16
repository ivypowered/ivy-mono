import { Connection, PublicKey } from "@solana/web3.js";

/**
 * Request an airdrop of SOL to the given wallet
 */
export async function requestAirdrop(
    connection: Connection,
    wallet: PublicKey,
    amount: number = 5,
): Promise<string> {
    const signature = await connection.requestAirdrop(
        wallet,
        amount * 1_000_000_000, // Convert to lamports
    );
    await connection.confirmTransaction(signature, "confirmed");
    return signature;
}
