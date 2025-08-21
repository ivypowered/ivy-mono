import { Command } from "commander";
import { Connection } from "@solana/web3.js";
import { World } from "ivy-sdk";
import { confirmTransaction } from "../functions/confirmTransaction";
import { getOrCreateKeypair } from "../utils/keypair";

export function registerSetParamsCommand(
    program: Command,
    connection: Connection,
) {
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
                if (options.ivyFee < 0 || options.ivyFee > 255) {
                    console.error(
                        "Ivy fee basis points must be between 0 and 255",
                    );
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
                console.log(
                    `- Game initial liquidity: ${options.gameLiquidity}`,
                );
                console.log(`- Ivy fee basis points: ${options.ivyFee}`);
                console.log(`- Game fee basis points: ${options.gameFee}`);

                const signerWallet = getOrCreateKeypair(options.keypair);

                const transaction = await World.setParams(
                    {
                        ivy_initial_liquidity: options.ivyLiquidity,
                        game_initial_liquidity: options.gameLiquidity,
                        ivy_fee_bps: options.ivyFee,
                        game_fee_bps: options.gameFee,
                    },
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
                console.log(
                    "Transaction confirmed! World parameters have been updated.",
                );
            } catch (error) {
                console.error("Error setting World parameters:", error);
                process.exit(1);
            }
        });
}
