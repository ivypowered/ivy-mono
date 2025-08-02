import { program } from "commander";
import {
    AddressLookupTableAccount,
    Connection,
    Keypair,
    PublicKey,
    SendTransactionError,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { confirmTransaction } from "./functions/confirmTransaction";
import { requestAirdrop } from "./functions/requestAirdrop";
import { debugMint } from "./functions/debugMint";
import { World, USDC_MINT, IVY_MINT, Game, Comment } from "ivy-sdk";
import { createAndUploadMetadata, uploadImageToIPFS } from "./util";
import { RPC_URL } from "./constants";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// Create connection to the Solana blockchain
const connection = new Connection(RPC_URL, "confirmed");

// Load environment variables
dotenv.config();

// Initialize commander
program
    .name("ivy-cli")
    .description("CLI tool for Ivy development operations")
    .version("0.1.0");

// Shared function to load or create a keypair
const getOrCreateKeypair = (keypairPath?: string): Keypair => {
    if (keypairPath) {
        const resolvedPath = path.resolve(keypairPath);
        if (!fs.existsSync(resolvedPath)) {
            console.error(`Keypair file not found: ${resolvedPath}`);
            process.exit(1);
        }
        const keypairData = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
        const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
        console.log(`Using provided keypair: ${keypair.publicKey.toString()}`);
        return keypair;
    } else {
        const keypair = Keypair.generate();
        console.log(`Generated new keypair: ${keypair.publicKey.toString()}`);
        return keypair;
    }
};

program
    .command("new-world")
    .description("Create a new Ivy world")
    .requiredOption("-n, --name <name>", "World name")
    .requiredOption("-s, --symbol <symbol>", "World symbol")
    .requiredOption("-i, --icon <iconPath>", "Path to icon file")
    .requiredOption("-d, --description <description>", "World description")
    .requiredOption(
        "-c, --ivy-curve-supply <supply>",
        "IVY curve supply",
        parseInt,
    )
    .requiredOption(
        "-v, --ivy-vesting-supply <supply>",
        "IVY vesting supply",
        parseInt,
    )
    .requiredOption(
        "--input-scale-num <scale>",
        "Input scale numerator",
        parseInt,
    )
    .requiredOption(
        "--input-scale-den <scale>",
        "Input scale denominator",
        parseInt,
    )
    .option("-k, --keypair <path>", "Path to keypair file for signing")
    .option("-a, --airdrop", "Request airdrop to provided wallet")
    .action(async (options) => {
        try {
            console.log("Creating new Ivy world...");

            // Read and validate the icon file
            const iconPath = path.resolve(options.icon);
            if (!fs.existsSync(iconPath)) {
                console.error(`Icon file not found: ${iconPath}`);
                process.exit(1);
            }

            const iconBase64 = fs.readFileSync(iconPath, {
                encoding: "base64",
            });
            const iconType =
                path.extname(iconPath).toLowerCase() === ".png"
                    ? "image/png"
                    : path.extname(iconPath).toLowerCase() === ".jpg" ||
                        path.extname(iconPath).toLowerCase() === ".jpeg"
                      ? "image/jpeg"
                      : path.extname(iconPath).toLowerCase() === ".gif"
                        ? "image/gif"
                        : path.extname(iconPath).toLowerCase() === ".webp"
                          ? "image/webp"
                          : null;

            if (!iconType) {
                console.error(
                    "Invalid image type. Supported types: JPEG, PNG, GIF, WebP",
                );
                process.exit(1);
            }

            // Get or create keypair for the transaction
            const userWallet = getOrCreateKeypair(options.keypair);

            if (options.airdrop) {
                // Request airdrop to wallet
                console.log("Requesting airdrop to wallet...");
                const signature = await requestAirdrop(
                    connection,
                    userWallet.publicKey,
                );
                console.log("Airdrop successful:", signature);
            }

            // Upload icon to IPFS
            console.log("Uploading icon to IPFS...");
            const iconUrl = await uploadImageToIPFS(iconBase64, iconType);

            // Create and upload metadata
            console.log("Creating and uploading metadata...");
            const metadataUrl = await createAndUploadMetadata(
                options.name,
                options.symbol,
                iconUrl,
                options.description,
            );

            // Create the transaction using World.create
            console.log("Creating world transaction...");
            const recentSlot = (await connection.getSlot()) - 1;
            const transaction = await World.create(
                options.name,
                options.symbol,
                iconUrl,
                metadataUrl,
                options.ivyCurveSupply,
                options.ivyVestingSupply,
                options.inputScaleNum,
                options.inputScaleDen,
                userWallet.publicKey,
                recentSlot,
            );

            // Add recent blockhash and sign
            const { lastValidBlockHeight, blockhash } =
                await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = userWallet.publicKey;
            transaction.sign(userWallet);

            console.log("Sending transaction...");
            const txid = await connection.sendRawTransaction(
                transaction.serialize(),
            );
            console.log(`Transaction sent with signature: ${txid}`);

            console.log("Confirming transaction...");
            await confirmTransaction(connection, txid, lastValidBlockHeight);
            console.log(`Transaction confirmed!`);

            console.log("World details:");
            console.log(`- Name: ${options.name}`);
            console.log(`- Symbol: ${options.symbol}`);

            // Load and display the newly created world
            console.log("\nFetching new world state...");
            try {
                const worldState = await World.loadState(connection);
                console.log(`- Owner: ${worldState.owner.toString()}`);
                console.log(`- IVY Mint: ${worldState.ivy_mint.toString()}`);
                console.log(`- Curve Supply: ${worldState.ivy_curve_max}`);
                console.log(`- Vesting Supply: ${worldState.ivy_vesting_max}`);
            } catch (e) {
                console.log(
                    "Could not load world state, but world was created successfully.",
                );
            }
        } catch (error) {
            console.error("Error creating world:", error);
            process.exit(1);
        }
    });

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

            // Get keypair for the transaction
            const signerWallet = getOrCreateKeypair(options.keypair);

            // Parse the new owner address
            const newOwner = new PublicKey(options.address);

            console.log(`Setting new owner to: ${newOwner.toString()}`);

            // Create the transaction using the World library
            const transaction = await World.setOwner(
                newOwner,
                signerWallet.publicKey,
            );

            // Add recent blockhash
            const { lastValidBlockHeight, blockhash } =
                await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = signerWallet.publicKey;

            // Sign the transaction
            transaction.sign(signerWallet);

            console.log("Sending transaction...");
            const txid = await connection.sendRawTransaction(
                transaction.serialize(),
            );
            console.log(`Transaction sent with signature: ${txid}`);

            console.log("Confirming transaction...");
            await confirmTransaction(connection, txid, lastValidBlockHeight);
            console.log("Transaction confirmed! Owner has been updated.");
        } catch (error) {
            console.error("Error setting new owner:", error);
            process.exit(1);
        }
    });

