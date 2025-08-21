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

export function registerNewGameCommand(
    program: Command,
    connection: Connection,
) {
    program
        .command("new-game")
        .description("Create a new game")
        .requiredOption("-n, --name <name>", "Game name")
        .requiredOption("-s, --symbol <symbol>", "Game symbol")
        .requiredOption("-i, --iconUrl <url>", "Icon URL")
        .requiredOption("-g, --gameUrl <url>", "Game URL")
        .requiredOption("-d, --description <description>", "Game description")
        .option("-k, --keypair <path>", "Path to keypair file for signing")
        .option("-a, --airdrop", "Request airdrop to wallet", false)
        .action(async (options) => {
            try {
                const userWallet = getOrCreateKeypair(options.keypair);

                if (options.airdrop) {
                    console.log("Requesting airdrop for wallet...");
                    const signature = await requestAirdrop(
                        connection,
                        userWallet.publicKey,
                    );
                    console.log("Airdrop successful:", signature);
                }

                console.log("Creating new game...");

                const seed = Game.generateSeed();
                const gameAddress = Game.deriveAddress(seed);

                console.log("Creating and uploading metadata...");
                const metadataUrl = await createAndUploadMetadata(
                    options.name,
                    options.symbol,
                    options.iconUrl,
                    options.description,
                );

                const recent_slot = (await connection.getSlot()) - 1;
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

                const transaction = await Game.create(
                    seed,
                    options.name,
                    options.symbol,
                    options.iconUrl,
                    options.gameUrl,
                    options.description.slice(0, 128),
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

                console.log("Game creation transaction prepared");
                console.log(`Game address: ${gameAddress.toString()}`);
                console.log(
                    `User wallet address: ${userWallet.publicKey.toString()}`,
                );

                console.log("Sending transaction...");
                let txid: string;
                try {
                    txid = await connection.sendRawTransaction(
                        transaction.serialize(),
                    );
                } catch (e) {
                    if (e instanceof SendTransactionError) {
                        console.error(
                            "Failed transaction",
                            (e as any).signature,
                        );
                        console.error(e.message);
                        console.error(await e.getLogs(connection));
                        process.exit(1);
                    } else {
                        throw e;
                    }
                }
                console.log(`Transaction sent with signature: ${txid}`);

                console.log("Confirming transaction...");
                await confirmTransaction(
                    connection,
                    txid,
                    lastValidBlockHeight,
                );
                console.log("Transaction confirmed!");
            } catch (error) {
                console.error("Error creating game:", error);
                process.exit(1);
            }
        });
}
