// ivy-sdk/src/sync-pool.ts
import { PublicKey } from "@solana/web3.js";
import {
    PSWAP_PROGRAM_ID,
    WSOL_MINT,
    getAssociatedTokenAddressSync,
} from "./interface";

export class SyncPool {
    public readonly poolAddress: PublicKey;
    public readonly tokenMint: PublicKey;
    public readonly poolTokenAccount: PublicKey;
    public readonly poolWsolAccount: PublicKey;
    public readonly coinCreator: PublicKey;
    public readonly coinCreatorVaultAta: PublicKey;
    public readonly coinCreatorVaultAuthority: PublicKey;
    public readonly quoteMint: PublicKey;

    private constructor(
        poolAddress: PublicKey,
        tokenMint: PublicKey,
        poolTokenAccount: PublicKey,
        poolWsolAccount: PublicKey,
        coinCreator: PublicKey,
        coinCreatorVaultAta: PublicKey,
        coinCreatorVaultAuthority: PublicKey,
        quoteMint: PublicKey,
    ) {
        this.poolAddress = poolAddress;
        this.tokenMint = tokenMint;
        this.poolTokenAccount = poolTokenAccount;
        this.poolWsolAccount = poolWsolAccount;
        this.coinCreator = coinCreator;
        this.coinCreatorVaultAta = coinCreatorVaultAta;
        this.coinCreatorVaultAuthority = coinCreatorVaultAuthority;
        this.quoteMint = quoteMint;
    }

    static create(poolAddress: PublicKey, poolAddressData: Buffer): SyncPool {
        // Parse pool data
        let offset = 8 + 1 + 2 + 32; // discriminator + bump + index + creator
        const baseMint = new PublicKey(
            poolAddressData.subarray(offset, offset + 32),
        );
        offset += 32;
        const quoteMint = new PublicKey(
            poolAddressData.subarray(offset, offset + 32),
        );
        offset += 32;

        // Determine token mint (non-WSOL mint)
        const tokenMint = baseMint.equals(WSOL_MINT) ? quoteMint : baseMint;

        // Skip to coin creator (after lpMint, poolBase, poolQuote, lpSupply)
        offset += 32 + 32 + 32 + 8;
        const coinCreator = new PublicKey(
            poolAddressData.subarray(offset, offset + 32),
        );

        const poolTokenAccount = getAssociatedTokenAddressSync(
            tokenMint,
            poolAddress,
        );

        const poolWsolAccount = getAssociatedTokenAddressSync(
            WSOL_MINT,
            poolAddress,
        );

        const [coinCreatorVaultAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("creator_vault"), coinCreator.toBuffer()],
            PSWAP_PROGRAM_ID,
        );

        const coinCreatorVaultAta = getAssociatedTokenAddressSync(
            baseMint.equals(tokenMint) ? WSOL_MINT : tokenMint,
            coinCreatorVaultAuthority,
        );

        return new SyncPool(
            poolAddress,
            tokenMint,
            poolTokenAccount,
            poolWsolAccount,
            coinCreator,
            coinCreatorVaultAta,
            coinCreatorVaultAuthority,
            quoteMint,
        );
    }
}