program
    .command("load-world")
    .description("Load details for the Ivy world")
    .action(async () => {
        try {
            console.log(`Loading world details...`);
            const worldState = await World.loadState(connection);

            console.log("\nWorld Details:");
            console.log(`Owner: ${worldState.owner.toString()}`);
            console.log(`IVY Mint: ${worldState.ivy_mint.toString()}`);
            console.log(`USDC Wallet: ${worldState.usdc_wallet.toString()}`);
            console.log(`Curve Wallet: ${worldState.curve_wallet.toString()}`);
            console.log(
                `Vesting Wallet: ${worldState.vesting_wallet.toString()}`,
            );
            console.log(`USDC Balance: ${worldState.usdc_balance}`);
            console.log(`IVY Curve Sold: ${worldState.ivy_curve_sold}`);
            console.log(`IVY Curve Max: ${worldState.ivy_curve_max}`);
            console.log(
                `IVY Vesting Released: ${worldState.ivy_vesting_released}`,
            );
            console.log(`IVY Vesting Max: ${worldState.ivy_vesting_max}`);
            console.log(
                `IVY Initial Liquidity: ${worldState.ivy_initial_liquidity}`,
            );
            console.log(
                `Game Initial Liquidity: ${worldState.game_initial_liquidity}`,
            );
            console.log(
                `Curve Input Scale Numerator: ${worldState.curve_input_scale_num}`,
            );
            console.log(
                `Curve Input Scale Denominator: ${worldState.curve_input_scale_den}`,
            );
            console.log(`IVY Fee BPS: ${worldState.ivy_fee_bps}`);
            console.log(`Game Fee BPS: ${worldState.game_fee_bps}`);
        } catch (error) {
            console.error("Error loading world:", error);
            process.exit(1);
        }
    });

