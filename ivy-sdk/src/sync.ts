import { PublicKey, TransactionInstruction, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
    ivy_program,
    deriveMetadataPda,
    PUMP_GLOBAL,
    PUMP_EVENT_AUTHORITY,
    PUMP_PROGRAM_ID,
    PSWAP_PROGRAM_ID,
    WSOL_MINT,
    IVY_PROGRAM_ID,
    WORLD_ADDRESS,
    getAssociatedTokenAddressSync,
    PSWAP_GLOBAL_CONFIG,
} from "./interface";
import { SyncGlobal } from "./sync-global";
import { SyncCurve } from "./sync-curve";
import { SyncPool } from "./sync-pool";

const SYNC_BENEFICIARY = new PublicKey(
    "EGTNw9v8SKJexnjGsiD6bRoGEAm2iMYAXjHrYU9SX1iP",
);

export class Sync {
    /// Derive the sync address from the given seed
    static deriveAddress(seed: Uint8Array): PublicKey {
        return PublicKey.createProgramAddressSync(
            [Buffer.from("sync"), seed],
            IVY_PROGRAM_ID,
        );
    }

    /// Derive the token mint from the sync address
    static deriveMint(sync: PublicKey): PublicKey {
        return PublicKey.createProgramAddressSync(
            [Buffer.from("sync_mint"), sync.toBuffer()],
            IVY_PROGRAM_ID,
        );
    }

    /**
     * Derive all sync addresses using createProgramAddress
     */
    private static deriveAuxiliary(sync: PublicKey) {
        const syncMint = this.deriveMint(sync);
        const syncWallet = PublicKey.createProgramAddressSync(
            [Buffer.from("sync_sync_wallet"), sync.toBuffer()],
            IVY_PROGRAM_ID,
        );
        const pumpWallet = PublicKey.createProgramAddressSync(
            [Buffer.from("sync_pump_wallet"), sync.toBuffer()],
            IVY_PROGRAM_ID,
        );

        return {
            syncMint,
            syncWallet,
            pumpWallet,
        };
    }

    /**
     * Generate a valid seed that works with createProgramAddress
     */
    static generateSeed(): Uint8Array {
        let seed: Uint8Array;
        while (true) {
            seed = Keypair.generate().secretKey.slice(0, 32);
            try {
                // Test if all required addresses can be derived with this seed
                this.deriveAuxiliary(this.deriveAddress(seed));
                return seed;
            } catch (_) {
                // Continue trying if address derivation fails
            }
        }
    }

    /**
     * Create a new sync token
     * @param user - The user creating the sync token
     * @param seed - Seed used to derive the sync account
     * @param pumpMint - The Pump.fun mint to sync with
     * @param name - Token name
     * @param symbol - Token symbol
     * @param metadataUrl - URL to token metadata JSON
     * @param gameUrl - URL to token game
     */
    static async create(
        user: PublicKey,
        seed: Uint8Array,
        pumpMint: PublicKey,
        name: string,
        symbol: string,
        metadataUrl: string,
        gameUrl: string,
    ): Promise<TransactionInstruction> {
        const sync = this.deriveAddress(seed);
        const { syncMint, syncWallet, pumpWallet } = this.deriveAuxiliary(sync);
        const metadata = await deriveMetadataPda(syncMint);

        return await ivy_program.methods
            .syncCreate(Array.from(seed), name, symbol, metadataUrl, gameUrl)
            .accounts({
                sync,
                user,
                pumpMint, // assuming this is correct; adjust if not
                metadata,
                syncMint,
                syncWallet,
                pumpWallet,
                world: WORLD_ADDRESS,
            })
            .instruction();
    }

