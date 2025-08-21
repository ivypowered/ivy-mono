import { Command } from "commander";
import { Connection } from "@solana/web3.js";
import { World } from "ivy-sdk";

export function registerLoadWorldCommand(
    program: Command,
    connection: Connection,
) {
    program
        .command("load-world")
        .description("Load details for the Ivy world")
        .action(async () => {
            try {
                console.log("Loading world details...");
                const worldState = await World.loadState(connection);

                console.log("\nWorld Details:");
                console.log(`Owner: ${worldState.owner.toString()}`);
                console.log(`IVY Mint: ${worldState.ivy_mint.toString()}`);
                console.log(
                    `USDC Wallet: ${worldState.usdc_wallet.toString()}`,
                );
                console.log(
                    `Curve Wallet: ${worldState.curve_wallet.toString()}`,
                );
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
}