program
    .command("world-swap")
    .description("Swap between USDC and IVY tokens")
    .requiredOption(
        "-a, --amount <amount>",
        "Amount to swap (in smallest units)",
        parseInt,
    )
    .requiredOption(
        "-t, --threshold <amount>",
        "Minimum amount to receive (slippage protection)",
        parseInt,
    )
    .option(
        "-b, --buy",
        "Buy IVY with USDC (default is sell IVY for USDC)",
        false,
    )
    .option("-k, --keypair <path>", "Path to keypair file for signing")
    .action(async (options) => {
        try {
            // Get keypair for the transaction
            const signerWallet = getOrCreateKeypair(options.keypair);

            console.log(
                `Executing ${options.buy ? "buy" : "sell"} swap for ${options.amount} tokens...`,
            );
            console.log(`Minimum tokens to receive: ${options.threshold}`);

            // Define source and destination token accounts
            const sourceMint = options.buy ? USDC_MINT : IVY_MINT;
            const sourceAccount = getAssociatedTokenAddressSync(
                sourceMint,
                signerWallet.publicKey,
            );

            const destinationMint = options.buy ? IVY_MINT : USDC_MINT;
            const destinationAccount = getAssociatedTokenAddressSync(
                destinationMint,
                signerWallet.publicKey,
            );

            // Create the transaction using the World library
            const transaction = await World.swap(
                options.amount,
                options.threshold,
                options.buy,
                signerWallet.publicKey,
            );

            // Add recent blockhash
            const { lastValidBlockHeight, blockhash } =
                await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = signerWallet.publicKey;

            // Sign the transaction
            transaction.sign(signerWallet);

            console.log(`Source account: ${sourceAccount.toString()}`);
            console.log(
                `Destination account: ${destinationAccount.toString()}`,
            );
            // Get current balance
            let starting_balance = 0;
            try {
                starting_balance =
                    (
                        await connection.getTokenAccountBalance(
                            destinationAccount,
                        )
                    ).value.uiAmount || 0;
            } catch {
                // can't find account
            }
            console.log("Sending transaction...");

            try {
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
                const ending_balance =
                    (
                        await connection.getTokenAccountBalance(
                            destinationAccount,
                        )
                    ).value.uiAmount || 0;
                const amount = ending_balance - starting_balance;
                console.log(
                    "Swap completed successfully - received " +
                        amount +
                        " IVY.",
                );
            } catch (e) {
                if (e instanceof SendTransactionError) {
                    console.error("Failed transaction", (e as any).signature);
                    console.error(e.message);
                    console.error(await e.getLogs(connection));
                    process.exit(1);
                } else {
                    throw e;
                }
            }
        } catch (error) {
            console.error("Error executing swap:", error);
            process.exit(1);
        }
    });