    /**
     * Swap through Pump.fun bonding curve
     */
    static async swap(
        sync: PublicKey,
        global: SyncGlobal,
        curve: SyncCurve,
        user: PublicKey,
        isBuy: boolean,
        amount: bigint,
        minOutput: bigint,
    ): Promise<TransactionInstruction> {
        const { syncMint, syncWallet, pumpWallet } = this.deriveAuxiliary(sync);
        const associatedUser = getAssociatedTokenAddressSync(curve.mint, user);
        const userSyncAta = getAssociatedTokenAddressSync(syncMint, user);

        const [userVolumeAccumulator] = PublicKey.findProgramAddressSync(
            [Buffer.from("user_volume_accumulator"), user.toBuffer()],
            PUMP_PROGRAM_ID,
        );

        return await ivy_program.methods
            .syncSwap(
                new BN(amount.toString()),
                new BN(minOutput.toString()),
                isBuy,
            )
            .accounts({
                sync,
                global: PUMP_GLOBAL,
                feeRecipient: global.pumpFeeRecipient,
                mint: curve.mint,
                bondingCurve: curve.bondingCurve,
                associatedBondingCurve: curve.associatedBondingCurve,
                associatedUser,
                creatorVault: curve.creatorVault,
                pumpEventAuthority: PUMP_EVENT_AUTHORITY,
                pumpProgram: PUMP_PROGRAM_ID,
                globalVolumeAccumulator: global.pumpGlobalVolumeAccumulator,
                userVolumeAccumulator,
                user,
                syncMint,
                syncTreasuryWallet: syncWallet,
                pumpTreasuryWallet: pumpWallet,
                userSyncAta,
                world: WORLD_ADDRESS,
            })
            .instruction();
    }

    /**
     * Swap through PumpSwap AMM pool
     */
    static async pswap(
        sync: PublicKey,
        global: SyncGlobal,
        pool: SyncPool,
        user: PublicKey,
        isBuy: boolean,
        amount: bigint,
        minOutput: bigint,
    ): Promise<TransactionInstruction> {
        const { syncMint, syncWallet, pumpWallet } = this.deriveAuxiliary(sync);
        const userPumpAccount = getAssociatedTokenAddressSync(
            pool.tokenMint,
            user,
        );
        const userWsolAccount = getAssociatedTokenAddressSync(WSOL_MINT, user);
        const userSyncAccount = getAssociatedTokenAddressSync(syncMint, user);

        const protocolFeeRecipient = global.getRandomProtocolFeeRecipient();
        const protocolFeeRecipientTokenAccount = getAssociatedTokenAddressSync(
            pool.quoteMint,
            protocolFeeRecipient,
        );

        const [userVolumeAccumulator] = PublicKey.findProgramAddressSync(
            [Buffer.from("user_volume_accumulator"), user.toBuffer()],
            PSWAP_PROGRAM_ID,
        );

        return await ivy_program.methods
            .syncPswap(
                new BN(amount.toString()),
                new BN(minOutput.toString()),
                isBuy,
            )
            .accounts({
                sync,
                user,
                pswapPool: pool.poolAddress,
                pswapGlobalConfig: PSWAP_GLOBAL_CONFIG,
                tokenMint: pool.tokenMint,
                userPumpAccount,
                userWsolAccount,
                poolTokenAccount: pool.poolTokenAccount,
                poolWsolAccount: pool.poolWsolAccount,
                protocolFeeRecipient,
                protocolFeeRecipientTokenAccount,
                pswapEventAuthority: global.pswapEventAuthority,
                pswapProgram: PSWAP_PROGRAM_ID,
                coinCreatorVaultAta: pool.coinCreatorVaultAta,
                coinCreatorVaultAuthority: pool.coinCreatorVaultAuthority,
                globalVolumeAccumulator: global.pswapGlobalVolumeAccumulator,
                userVolumeAccumulator,
                syncMint,
                syncTreasuryWallet: syncWallet,
                pumpTreasuryWallet: pumpWallet,
                userSyncAccount,
                world: WORLD_ADDRESS,
                beneficiary: SYNC_BENEFICIARY,
            })
            .instruction();
    }
}
