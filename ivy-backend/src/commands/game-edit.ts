import { Command } from "commander";
import { Connection, PublicKey } from "@solana/web3.js";
import { Game } from "ivy-sdk";
import { confirmTransaction } from "../functions/confirmTransaction";
import { getOrCreateKeypair } from "../utils/keypair";

export function registerGameEditCommand(
    program: Command,
    connection: Connection,
) {
    program
        .command("game-edit")
        .description("Edit an existing game's details")
        .requiredOption("-g, --game <address>", "Game address to edit")
        .requiredOption("-o, --new-owner <address>", "New owner address")
        .requiredOption(
            "-w, --new-withdraw-authority <address>",
            "New withdraw authority address",
        )
        .requiredOption("-u, --game-url <url>", "New game URL")
        .requiredOption("-m, --metadata-url <url>", "New metadata URL")
        .option(
            "-k, --keypair <path>",
            "Path to keypair file for signing (must be current owner)",
        )
        .action(async (options) => {
            try {
                console.log("Editing game details...");

                const gameAddress = new PublicKey(options.game);
                console.log(`Game address: ${gameAddress.toString()}`);

                const ownerWallet = getOrCreateKeypair(options.keypair);
                console.log(
                    `Current owner (signer): ${ownerWallet.publicKey.toString()}`,
                );

                const newOwner = new PublicKey(options.newOwner);
                const newWithdrawAuthority = new PublicKey(
                    options.newWithdrawAuthority,
                );

                console.log("\nNew details:");
                console.log(`- New owner: ${newOwner.toString()}`);
                console.log(
                    `- New withdraw authority: ${newWithdrawAuthority.toString()}`,
                );
                console.log(`- Game URL: ${options.gameUrl}`);
                console.log(`- Icon URL: ${options.iconUrl}`);
                console.log(`- Short Desc: ${options.shortDesc}`);
                console.log(`- Metadata URL: ${options.metadataUrl}`);

                try {
                    const gameState = await Game.loadState(
                        connection,
                        gameAddress,
                    );
                    if (!gameState.owner.equals(ownerWallet.publicKey)) {
                        console.error(
                            "Error: The provided keypair is not the current owner of this game.",
                        );
                        console.error(
                            `Current owner: ${gameState.owner.toString()}`,
                        );
                        console.error(
                            `Provided keypair: ${ownerWallet.publicKey.toString()}`,
                        );
                        process.exit(1);
                    }
                    console.log("\nOwnership verified ✓");
                } catch {
                    console.warn(
                        "Warning: Could not verify ownership. Proceeding anyway...",
                    );
                }

                // Note: fixed original mismatch; we now pass options.shortDesc to Game.edit
                const transaction = await Game.edit(
                    gameAddress,
                    ownerWallet.publicKey,
                    newOwner,
                    newWithdrawAuthority,
                    options.gameUrl,
                    options.metadataUrl,
                );

                const { lastValidBlockHeight, blockhash } =
                    await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = ownerWallet.publicKey;
                transaction.sign(ownerWallet);

                console.log("\nSending transaction...");
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
                console.log("Transaction confirmed! Game has been updated.");

                console.log("\nUpdated game details:");
                console.log(`- Game address: ${gameAddress.toString()}`);
                console.log(`- New owner: ${newOwner.toString()}`);
                console.log(
                    `- New withdraw authority: ${newWithdrawAuthority.toString()}`,
                );
            } catch (error) {
                console.error("Error editing game:", error);
                process.exit(1);
            }
        });
}