program
    .command("set-params")
    .description("Set all World parameters at once")
    .requiredOption(
        "-i, --ivy-liquidity <amount>",
        "Initial liquidity amount for Ivy",
    )
    .requiredOption(
        "-g, --game-liquidity <amount>",
        "Initial liquidity amount for games",
    )
    .requiredOption(
        "--ivy-fee <fee>",
        "Fee basis points for Ivy token operations (0-255)",
        parseInt,
    )
    .requiredOption(
        "--game-fee <fee>",
        "Fee basis points for game token operations (0-255)",
        parseInt,
    )
    .option(
        "-k, --keypair <path>",
        "Path to keypair file for signing (must be owner)",
    )
    .action(async (options) => {
        try {
            // Validate fee ranges
            if (options.ivyFee < 0 || options.ivyFee > 255) {
                console.error("Ivy fee basis points must be between 0 and 255");
                process.exit(1);
            }

            if (options.gameFee < 0 || options.gameFee > 255) {
                console.error(
                    "Game fee basis points must be between 0 and 255",
                );
                process.exit(1);
            }

            console.log("Setting World parameters:");
            console.log(`- Ivy initial liquidity: ${options.ivyLiquidity}`);
            console.log(`- Game initial liquidity: ${options.gameLiquidity}`);
            console.log(`- Ivy fee basis points: ${options.ivyFee}`);
            console.log(`- Game fee basis points: ${options.gameFee}`);

            // Get keypair for the transaction
            const signerWallet = getOrCreateKeypair(options.keypair);

            // Create the transaction using the World library
            const transaction = await World.setParams(
                {
                    ivy_initial_liquidity: options.ivyLiquidity,
                    game_initial_liquidity: options.gameLiquidity,
                    ivy_fee_bps: options.ivyFee,
                    game_fee_bps: options.gameFee,
                },
                signerWallet.publicKey,
            );

            // Add recent blockhash
            const { lastValidBlockHeight, blockhash } =
                await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = signerWallet.publicKey;

            // Sign the transaction
            transaction.sign(signerWallet);

            console.log("Sending transaction...");
            const txid = await connection.sendRawTransaction(
                transaction.serialize(),
            );
            console.log(`Transaction sent with signature: ${txid}`);

            console.log("Confirming transaction...");
            await confirmTransaction(connection, txid, lastValidBlockHeight);
            console.log(
                "Transaction confirmed! World parameters have been updated.",
            );
        } catch (error) {
            console.error("Error setting World parameters:", error);
            process.exit(1);
        }
    });

// Keep the existing commands that don't need to be changed
program
    .command("new-game")
    .description("Create a new game")
    .requiredOption("-n, --name <name>", "Game name")
    .requiredOption("-s, --symbol <symbol>", "Game symbol")
    .requiredOption("-i, --iconUrl <url>", "Icon URL")
    .requiredOption("-g, --gameUrl <url>", "Game URL")
    .requiredOption("-c, --coverUrl <url>", "Cover URL")
    .requiredOption("-d, --description <description>", "Game description")
    .option("-k, --keypair <path>", "Path to keypair file for signing")
    .option("-a, --airdrop", "Request airdrop to wallet", false)
    .action(async (options) => {
        try {
            // Get or create keypair for the transaction
            const userWallet = getOrCreateKeypair(options.keypair);

            if (options.airdrop) {
                // Request airdrop to the user wallet to cover transaction fees
                console.log("Requesting airdrop for wallet...");
                const signature = await requestAirdrop(
                    connection,
                    userWallet.publicKey,
                );
                console.log("Airdrop successful:", signature);
            }

            console.log("Creating new game...");

            // Generate a valid game seed
            const seed = Game.generateSeed();
            const gameAddress = Game.deriveAddress(seed);

            // Create and upload metadata
            console.log("Creating and uploading metadata...");
            const metadataUrl = await createAndUploadMetadata(
                options.name,
                options.symbol,
                options.iconUrl,
                options.description,
            );

            // Create the transaction using the Game library
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
                state: AddressLookupTableAccount.deserialize(world_alt_data),
            });
            const transaction = await Game.create(
                seed,
                options.name,
                options.symbol,
                options.iconUrl,
                options.gameUrl,
                options.coverUrl,
                metadataUrl,
                userWallet.publicKey,
                recent_slot,
                "0",
                "0",
                world_alt,
            );

            // Add recent blockhash and sign
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
                    console.error("Failed transaction", (e as any).signature);
                    console.error(e.message);
                    console.error(await e.getLogs(connection));
                    process.exit(1);
                } else {
                    throw e;
                }
            }
            console.log(`Transaction sent with signature: ${txid}`);

            console.log("Confirming transaction...");
            await confirmTransaction(connection, txid, lastValidBlockHeight);
            console.log("Transaction confirmed!");

            return;
        } catch (error) {
            console.error("Error creating game:", error);
            process.exit(1);
        }
    });

