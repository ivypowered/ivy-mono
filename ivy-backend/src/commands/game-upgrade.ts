import { Command } from "commander";
import { Connection, PublicKey } from "@solana/web3.js";
import { Game, fetchWebMetadata, World } from "ivy-sdk";
import { confirmTransaction } from "../functions/confirmTransaction";
import { getOrCreateKeypair } from "../utils/keypair";

export function registerGameUpgradeCommand(
    program: Command,
    connection: Connection,
) {
    program
        .command("game-upgrade")
        .description("Upgrade a game to the new format using its web metadata")
        .requiredOption("-g, --game <address>", "Game address to upgrade")
        .option(
            "-k, --keypair <path>",
            "Path to keypair file for signing (must be world owner)",
        )
        .action(async (options) => {
            try {
                console.log("Upgrading game to new format...");

                const gameAddress = new PublicKey(options.game);
                console.log(`Game address: ${gameAddress.toString()}`);

                const worldOwnerWallet = getOrCreateKeypair(options.keypair);
                console.log(
                    `World owner (signer): ${worldOwnerWallet.publicKey.toString()}`,
                );

                // Verify that the signer is the world owner
                try {
                    const worldState = await World.loadState(connection);
                    if (!worldState.owner.equals(worldOwnerWallet.publicKey)) {
                        console.error(
                            "Error: The provided keypair is not the world owner.",
                        );
                        console.error(
                            `Current world owner: ${worldState.owner.toString()}`,
                        );
                        console.error(
                            `Provided keypair: ${worldOwnerWallet.publicKey.toString()}`,
                        );
                        process.exit(1);
                    }
                    console.log("World ownership verified ✓");
                } catch (error) {
                    console.error("Error verifying world ownership:", error);
                    process.exit(1);
                }

                // Load chain metadata to get the metadata URL
                console.log("\nFetching game chain metadata...");
                let metadataUrl: string;
                try {
                    const chainMetadata = await Game.loadChainMetadata(
                        connection,
                        gameAddress,
                    );
                    metadataUrl = chainMetadata.metadata_url;
                    console.log(`Metadata URL: ${metadataUrl}`);
                } catch (error) {
                    console.error("Error loading chain metadata:", error);
                    process.exit(1);
                }

                // Fetch web metadata
                console.log("\nFetching web metadata...");
                let webMetadata;
                try {
                    webMetadata = await fetchWebMetadata(metadataUrl, 10000);
                    console.log("Web metadata fetched successfully");
                } catch (error) {
                    console.error("Error fetching web metadata:", error);
                    process.exit(1);
                }

                // Extract and process description for short_desc
                let shortDesc: string;
                if (webMetadata.description) {
                    const description = String(webMetadata.description);
                    const descBytes = new TextEncoder().encode(description);

                    if (descBytes.length <= 128) {
                        shortDesc = description;
                    } else {
                        // Take first 125 bytes and add "..."
                        const truncatedBytes = descBytes.slice(0, 125);
                        const truncatedStr = new TextDecoder().decode(
                            truncatedBytes,
                        );
                        shortDesc = truncatedStr + "...";
                    }
                    console.log(`\nShort description: ${shortDesc}`);
                } else {
                    console.error(
                        "Error: No description found in web metadata",
                    );
                    process.exit(1);
                }

                // Extract icon URL
                const iconUrl = webMetadata.image;
                if (!iconUrl) {
                    console.error("Error: No image found in web metadata");
                    process.exit(1);
                }
                console.log(`Icon URL: ${iconUrl}`);

                // Create upgrade transaction
                console.log("\nCreating upgrade transaction...");
                const transaction = await Game.upgrade(
                    gameAddress,
                    worldOwnerWallet.publicKey,
                    shortDesc,
                    iconUrl,
                );

                const { lastValidBlockHeight, blockhash } =
                    await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = worldOwnerWallet.publicKey;
                transaction.sign(worldOwnerWallet);

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
                console.log("Transaction confirmed! Game has been upgraded.");

                console.log("\n===== UPGRADE SUMMARY =====");
                console.log(`Game address: ${gameAddress.toString()}`);
                console.log(
                    `Short description: ${shortDesc.substring(0, 50)}${shortDesc.length > 50 ? "..." : ""}`,
                );
                console.log(`Icon URL: ${iconUrl}`);
            } catch (error) {
                console.error("Error upgrading game:", error);
                process.exit(1);
            }
        });
}
