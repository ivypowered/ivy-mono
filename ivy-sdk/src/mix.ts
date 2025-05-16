import { PublicKey, Transaction, AccountMeta } from "@solana/web3.js";
import {
    WORLD_ADDRESS,
    WORLD_USDC_WALLET,
    WORLD_CURVE_WALLET,
    USDC_MINT,
    IVY_MINT,
    ivy_program,
    mkpad,
    getAssociatedTokenAddressSync,
} from "./interface";
import { BN } from "@coral-xyz/anchor";
import { Game } from "./game";

/**
 * Mix functions provide direct conversions between different token types
 * in the Ivy ecosystem in a single transaction.
 */
export class Mix {
    /**
     * Converts USDC to game tokens in one transaction
     */
    static async usdcToGame(
        game: PublicKey,
        usdcAmount: string,
        gameThreshold: string,
        user: PublicKey,
    ): Promise<Transaction> {
        // Get the derived addresses for the game
        const { mint, ivy_wallet, curve_wallet, treasury_wallet } =
            Game.deriveAddresses(game);

        // Get associated token accounts for the user
        const usdcAccount = getAssociatedTokenAddressSync(USDC_MINT, user);
        const ivyAccount = getAssociatedTokenAddressSync(IVY_MINT, user);
        const gameAccount = getAssociatedTokenAddressSync(mint, user);

        // Create the mix transaction
        const tx = await ivy_program.methods
            .mixUsdcToGame(
                new BN(usdcAmount),
                new BN(gameThreshold),
                true,
                true,
                mkpad(6),
            )
            .accounts({
                game: game,
                user: user,
                usdcAccount: usdcAccount,
                ivyAccount: ivyAccount,
                gameAccount: gameAccount,
                gameIvyWallet: ivy_wallet,
                gameCurveWallet: curve_wallet,
                gameTreasuryWallet: treasury_wallet,
                ivyMint: IVY_MINT,
                world: WORLD_ADDRESS,
                worldUsdcWallet: WORLD_USDC_WALLET,
                worldCurveWallet: WORLD_CURVE_WALLET,
                gameMint: mint,
            })
            .transaction();

        return tx;
    }

    /**
     * Converts game tokens to USDC in one transaction
     */
    static async gameToUsdc(
        game: PublicKey,
        gameAmount: string,
        usdcThreshold: string,
        user: PublicKey,
    ): Promise<Transaction> {
        // Get the derived addresses for the game
        const { mint, ivy_wallet, curve_wallet, treasury_wallet } =
            Game.deriveAddresses(game);

        // Get associated token accounts for the user
        const gameAccount = getAssociatedTokenAddressSync(mint, user);
        const ivyAccount = getAssociatedTokenAddressSync(IVY_MINT, user);
        const usdcAccount = getAssociatedTokenAddressSync(USDC_MINT, user);

        // Create the mix transaction
        const tx = await ivy_program.methods
            .mixGameToUsdc(
                new BN(gameAmount),
                new BN(usdcThreshold),
                true,
                true,
                mkpad(6),
            )
            .accounts({
                game: game,
                user: user,
                gameAccount: gameAccount,
                ivyAccount: ivyAccount,
                usdcAccount: usdcAccount,
                gameIvyWallet: ivy_wallet,
                gameCurveWallet: curve_wallet,
                gameTreasuryWallet: treasury_wallet,
                gameMint: mint,
                ivyMint: IVY_MINT,
                world: WORLD_ADDRESS,
                worldUsdcWallet: WORLD_USDC_WALLET,
                worldCurveWallet: WORLD_CURVE_WALLET,
            })
            .transaction();

        return tx;
    }

    /**
     * Converts any tokens to USDC in one transaction
     * Requires Jupiter accounts + data
     */
    static async anyToGame(
        game: PublicKey,
        gameThreshold: string,
        user: PublicKey,
        jupiterKeys: AccountMeta[],
        jupiterData: Buffer,
    ): Promise<Transaction> {
        // Get the derived addresses for the game
        const { mint, ivy_wallet, curve_wallet, treasury_wallet } =
            Game.deriveAddresses(game);

        // Get associated token accounts for the user
        const usdcAccount = getAssociatedTokenAddressSync(USDC_MINT, user);
        const ivyAccount = getAssociatedTokenAddressSync(IVY_MINT, user);
        const gameAccount = getAssociatedTokenAddressSync(mint, user);

        // Create the mix transaction
        const ins = await ivy_program.methods
            .mixAnyToGame(true, true, mkpad(6), new BN(gameThreshold))
            .accounts({
                game: game,
                user: user,
                usdcAccount: usdcAccount,
                ivyAccount: ivyAccount,
                gameAccount: gameAccount,
                gameIvyWallet: ivy_wallet,
                gameCurveWallet: curve_wallet,
                gameTreasuryWallet: treasury_wallet,
                gameMint: mint,
                ivyMint: IVY_MINT,
                world: WORLD_ADDRESS,
                worldUsdcWallet: WORLD_USDC_WALLET,
                worldCurveWallet: WORLD_CURVE_WALLET,
            })
            .instruction();
        ins.keys.push(...jupiterKeys);
        ins.data = Buffer.concat([
            ins.data as unknown as Uint8Array,
            jupiterData as unknown as Uint8Array,
        ]);
        const tx = new Transaction();
        tx.add(ins);
        return tx;
    }