program
    .command("debug-mint")
    .description("Mint tokens to a wallet for testing purposes")
    .requiredOption("-a, --amount <amount>", "Amount to mint", parseFloat)
    .requiredOption("-m, --mint <address>", "Mint address")
    .option("-k, --keypair <path>", "Path to keypair file for receiving tokens")
    .option("-u, --user <address>", "Alternative address for receiving tokens")
    .action(async (options) => {
        try {
            console.log(`Debug minting ${options.amount} tokens...`);

            // Get keypair for signing the transaction
            const signerWallet = getOrCreateKeypair(options.keypair);

            // Request airdrop for transaction fees
            console.log("Requesting airdrop for transaction fees...");
            try {
                const airdropSig = await requestAirdrop(
                    connection,
                    signerWallet.publicKey,
                    5,
                );
                console.log(`Airdrop successful: ${airdropSig}`);
                // Wait for the airdrop to confirm
                await connection.confirmTransaction(airdropSig);
            } catch (airdropError) {
                console.warn(
                    "Airdrop failed, proceeding anyway:",
                    airdropError,
                );
            }

            // Determine the receiver address
            let receiverAddress;
            if (options.user) {
                // Use provided alternative address
                receiverAddress = new PublicKey(options.user);
                console.log(
                    `Receiver address (from --user): ${receiverAddress.toString()}`,
                );
            } else {
                // Use the keypair's public key
                receiverAddress = signerWallet.publicKey;
                console.log(
                    `Receiver address (from keypair): ${receiverAddress.toString()}`,
                );
            }

            console.log(`Mint address: ${options.mint}`);

            // Create and sign the transaction
            const { transaction, lastValidBlockHeight } = await debugMint(
                connection,
                options.amount,
                signerWallet,
                options.mint,
                receiverAddress, // Pass the receiver address to the debugMint function
            );

            console.log("Sending transaction...");
            const txid = await connection.sendRawTransaction(
                transaction.serialize(),
            );
            console.log(`Transaction sent with signature: ${txid}`);

            console.log("Confirming transaction...");
            await confirmTransaction(connection, txid, lastValidBlockHeight);
            console.log(
                `Transaction confirmed! ${options.amount} tokens minted to ${receiverAddress.toString()}`,
            );
        } catch (error) {
            console.error("Error minting tokens:", error);
            process.exit(1);
        }
    });

