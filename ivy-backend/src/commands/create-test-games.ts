import { Command } from "commander";
import {
    AddressLookupTableAccount,
    Connection,
    PublicKey,
    SendTransactionError,
} from "@solana/web3.js";
import { Game, World } from "ivy-sdk";
import { confirmTransaction } from "../functions/confirmTransaction";
import { requestAirdrop } from "../functions/requestAirdrop";
import { createAndUploadMetadata } from "../util";
import { getOrCreateKeypair } from "../utils/keypair";

export function registerCreateTestGamesCommand(
    program: Command,
    connection: Connection,
) {
    program
        .command("create-test-games")
        .description("Create multiple test games with random data concurrently")
        .option("-c, --count <number>", "Number of games to create", "5")
        .option("-b, --batch-size <number>", "Concurrent batch size", "3")
        .option("-k, --keypair <path>", "Path to keypair file for signing")
        .option("-a, --airdrop", "Request airdrop to wallet", false)
        .action(async (options) => {
            try {
                const gameCount = parseInt(options.count);
                const batchSize = parseInt(options.batchSize);

                if (isNaN(gameCount) || gameCount <= 0) {
                    console.error("Game count must be a positive number");
                    process.exit(1);
                }
                if (isNaN(batchSize) || batchSize <= 0) {
                    console.error("Batch size must be a positive number");
                    process.exit(1);
                }

                console.log(
                    `Creating ${gameCount} test games with batch size ${batchSize}...`,
                );

                const userWallet = getOrCreateKeypair(options.keypair);

                if (options.airdrop) {
                    console.log("Requesting airdrop for wallet...");
                    const signature = await requestAirdrop(
                        connection,
                        userWallet.publicKey,
                    );
                    console.log("Airdrop successful:", signature);
                }

                const gameDataList = Array.from(
                    { length: gameCount },
                    (_, i) => ({
                        index: i,
                        name: `Test Game ${i + 1}`,
                        symbol: `TG${i + 1}`,
                        iconUrl: "/assets/images/placeholder_64x64.svg",
                        gameUrl: `https://example.com/games/game_${i + 1}`,
                        shortDesc: `This is the short description for game #${i + 1}`,
                        description: `This is test game #${i + 1}. It was automatically generated for testing purposes.`,
                    }),
                );

                const results = {
                    success: 0,
                    failed: 0,
                    gameAddresses: [] as string[],
                };

                const world_alt_address = (await World.loadState(connection))
                    .world_alt;
                const world_alt_data = (
                    await connection.getAccountInfo(world_alt_address)
                )?.data;
                if (!world_alt_data) {
                    throw new Error("can't find game alt");
                }

                const world_alt = new AddressLookupTableAccount({
                    key: new PublicKey(world_alt_address),
                    state: AddressLookupTableAccount.deserialize(
                        world_alt_data,
                    ),
                });

                await Promise.all(
                    gameDataList.map(async (gameData) => {
                        const {
                            index,
                            name,
                            symbol,
                            iconUrl,
                            gameUrl,
                            shortDesc,
                            description,
                        } = gameData;

                        console.log(
                            `\nPreparing game ${index + 1}/${gameCount}:`,
                        );
                        console.log(`- Name: ${name}`);
                        console.log(`- Symbol: ${symbol}`);

                        try {
                            const seed = Game.generateSeed();
                            const gameAddress = Game.deriveAddress(seed);

                            const metadataUrl = await createAndUploadMetadata(
                                name,
                                symbol,
                                iconUrl,
                                description,
                            );

                            const recent_slot =
                                (await connection.getSlot()) - 1;
                            const transaction = await Game.create(
                                seed,
                                name,
                                symbol,
                                iconUrl,
                                gameUrl,
                                shortDesc,
                                metadataUrl,
                                userWallet.publicKey,
                                recent_slot,
                                "0",
                                world_alt,
                            );

                            const { lastValidBlockHeight, blockhash } =
                                await connection.getLatestBlockhash();
                            transaction.message.recentBlockhash = blockhash;
                            transaction.sign([userWallet]);

                            console.log(
                                `Game address: ${gameAddress.toString()}`,
                            );
                            console.log(
                                `Sending transaction for game ${index + 1}...`,
                            );

                            let txid: string;
                            try {
                                txid = await connection.sendRawTransaction(
                                    transaction.serialize(),
                                );
                            } catch (e) {
                                if (e instanceof SendTransactionError) {
                                    console.error(
                                        `Failed transaction for game ${index + 1}`,
                                        (e as any).signature,
                                    );
                                    console.error(e.message);
                                    console.error(await e.getLogs(connection));
                                    results.failed++;
                                    return;
                                } else {
                                    throw e;
                                }
                            }
                            console.log(
                                `Transaction sent with signature: ${txid}`,
                            );

                            console.log(
                                `Confirming transaction for game ${index + 1}...`,
                            );
                            await confirmTransaction(
                                connection,
                                txid,
                                lastValidBlockHeight,
                            );
                            console.log(
                                `Game ${index + 1} created successfully!`,
                            );

                            results.success++;
                            results.gameAddresses.push(gameAddress.toString());
                        } catch (error) {
                            console.error(
                                `Error creating game ${index + 1}:`,
                                error,
                            );
                            results.failed++;
                        }
                    }),
                );

                console.log(`\n===== SUMMARY =====`);
                console.log(`Total games: ${gameCount}`);
                console.log(`Successfully created: ${results.success}`);
                console.log(`Failed: ${results.failed}`);
                console.log(
                    `Game addresses: ${results.gameAddresses.join(", ")}`,
                );
            } catch (error) {
                console.error("Error in create-test-games command:", error);
                process.exit(1);
            }
        });
}
