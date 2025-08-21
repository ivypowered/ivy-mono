import { Command } from "commander";
import { Connection, Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { World } from "ivy-sdk";
import { confirmTransaction } from "../functions/confirmTransaction";
import { requestAirdrop } from "../functions/requestAirdrop";
import { createAndUploadMetadata, uploadImageToIPFS } from "../util";
import { getOrCreateKeypair } from "../utils/keypair";

export function registerNewWorldCommand(
    program: Command,
    connection: Connection,
) {
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
                const iconPath = path.resolve(options.icon);
                if (!fs.existsSync(iconPath)) {
                    console.error(`Icon file not found: ${iconPath}`);
                    process.exit(1);
                }

                const iconBase64 = fs.readFileSync(iconPath, {
                    encoding: "base64",
                });
                const ext = path.extname(iconPath).toLowerCase();
                const iconType =
                    ext === ".png"
                        ? "image/png"
                        : ext === ".jpg" || ext === ".jpeg"
                          ? "image/jpeg"
                          : ext === ".gif"
                            ? "image/gif"
                            : ext === ".webp"
                              ? "image/webp"
                              : null;

                if (!iconType) {
                    console.error(
                        "Invalid image type. Supported types: JPEG, PNG, GIF, WebP",
                    );
                    process.exit(1);
                }

                const userWallet: Keypair = getOrCreateKeypair(options.keypair);

                if (options.airdrop) {
                    console.log("Requesting airdrop to wallet...");
                    const signature = await requestAirdrop(
                        connection,
                        userWallet.publicKey,
                    );
                    console.log("Airdrop successful:", signature);
                }

                console.log("Uploading icon to IPFS...");
                const iconUrl = await uploadImageToIPFS(iconBase64, iconType);

                console.log("Creating and uploading metadata...");
                const metadataUrl = await createAndUploadMetadata(
                    options.name,
                    options.symbol,
                    iconUrl,
                    options.description,
                );

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
                await confirmTransaction(
                    connection,
                    txid,
                    lastValidBlockHeight,
                );
                console.log("Transaction confirmed!");

                console.log("World details:");
                console.log(`- Name: ${options.name}`);
                console.log(`- Symbol: ${options.symbol}`);

                console.log("\nFetching new world state...");
                try {
                    const worldState = await World.loadState(connection);
                    console.log(`- Owner: ${worldState.owner.toString()}`);
                    console.log(
                        `- IVY Mint: ${worldState.ivy_mint.toString()}`,
                    );
                    console.log(`- Curve Supply: ${worldState.ivy_curve_max}`);
                    console.log(
                        `- Vesting Supply: ${worldState.ivy_vesting_max}`,
                    );
                } catch {
                    console.log(
                        "Could not load world state, but world was created successfully.",
                    );
                }
            } catch (error) {
                console.error("Error creating world:", error);
                process.exit(1);
            }
        });
}
