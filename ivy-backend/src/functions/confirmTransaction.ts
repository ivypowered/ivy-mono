import { Connection } from "@solana/web3.js";

/**
 * Confirms a transaction
 */
export async function confirmTransaction(
    connection: Connection,
    signature: string,
    lastValidBlockHeight: number,
): Promise<void> {
    let status, blockHeight;
    while (true) {
        [status, blockHeight] = await Promise.all([
            connection.getSignatureStatus(signature),
            connection.getBlockHeight(),
        ]);

        if (blockHeight > lastValidBlockHeight) {
            throw new Error("Transaction expired (block height exceeded)");
        }

        if (status.value?.err) {
            throw new Error(
                `Transaction failed: ${JSON.stringify(status.value.err)}`,
            );
        }

        if (status.value?.confirmationStatus === "confirmed") {
            break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
}
