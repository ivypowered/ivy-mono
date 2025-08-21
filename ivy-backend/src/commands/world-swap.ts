import { Command } from "commander";
import { Connection, SendTransactionError } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { World, USDC_MINT, IVY_MINT } from "ivy-sdk";
import { confirmTransaction } from "../functions/confirmTransaction";
import { getOrCreateKeypair } from "../utils/keypair";

export function registerWorldSwapCommand(
    program: Command,
    connection: Connection,
) {
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
                const signerWallet = getOrCreateKeypair(options.keypair);

                console.log(
                    `Executing ${options.buy ? "buy" : "sell"} swap for ${options.amount} tokens...`,
                );
                console.log(`Minimum tokens to receive: ${options.threshold}`);

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

                const transaction = await World.swap(
                    options.amount,
                    options.threshold,
                    options.buy,
                    signerWallet.publicKey,
                );

                const { lastValidBlockHeight, blockhash } =
                    await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = signerWallet.publicKey;
                transaction.sign(signerWallet);

                console.log(`Source account: ${sourceAccount.toString()}`);
                console.log(
                    `Destination account: ${destinationAccount.toString()}`,
                );

                let starting_balance = 0;
                try {
                    starting_balance =
                        (
                            await connection.getTokenAccountBalance(
                                destinationAccount,
                            )
                        ).value.uiAmount || 0;
                } catch {
                    // no existing account
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
            } catch (error) {
                console.error("Error executing swap:", error);
                process.exit(1);
            }
        });
}
