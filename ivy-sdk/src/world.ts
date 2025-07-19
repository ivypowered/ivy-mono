import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import {
    IVY_PROGRAM_ID,
    WORLD_ADDRESS,
    WORLD_USDC_WALLET,
    WORLD_CURVE_WALLET,
    USDC_MINT,
    IVY_MINT,
    ivy_program,
    decodeWorld,
    WORLD_PREFIXES,
    METADATA_PROGRAM_ID,
    deriveAddressLookupTableAddress,
    str2zt,
    mkpad,
} from "./interface";
import { BN } from "@coral-xyz/anchor";
import { MAX_TEXT_LEN, getAssociatedTokenAddressSync } from "./interface";

export interface WorldState {
    owner: PublicKey;
    ivy_mint: PublicKey;
    usdc_wallet: PublicKey;
    curve_wallet: PublicKey;
    vesting_wallet: PublicKey;
    world_alt: PublicKey;
    usdc_balance: string;
    ivy_curve_sold: string;
    ivy_curve_max: string;
    ivy_vesting_released: string;
    ivy_vesting_max: string;
    ivy_initial_liquidity: string;
    game_initial_liquidity: string;
    curve_input_scale_num: number;
    curve_input_scale_den: number;
    ivy_fee_bps: number;
    game_fee_bps: number;
}

export interface WorldParams {
    ivy_initial_liquidity: string;
    game_initial_liquidity: string;
    ivy_fee_bps: number;
    game_fee_bps: number;
}

export class World {
    /**
     * Loads world details
     */
    static async loadState(connection: Connection): Promise<WorldState> {
        const world_info = await connection.getAccountInfo(WORLD_ADDRESS);

        if (!world_info) {
            throw new Error("can't find world");
        }

        if (!world_info.owner.equals(IVY_PROGRAM_ID)) {
            throw new Error("world has incorrect owner");
        }

        const w = decodeWorld(world_info.data);
        return {
            owner: w.owner,
            ivy_mint: w.ivyMint,
            usdc_wallet: w.usdcWallet,
            curve_wallet: w.curveWallet,
            vesting_wallet: w.vestingWallet,
            world_alt: w.worldAlt,
            usdc_balance: w.usdcBalance.toString(),
            ivy_curve_sold: w.ivyCurveSold.toString(),
            ivy_curve_max: w.ivyCurveMax.toString(),
            ivy_vesting_released: w.ivyVestingReleased.toString(),
            ivy_vesting_max: w.ivyVestingMax.toString(),
            ivy_initial_liquidity: w.ivyInitialLiquidity.toString(),
            game_initial_liquidity: w.gameInitialLiquidity.toString(),
            curve_input_scale_num: w.curveInputScaleNum,
            curve_input_scale_den: w.curveInputScaleDen,
            ivy_fee_bps: w.ivyFeeBps,
            game_fee_bps: w.gameFeeBps,
        };
    }

