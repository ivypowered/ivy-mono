import { Command } from "commander";
import { Connection, PublicKey } from "@solana/web3.js";
import { World } from "ivy-sdk";
import { confirmTransaction } from "../functions/confirmTransaction";
import { getOrCreateKeypair } from "../utils/keypair";

export function registerSetOwnerCommand(
    program: Command,
    connection: Connection,
) {
    program
        .command("set-owner")
        .description("Set a new owner for the Ivy world")
        .requiredOption("-a, --address <address>", "New owner's public key")
        .option(
            "-k, --keypair <path>",
            "Path to keypair file for signing (must be current owner)",
        )
        .action(async (options) => {
            try {
                console.log("Setting new owner for Ivy world...");
                const signerWallet = getOrCreateKeypair(options.keypair);
                const newOwner = new PublicKey(options.address);
                console.log(`Setting new owner to: ${newOwner.toString()}`);

                const transaction = await World.setOwner(
                    newOwner,
                    signerWallet.publicKey,
                );
                const { lastValidBlockHeight, blockhash } =
                    await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = signerWallet.publicKey;
                transaction.sign(signerWallet);

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
                console.log("Transaction confirmed! Owner has been updated.");
            } catch (error) {
                console.error("Error setting new owner:", error);
                process.exit(1);
            }
        });
}
