import {
    Connection,
    Ed25519Program,
    Keypair,
    PublicKey,
    TransactionInstruction,
} from "@solana/web3.js";
import {
    decodeVault,
    getAssociatedTokenAddressSync,
    IVY_MINT,
    ivy_program,
    IVY_PROGRAM_ID,
    WORLD_ADDRESS,
} from "./interface";

const VAULT_PREFIX = Buffer.from("vault");
const VAULT_WALLET_PREFIX = Buffer.from("vault_wallet");

export interface VaultState {
    owner: PublicKey;
    withdraw_authority: PublicKey;
    wallet: PublicKey;
}

/// A vault for storing IVY tokens.
export class Vault {
    /**
     * Loads vault details
     */
    static async loadState(
        connection: Connection,
        vault: PublicKey,
    ): Promise<VaultState> {
        const info = await connection.getAccountInfo(vault);
        if (!info) {
            throw new Error("can't find vault");
        }
        if (!info.owner.equals(IVY_PROGRAM_ID)) {
            throw new Error("vault has incorrect owner");
        }

        const g = decodeVault(info.data);
        return {
            owner: g.owner,
            withdraw_authority: g.withdrawAuthority,
            wallet: g.wallet,
        };
    }

    static deriveVault(seed: Uint8Array): PublicKey {
        return PublicKey.createProgramAddressSync(
            [VAULT_PREFIX, seed],
            IVY_PROGRAM_ID,
        );
    }

    static deriveWallet(vault: PublicKey): PublicKey {
        return PublicKey.createProgramAddressSync(
            [VAULT_WALLET_PREFIX, vault.toBuffer()],
            IVY_PROGRAM_ID,
        );
    }

    /** Generate a random, valid Vault seed */
    static generateSeed(): Uint8Array {
        let seed: Uint8Array;
        while (true) {
            seed = Keypair.generate().secretKey.slice(0, 32);
            try {
                this.deriveWallet(this.deriveVault(seed));
                return seed;
            } catch (_) {
                // Continue trying if address derivation fails
            }
        }
    }

    public static create(
        seed: Uint8Array,
        user: PublicKey,
    ): Promise<TransactionInstruction> {
        if (seed.length !== 32) {
            throw new Error("invalid seed length");
        }
        const vault = this.deriveVault(seed);
        const wallet = this.deriveWallet(vault);
        return ivy_program.methods
            .vaultCreate(Array.from(seed))
            .accounts({
                user,
                vault,
                wallet,
                ivyMint: IVY_MINT,
                world: WORLD_ADDRESS,
            })
            .instruction();
    }
    public static edit(
        vault: PublicKey,
        user: PublicKey,
        newOwner: PublicKey,
        newWithdrawAuthority: PublicKey,
    ): Promise<TransactionInstruction> {
        return ivy_program.methods
            .vaultEdit(newOwner, newWithdrawAuthority)
            .accounts({
                owner: user,
                vault,
            })
            .instruction();
    }
    public static deposit(
        vault: PublicKey,
        user: PublicKey,
        idHex: string,
    ): Promise<TransactionInstruction> {
        const id = Buffer.from(idHex, "hex");
        if (id.length !== 32) {
            throw new Error(
                `invalid deposit ID length (expected 32, got ${id.length})`,
            );
        }
        const deposit = PublicKey.findProgramAddressSync(
            [Buffer.from("vault_deposit"), vault.toBuffer(), id],
            IVY_PROGRAM_ID,
        )[0];
        return ivy_program.methods
            .vaultDeposit(Array.from(id))
            .accounts({
                user,
                vault,
                source: getAssociatedTokenAddressSync(IVY_MINT, user),
                wallet: this.deriveWallet(vault),
                deposit,
                ivyMint: IVY_MINT,
                world: WORLD_ADDRESS,
            })
            .instruction();
    }
    public static async withdraw(
        vault: PublicKey,
        user: PublicKey,
        idHex: string,
        withdrawAuthority: PublicKey,
        signatureHex: string,
    ): Promise<TransactionInstruction[]> {
        const id = Buffer.from(idHex, "hex");
        if (id.length !== 32) {
            throw new Error("invalid ID length");
        }
        const signature = Buffer.from(signatureHex, "hex");
        if (signature.length !== 64) {
            throw new Error("invalid signature length");
        }
        const withdraw = PublicKey.findProgramAddressSync(
            [Buffer.from("vault_withdraw"), vault.toBuffer(), id],
            IVY_PROGRAM_ID,
        )[0];
        const msg = new Uint8Array(96);
        vault.toBuffer().copy(msg, 0);
        user.toBuffer().copy(msg, 32);
        Buffer.from(id).copy(msg, 64);
        const tx = await ivy_program.methods
            .vaultWithdraw(Array.from(id), Array.from(signature))
            .accounts({
                user,
                vault,
                destination: getAssociatedTokenAddressSync(IVY_MINT, user),
                wallet: this.deriveWallet(vault),
                withdraw,
                ivyMint: IVY_MINT,
                world: WORLD_ADDRESS,
            })
            .preInstructions([
                Ed25519Program.createInstructionWithPublicKey({
                    publicKey:
                        withdrawAuthority.toBuffer() as unknown as Uint8Array,
                    message: msg,
                    signature: signature as unknown as Uint8Array,
                }),
            ])
            .transaction();
        return tx.instructions;
    }
}
