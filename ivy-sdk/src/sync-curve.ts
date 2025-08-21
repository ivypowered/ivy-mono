// ivy-sdk/src/sync-curve.ts
import { PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID, getAssociatedTokenAddressSync } from "./interface";

export class SyncCurve {
    public readonly mint: PublicKey;
    public readonly bondingCurve: PublicKey;
    public readonly creator: PublicKey;
    public readonly creatorVault: PublicKey;
    public readonly associatedBondingCurve: PublicKey;

    private constructor(
        mint: PublicKey,
        bondingCurve: PublicKey,
        creator: PublicKey,
        creatorVault: PublicKey,
        associatedBondingCurve: PublicKey,
    ) {
        this.mint = mint;
        this.bondingCurve = bondingCurve;
        this.creator = creator;
        this.creatorVault = creatorVault;
        this.associatedBondingCurve = associatedBondingCurve;
    }

    static deriveBondingCurve(mint: PublicKey): PublicKey {
        const [bondingCurve] = PublicKey.findProgramAddressSync(
            [Buffer.from("bonding-curve"), mint.toBuffer()],
            PUMP_PROGRAM_ID,
        );
        return bondingCurve;
    }

    static create(
        mint: PublicKey,
        bondingCurve: PublicKey,
        bondingCurveData: Buffer,
    ): SyncCurve {
        const creator = new PublicKey(bondingCurveData.subarray(49, 81));

        const [creatorVault] = PublicKey.findProgramAddressSync(
            [Buffer.from("creator-vault"), creator.toBuffer()],
            PUMP_PROGRAM_ID,
        );

        const associatedBondingCurve = getAssociatedTokenAddressSync(
            mint,
            bondingCurve,
        );

        return new SyncCurve(
            mint,
            bondingCurve,
            creator,
            creatorVault,
            associatedBondingCurve,
        );
    }
}
