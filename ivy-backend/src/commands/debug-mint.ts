import { Command } from "commander";
import { Connection, PublicKey } from "@solana/web3.js";
import { confirmTransaction } from "../functions/confirmTransaction";
import { requestAirdrop } from "../functions/requestAirdrop";
import { debugMint } from "../functions/debugMint";
import { getOrCreateKeypair } from "../utils/keypair";

export function registerDebugMintCommand(
    program: Command,
    connection: Connection,
) {
    program
        .command("debug-mint")
        .description("Mint tokens to a wallet for testing purposes")
        .requiredOption("-a, --amount <amount>", "Amount to mint", parseFloat)
        .requiredOption("-m, --mint <address>", "Mint address")
        .option(
            "-k, --keypair <path>",
            "Path to keypair file for receiving tokens",
        )
        .option(
            "-u, --user <address>",
            "Alternative address for receiving tokens",
        )
        .action(async (options) => {
            try {
                console.log(`Debug minting ${options.amount} tokens...`);
                const signerWallet = getOrCreateKeypair(options.keypair);

                console.log("Requesting airdrop for transaction fees...");
                try {
                    const airdropSig = await requestAirdrop(
                        connection,
                        signerWallet.publicKey,
                        5,
                    );
                    console.log(`Airdrop successful: ${airdropSig}`);
                    await connection.confirmTransaction(airdropSig);
                } catch (airdropError) {
                    console.warn(
                        "Airdrop failed, proceeding anyway:",
                        airdropError,
                    );
                }

                const receiverAddress = options.user
                    ? new PublicKey(options.user)
                    : signerWallet.publicKey;

                console.log(`Receiver address: ${receiverAddress.toString()}`);
                console.log(`Mint address: ${options.mint}`);

                const { transaction, lastValidBlockHeight } = await debugMint(
                    connection,
                    options.amount,
                    signerWallet,
                    options.mint,
                    receiverAddress,
                );

                console.log("Sending transaction...");
                const txid = await connection.sendRawTransaction(
                    transaction.serialize(),
                );
                console.log(`Transaction sent with signature: ${txid}`);

                console.log("Confirming transaction...");
                await confirmTransaction(
                    connection,
                    txid,
                    lastValidBlockHeight,
                );
                console.log(
                    `Transaction confirmed! ${options.amount} tokens minted to ${receiverAddress.toString()}`,
                );
            } catch (error) {
                console.error("Error minting tokens:", error);
                process.exit(1);
            }
        });
}