program
    .command("get-comments")
    .description("Get all comments for a game")
    .requiredOption("-g, --game <address>", "Game address")
    .action(async (options) => {
        try {
            console.log("Fetching comments for game...");

            // Parse the game address
            const gameAddress = new PublicKey(options.game);
            console.log(`Game address: ${gameAddress.toString()}`);

            // Get the comment index to find out how many comment buffers exist
            console.log("Getting comment index...");
            const commentIndex = await Comment.getIndex(
                connection,
                gameAddress,
            );

            console.log(
                `Comment buffer address: ${commentIndex.bufAddress.toString()}`,
            );
            console.log(`Current buffer index: ${commentIndex.bufIndex}`);
            console.log(`Buffer nonce: ${commentIndex.bufNonce}`);

            // Get all comments from 0 to bufIndex + 1
            const endIndex = commentIndex.bufIndex + 1;
            console.log(`Fetching comments from buffer 0 to ${endIndex}...`);

            const comments = await Comment.getComments(
                connection,
                gameAddress,
                0,
                endIndex,
            );

            console.log(`\nFound ${comments.length} comments:`);
            console.log("=".repeat(60));

            if (comments.length === 0) {
                console.log("No comments found for this game.");
            } else {
                comments.forEach((comment, index) => {
                    const date = new Date(comment.timestamp * 1000);
                    console.log(`\nComment ${index + 1}:`);
                    console.log(`  User: ${comment.user.toString()}`);
                    console.log(`  Timestamp: ${date.toISOString()}`);
                    console.log(`  Text: ${JSON.stringify(comment.text)}`);
                    console.log("-".repeat(40));
                });
            }

            console.log(`\nTotal comments: ${comments.length}`);
        } catch (error) {
            console.error("Error fetching comments:", error);
            process.exit(1);
        }
    });

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

            // Get or create keypair for the transaction
            const userWallet = getOrCreateKeypair(options.keypair);

            if (options.airdrop) {
                // Request airdrop to the user wallet to cover transaction fees
                console.log("Requesting airdrop for wallet...");
                const signature = await requestAirdrop(
                    connection,
                    userWallet.publicKey,
                );
                console.log("Airdrop successful:", signature);
            }

            // Create game data array
            const gameDataList = Array.from({ length: gameCount }, (_, i) => ({
                index: i,
                name: `Test Game ${i + 1}`,
                symbol: `TG${i + 1}`,
                iconUrl: "/assets/images/placeholder_64x64.svg",
                gameUrl: `https://example.com/games/game_${i + 1}`,
                coverUrl: "/assets/images/placeholder_800x400.svg",
                description: `This is test game #${i + 1}. It was automatically generated for testing purposes.`,
            }));

            // Track results
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
                state: AddressLookupTableAccount.deserialize(world_alt_data),
            });

            await Promise.all(
                gameDataList.map(async (gameData) => {
                    const {
                        index,
                        name,
                        symbol,
                        iconUrl,
                        gameUrl,
                        coverUrl,
                        description,
                    } = gameData;

                    console.log(`\nPreparing game ${index + 1}/${gameCount}:`);
                    console.log(`- Name: ${name}`);
                    console.log(`- Symbol: ${symbol}`);

                    try {
                        // Generate seed and derive addresses
                        const seed = Game.generateSeed();
                        const gameAddress = Game.deriveAddress(seed);

                        // Create and upload metadata
                        const metadataUrl = await createAndUploadMetadata(
                            name,
                            symbol,
                            iconUrl,
                            description,
                        );

                        // Create transaction using Game library
                        const recent_slot = (await connection.getSlot()) - 1;
                        const transaction = await Game.create(
                            seed,
                            name,
                            symbol,
                            iconUrl,
                            gameUrl,
                            coverUrl,
                            metadataUrl,
                            userWallet.publicKey,
                            recent_slot,
                            "0",
                            "0",
                            world_alt,
                        );

                        // Add recent blockhash and sign
                        const { lastValidBlockHeight, blockhash } =
                            await connection.getLatestBlockhash();
                        transaction.message.recentBlockhash = blockhash;
                        transaction.sign([userWallet]);

                        console.log(`Game address: ${gameAddress.toString()}`);
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
                        console.log(`Transaction sent with signature: ${txid}`);

                        console.log(
                            `Confirming transaction for game ${index + 1}...`,
                        );
                        await confirmTransaction(
                            connection,
                            txid,
                            lastValidBlockHeight,
                        );
                        console.log(`Game ${index + 1} created successfully!`);

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
            console.log(`Game addresses: ${results.gameAddresses.join(", ")}`);
        } catch (error) {
            console.error("Error in create-test-games command:", error);
            process.exit(1);
        }
    });

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
    .requiredOption("-c, --cover-url <url>", "New cover URL")
    .requiredOption("-m, --metadata-url <url>", "New metadata URL")
    .option(
        "-k, --keypair <path>",
        "Path to keypair file for signing (must be current owner)",
    )
    .action(async (options) => {
        try {
            console.log("Editing game details...");

            // Parse the game address
            const gameAddress = new PublicKey(options.game);
            console.log(`Game address: ${gameAddress.toString()}`);

            // Get keypair for the transaction (must be current owner)
            const ownerWallet = getOrCreateKeypair(options.keypair);
            console.log(
                `Current owner (signer): ${ownerWallet.publicKey.toString()}`,
            );

            // Parse the new owner and withdraw authority addresses
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
            console.log(`- Cover URL: ${options.coverUrl}`);
            console.log(`- Metadata URL: ${options.metadataUrl}`);
            console.log(`- Description: ${options.description}`);

            // Optional: Load current game state to verify ownership
            try {
                const gameState = await Game.loadState(connection, gameAddress);
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
            } catch (e) {
                console.warn(
                    "Warning: Could not verify ownership. Proceeding anyway...",
                );
            }

            // Create the transaction using the Game library
            const transaction = await Game.edit(
                gameAddress,
                ownerWallet.publicKey,
                newOwner,
                newWithdrawAuthority,
                options.gameUrl,
                options.coverUrl,
                options.metadataUrl,
            );

            // Add recent blockhash
            const { lastValidBlockHeight, blockhash } =
                await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = ownerWallet.publicKey;

            // Sign the transaction
            transaction.sign(ownerWallet);

            console.log("\nSending transaction...");
            const txid = await connection.sendRawTransaction(
                transaction.serialize(),
            );
            console.log(`Transaction sent with signature: ${txid}`);

            console.log("Confirming transaction...");
            await confirmTransaction(connection, txid, lastValidBlockHeight);
            console.log("Transaction confirmed! Game has been updated.");

            // Optional: Display the updated game information
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

program
    .command("game-promote")
    .description("Promote a game to official status (must be world owner)")
    .requiredOption("-g, --game <address>", "Game address to promote")
    .option(
        "-k, --keypair <path>",
        "Path to keypair file for signing (must be world owner)",
    )
    .action(async (options) => {
        try {
            console.log("Promoting game to official status...");

            // Parse the game address
            const gameAddress = new PublicKey(options.game);
            console.log(`Game address: ${gameAddress.toString()}`);

            // Get keypair for the transaction (must be world owner)
            const worldOwnerWallet = getOrCreateKeypair(options.keypair);
            console.log(
                `World owner (signer): ${worldOwnerWallet.publicKey.toString()}`,
            );

            // Optional: Verify that the signer is the world owner
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
            } catch (e) {
                console.warn(
                    "Warning: Could not verify world ownership. Proceeding anyway...",
                );
            }

            // Optional: Load game details to show what's being promoted
            try {
                const gameState = await Game.loadState(connection, gameAddress);
                const chainMetadata = await Game.loadChainMetadata(
                    connection,
                    gameAddress,
                );
                console.log("\nGame to be promoted:");
                console.log(`- Name: ${chainMetadata.name}`);
                console.log(`- Symbol: ${chainMetadata.symbol}`);
                console.log(`- Owner: ${gameState.owner.toString()}`);
            } catch (e) {
                console.log("Could not load game details, but proceeding...");
            }

            // Create the promotion transaction
            const transaction = await Game.promote(
                gameAddress,
                worldOwnerWallet.publicKey,
            );

            // Add recent blockhash
            const { lastValidBlockHeight, blockhash } =
                await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = worldOwnerWallet.publicKey;

            // Sign the transaction
            transaction.sign(worldOwnerWallet);

            console.log("\nSending transaction...");
            const txid = await connection.sendRawTransaction(
                transaction.serialize(),
            );
            console.log(`Transaction sent with signature: ${txid}`);

            console.log("Confirming transaction...");
            await confirmTransaction(connection, txid, lastValidBlockHeight);
            console.log(
                "Transaction confirmed! Game has been promoted to official status 🎉",
            );
        } catch (error) {
            console.error("Error promoting game:", error);
            process.exit(1);
        }
    });

program.parse(process.argv);