    /**
     * Returns a create world transaction
     */
    static async create(
        name: string,
        symbol: string,
        iconUrl: string,
        metadataUrl: string,
        ivyCurveSupply: number,
        ivyVestingSupply: number,
        inputScaleNum: number,
        inputScaleDen: number,
        payer: PublicKey,
        recentSlot: number,
    ): Promise<Transaction> {
        if (iconUrl.length > MAX_TEXT_LEN) {
            throw new Error(`Icon URL too long (max ${MAX_TEXT_LEN} chars)`);
        }
        if (metadataUrl.length > MAX_TEXT_LEN) {
            throw new Error(
                `Metadata URL too long (max ${MAX_TEXT_LEN} chars)`,
            );
        }

        // Find relevant addresses for the world program
        const [usdc_wallet] = PublicKey.findProgramAddressSync(
            [WORLD_PREFIXES.usdc],
            IVY_PROGRAM_ID,
        );

        const [curve_wallet] = PublicKey.findProgramAddressSync(
            [WORLD_PREFIXES.curve],
            IVY_PROGRAM_ID,
        );

        const [vesting_wallet] = PublicKey.findProgramAddressSync(
            [WORLD_PREFIXES.vesting],
            IVY_PROGRAM_ID,
        );

        const metadata_address = PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                METADATA_PROGRAM_ID.toBuffer(),
                IVY_MINT.toBuffer(),
            ],
            METADATA_PROGRAM_ID,
        )[0];

        const [worldAlt, worldAltNonce] = deriveAddressLookupTableAddress(
            WORLD_ADDRESS,
            recentSlot,
        );

        const tx = await ivy_program.methods
            .worldCreate(
                str2zt(name, 64),
                str2zt(symbol, 16),
                str2zt(metadataUrl, 128),
                new BN(ivyCurveSupply),
                new BN(ivyVestingSupply),
                inputScaleNum,
                inputScaleDen,
                new BN(recentSlot),
                worldAltNonce,
                mkpad(7),
            )
            .accounts({
                world: WORLD_ADDRESS,
                user: payer,
                ivyMint: IVY_MINT,
                metadata: metadata_address,
                usdcWallet: usdc_wallet,
                curveWallet: curve_wallet,
                vestingWallet: vesting_wallet,
                worldAlt,
            })
            .transaction();

        return tx;
    }

    /**
     * Sets a new owner for the Ivy world
     */
    static async setOwner(
        new_owner: PublicKey,
        owner: PublicKey,
    ): Promise<Transaction> {
        // Create the transaction
        const tx = await ivy_program.methods
            .worldSetOwner(new_owner)
            .accounts({
                world: WORLD_ADDRESS,
                owner,
            })
            .transaction();

        return tx;
    }

    /**
     * Sets all World parameters including fee basis points and liquidity values
     */
    static async setParams(
        params: WorldParams,
        owner: PublicKey,
    ): Promise<Transaction> {
        // Validate all parameters
        if (params.ivy_fee_bps < 0 || params.ivy_fee_bps > 255) {
            throw new Error("Ivy fee basis points must be between 0 and 255");
        }

        if (params.game_fee_bps < 0 || params.game_fee_bps > 255) {
            throw new Error("Game fee basis points must be between 0 and 255");
        }

        // Create the transaction
        const tx = await ivy_program.methods
            .worldSetParams(
                new BN(params.ivy_initial_liquidity),
                new BN(params.game_initial_liquidity),
                params.ivy_fee_bps,
                params.game_fee_bps,
                mkpad(6),
            )
            .accounts({
                world: WORLD_ADDRESS,
                owner,
            })
            .transaction();

        return tx;
    }

    /**
     * Creates a swap transaction between USDC and IVY tokens using the World smart contract
     */
    static async swap(
        amount: string,
        threshold: string,
        is_buy: boolean,
        user: PublicKey,
    ): Promise<Transaction> {
        // Determine source mint based on is_buy flag
        // If buying IVY, source is USDC; if selling IVY, source is the destination mint
        const source_mint = is_buy ? USDC_MINT : IVY_MINT;
        const source_account = getAssociatedTokenAddressSync(source_mint, user);

        // Get the associated token account for the destination
        const destination_mint = is_buy ? IVY_MINT : USDC_MINT;
        const destination_account = getAssociatedTokenAddressSync(
            destination_mint,
            user,
        );

        // Return the swap instruction
        return await ivy_program.methods
            .worldSwap(
                new BN(amount),
                new BN(threshold),
                is_buy,
                true, // create dst if not exist
                mkpad(6),
            )
            .accounts({
                world: WORLD_ADDRESS,
                user: user,
                source: source_account,
                destination: destination_account,
                usdcWallet: WORLD_USDC_WALLET,
                curveWallet: WORLD_CURVE_WALLET,
                destinationMint: destination_mint,
            })
            .transaction();
    }
}
