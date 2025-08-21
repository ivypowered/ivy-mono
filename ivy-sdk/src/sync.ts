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

export class Sync {
    public readonly pumpMint: PublicKey;
    public readonly sync: PublicKey;
    public readonly syncMint: PublicKey;
    public readonly syncWallet: PublicKey;
    public readonly pumpWallet: PublicKey;
    public readonly seed: Buffer;

    constructor(
        pumpMint: PublicKey,
        sync: PublicKey,
        syncMint: PublicKey,
        syncWallet: PublicKey,
        pumpWallet: PublicKey,
        seed: Buffer,
    ) {
        this.pumpMint = pumpMint;
        this.sync = sync;
        this.syncMint = syncMint;
        this.syncWallet = syncWallet;
        this.pumpWallet = pumpWallet;
        this.seed = seed;
    }

    /**
     * Generate a valid seed that works with createProgramAddress
     */
    static generateSeed(): Buffer {
        let seed: Buffer;
        while (true) {
            seed = Buffer.from(Keypair.generate().secretKey.slice(0, 32));
            try {
                // Test if all required addresses can be derived with this seed
                this.deriveSyncAddresses(seed);
                return seed;
            } catch (_) {
                // Continue trying if address derivation fails
            }
        }
    }

    /**
     * Derive all sync addresses using createProgramAddress
     */
    static deriveSyncAddresses(seed: Buffer) {
        // Derive sync address
        const sync = PublicKey.createProgramAddressSync(
            [Buffer.from("sync"), seed],
            IVY_PROGRAM_ID,
        );

        // Derive sync mint
        const syncMint = PublicKey.createProgramAddressSync(
            [Buffer.from("sync_mint"), sync.toBuffer()],
            IVY_PROGRAM_ID,
        );

        // Derive sync wallet
        const syncWallet = PublicKey.createProgramAddressSync(
            [Buffer.from("sync_sync_wallet"), sync.toBuffer()],
            IVY_PROGRAM_ID,
        );

        // Derive pump wallet
        const pumpWallet = PublicKey.createProgramAddressSync(
            [Buffer.from("sync_pump_wallet"), sync.toBuffer()],
            IVY_PROGRAM_ID,
        );

        return {
            seed,
            sync,
            syncMint,
            syncWallet,
            pumpWallet,
        };
    }

    static async fromMint(
        pumpMint: PublicKey,
        seedOverride?: Buffer | Uint8Array,
    ): Promise<Sync> {
        let seed: Buffer;

        if (seedOverride) {
            // Use provided seed
            seed = Buffer.from(seedOverride);
        } else {
            // Generate a valid seed
            seed = this.generateSeed();
        }

        const { sync, syncMint, syncWallet, pumpWallet } =
            this.deriveSyncAddresses(seed);

        return new Sync(pumpMint, sync, syncMint, syncWallet, pumpWallet, seed);
    }

    /**
     * Create a new sync token
     * @param user - The user creating the sync token
     * @param name - Token name
     * @param symbol - Token symbol
     * @param shortDesc - Short description of the token
     * @param metadataUrl - URL to token metadata JSON
     * @param iconUrl - URL to token icon image
     * @param gameUrl - URL to token game
     */
    async create(
        user: PublicKey,
        name: string,
        symbol: string,
        shortDesc: string,
        metadataUrl: string,
        iconUrl: string,
        gameUrl: string,
    ): Promise<TransactionInstruction> {
        const metadata = await deriveMetadataPda(this.syncMint);

        return await ivy_program.methods
            .syncCreate(
                Array.from(this.seed),
                name,
                symbol,
                shortDesc,
                metadataUrl,
                iconUrl,
                gameUrl,
            )
            .accounts({
                sync: this.sync,
                user,
                pumpMint: this.pumpMint,
                metadata,
                syncMint: this.syncMint,
                syncWallet: this.syncWallet,
                pumpWallet: this.pumpWallet,
                world: WORLD_ADDRESS,
            })
            .instruction();
    }

    /**
     * Swap through Pump.fun bonding curve
     */
    async swap(
        global: SyncGlobal,
        curve: SyncCurve,
        user: PublicKey,
        isBuy: boolean,
        amount: bigint,
        minOutput: bigint,
    ): Promise<TransactionInstruction> {
        const associatedUser = getAssociatedTokenAddressSync(curve.mint, user);
        const userSyncAta = getAssociatedTokenAddressSync(this.syncMint, user);

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
                sync: this.sync,
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
                syncMint: this.syncMint,
                syncTreasuryWallet: this.syncWallet,
                pumpTreasuryWallet: this.pumpWallet,
                userSyncAta,
                world: WORLD_ADDRESS,
            })
            .instruction();
    }

    /**
     * Swap through PumpSwap AMM pool
     */
    async pswap(
        global: SyncGlobal,
        pool: SyncPool,
        user: PublicKey,
        isBuy: boolean,
        amount: bigint,
        minOutput: bigint,
    ): Promise<TransactionInstruction> {
        const userPumpAccount = getAssociatedTokenAddressSync(
            pool.tokenMint,
            user,
        );
        const userWsolAccount = getAssociatedTokenAddressSync(WSOL_MINT, user);
        const userSyncAccount = getAssociatedTokenAddressSync(
            this.syncMint,
            user,
        );

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
                sync: this.sync,
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
                syncMint: this.syncMint,
                syncTreasuryWallet: this.syncWallet,
                pumpTreasuryWallet: this.pumpWallet,
                userSyncAccount,
                world: WORLD_ADDRESS,
            })
            .instruction();
    }
}