    /**
     * Converts game tokens to any token
     * This allows users to specify how many game tokens to convert and get a mix of USDC and IVY
     */
    static async gameToAny(
        game: PublicKey,
        gameAmount: string,
        user: PublicKey,
        jupiterKeys: AccountMeta[],
        jupiterData: Buffer,
    ): Promise<Transaction> {
        // Get the derived addresses for the game
        const { mint, ivy_wallet, curve_wallet, treasury_wallet } =
            Game.deriveAddresses(game);

        // Get associated token accounts for the user
        const gameAccount = getAssociatedTokenAddressSync(mint, user);
        const ivyAccount = getAssociatedTokenAddressSync(IVY_MINT, user);
        const usdcAccount = getAssociatedTokenAddressSync(USDC_MINT, user);

        // Create the mix transaction
        const ins = await ivy_program.methods
            .mixGameToAny(true, true, mkpad(6), new BN(gameAmount))
            .accounts({
                game: game,
                user: user,
                gameAccount: gameAccount,
                ivyAccount: ivyAccount,
                usdcAccount: usdcAccount,
                gameIvyWallet: ivy_wallet,
                gameCurveWallet: curve_wallet,
                gameTreasuryWallet: treasury_wallet,
                gameMint: mint,
                ivyMint: IVY_MINT,
                world: WORLD_ADDRESS,
                worldUsdcWallet: WORLD_USDC_WALLET,
                worldCurveWallet: WORLD_CURVE_WALLET,
            })
            .instruction();
        ins.keys.push(...jupiterKeys);
        ins.data = Buffer.concat([
            ins.data as unknown as Uint8Array,
            jupiterData as unknown as Uint8Array,
        ]);
        const tx = new Transaction();
        tx.add(ins);
        return tx;
    }
    /**
     * Converts any tokens to IVY tokens
     * Requires Jupiter accounts + data
     */
    static async anyToIvy(
        ivyThreshold: string,
        user: PublicKey,
        jupiterKeys: AccountMeta[],
        jupiterData: Buffer,
    ): Promise<Transaction> {
        // Get associated token accounts for the user
        const usdcAccount = getAssociatedTokenAddressSync(USDC_MINT, user);
        const ivyAccount = getAssociatedTokenAddressSync(IVY_MINT, user);

        // Create the mix transaction
        const ins = await ivy_program.methods
            .mixAnyToIvy(true, mkpad(7), new BN(ivyThreshold))
            .accounts({
                world: WORLD_ADDRESS,
                user: user,
                usdcAccount: usdcAccount,
                ivyAccount: ivyAccount,
                ivyMint: IVY_MINT,
                worldUsdcWallet: WORLD_USDC_WALLET,
                worldCurveWallet: WORLD_CURVE_WALLET,
            })
            .instruction();
        ins.keys.push(...jupiterKeys);
        ins.data = Buffer.concat([
            ins.data as unknown as Uint8Array,
            jupiterData as unknown as Uint8Array,
        ]);
        const tx = new Transaction();
        tx.add(ins);

        return tx;
    }

    /**
     * Converts IVY tokens to any token
     * Requires Jupiter accounts + data
     */
    static async ivyToAny(
        ivyAmount: string,
        user: PublicKey,
        jupiterKeys: AccountMeta[],
        jupiterData: Buffer,
    ): Promise<Transaction> {
        // Get associated token accounts for the user
        const ivyAccount = getAssociatedTokenAddressSync(IVY_MINT, user);
        const usdcAccount = getAssociatedTokenAddressSync(USDC_MINT, user);

        // Create the mix transaction
        const ins = await ivy_program.methods
            .mixIvyToAny(true, mkpad(7), new BN(ivyAmount))
            .accounts({
                world: WORLD_ADDRESS,
                user: user,
                ivyAccount: ivyAccount,
                usdcAccount: usdcAccount,
                worldUsdcWallet: WORLD_USDC_WALLET,
                worldCurveWallet: WORLD_CURVE_WALLET,
            })
            .instruction();
        ins.keys.push(...jupiterKeys);
        ins.data = Buffer.concat([
            ins.data as unknown as Uint8Array,
            jupiterData as unknown as Uint8Array,
        ]);
        const tx = new Transaction();
        tx.add(ins);

        return tx;
    }
}
