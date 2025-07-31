import {
    PublicKey,
    Transaction,
    Keypair,
    Connection,
    TransactionMessage,
    AddressLookupTableAccount,
    VersionedTransaction,
    Ed25519Program,
} from "@solana/web3.js";
import {
    IVY_PROGRAM_ID,
    GAME_PREFIXES,
    IVY_MINT,
    WORLD_ADDRESS,
    ivy_program,
    decodeGame,
    deriveMetadataAddress,
    loadChainMetadata,
    ChainMetadata,
    deriveAddressLookupTableAddress,
    zt2str,
    str2zt,
    mkpad,
    NULL_RECENT_BLOCKHASH,
    getAssociatedTokenAddressSync,
} from "./interface";
import { MAX_TEXT_LEN } from "./interface";
import { BN } from "@coral-xyz/anchor";
import nacl from "tweetnacl";

export interface GameMetadata {
    name: string;
    symbol: string;
    short_desc: string;
    icon_url: string;
}

export interface GameState {
    seed: Uint8Array;
    owner: PublicKey;
    withdraw_authority: PublicKey;
    game_url: string;
    cover_url: string;
    mint: PublicKey;
    ivy_wallet: PublicKey;
    curve_wallet: PublicKey;
    treasury_wallet: PublicKey;
    ivy_balance: string;
    game_balance: string;
}

export interface GameAddresses {
    mint: PublicKey;
    ivy_wallet: PublicKey;
    curve_wallet: PublicKey;
    treasury_wallet: PublicKey;
}

export class Game {
    /**
     * Loads game on-chain metadata
     */
    static async loadChainMetadata(
        connection: Connection,
        game: PublicKey,
    ): Promise<ChainMetadata> {
        const mint = PublicKey.findProgramAddressSync(
            [GAME_PREFIXES.mint, game.toBuffer()],
            IVY_PROGRAM_ID,
        )[0];
        const metadata = deriveMetadataAddress(mint);
        return loadChainMetadata(connection, metadata);
    }

    /**
     * Loads game details
     */
    static async loadState(
        connection: Connection,
        game_address: PublicKey,
    ): Promise<GameState> {
        const game_info = await connection.getAccountInfo(game_address);

        if (!game_info) {
            throw new Error("can't find game");
        }

        if (!game_info.owner.equals(IVY_PROGRAM_ID)) {
            throw new Error("game has incorrect owner");
        }

        const g = decodeGame(game_info.data);
        return {
            seed: Uint8Array.from(g.seed),
            owner: g.owner,
            withdraw_authority: g.withdrawAuthority,
            game_url: zt2str(g.gameUrl),
            cover_url: zt2str(g.coverUrl),
            mint: g.mint,
            ivy_wallet: g.ivyWallet,
            curve_wallet: g.curveWallet,
            treasury_wallet: g.treasuryWallet,
            ivy_balance: g.ivyBalance.toString(),
            game_balance: g.gameBalance.toString(),
        };
    }

    /**
     * Derive game address from seed
     */
    static deriveAddress(seed: Uint8Array): PublicKey {
        return PublicKey.createProgramAddressSync(
            [GAME_PREFIXES.game, seed],
            IVY_PROGRAM_ID,
        );
    }

    /**
     * Derive all game blockchain addresses from game address
     */
    public static deriveAddresses(game: PublicKey): GameAddresses {
        const game_bytes = game.toBuffer();
        const mint = PublicKey.createProgramAddressSync(
            [GAME_PREFIXES.mint, game_bytes],
            IVY_PROGRAM_ID,
        );
        const ivy_wallet = PublicKey.createProgramAddressSync(
            [GAME_PREFIXES.ivy_wallet, game_bytes],
            IVY_PROGRAM_ID,
        );
        const curve_wallet = PublicKey.createProgramAddressSync(
            [GAME_PREFIXES.curve_wallet, game_bytes],
            IVY_PROGRAM_ID,
        );
        const treasury_wallet = PublicKey.createProgramAddressSync(
            [GAME_PREFIXES.treasury_wallet, game_bytes],
            IVY_PROGRAM_ID,
        );
        return {
            mint,
            ivy_wallet,
            curve_wallet,
            treasury_wallet,
        };
    }

    /**
     * Generate a valid game seed
     */
    static generateSeed(): Uint8Array {
        let seed: Uint8Array;
        while (true) {
            seed = Keypair.generate().secretKey.slice(0, 32);
            try {
                const game = this.deriveAddress(seed);
                this.deriveAddresses(game);
                return seed;
            } catch (_) {
                // Continue trying if address derivation fails
            }
        }
    }

    /**
     * Gets the user's game balance in raw
     */
    static async getBalance(
        connection: Connection,
        game: PublicKey,
        user: PublicKey,
    ): Promise<string> {
        const mint = PublicKey.createProgramAddressSync(
            [GAME_PREFIXES.mint, game.toBuffer()],
            IVY_PROGRAM_ID,
        );
        const address = getAssociatedTokenAddressSync(mint, user);
        const info = await connection.getAccountInfo(address);
        if (!info) {
            return "0";
        }
        return String(info.data.readBigUint64LE(64));
    }

    /**
     * Creates a new game transaction
     */
    static async create(
        seed: Uint8Array,
        name: string,
        symbol: string,
        icon_url: string,
        game_url: string,
        cover_url: string,
        metadata_url: string,
        user: PublicKey,
        recent_slot: number,
        ivy_purchase: string,
        min_game_received: string,
        world_alt: AddressLookupTableAccount,
    ): Promise<VersionedTransaction> {
        if (icon_url.length > MAX_TEXT_LEN) {
            throw new Error(`Icon URL too long (max ${MAX_TEXT_LEN} chars)`);
        }
        if (game_url.length > MAX_TEXT_LEN) {
            throw new Error(`Game URL too long (max ${MAX_TEXT_LEN} chars)`);
        }
        if (cover_url.length > MAX_TEXT_LEN) {
            throw new Error(`Cover URL too long (max ${MAX_TEXT_LEN} chars)`);
        }

        const game = this.deriveAddress(seed);
        const { mint, ivy_wallet, curve_wallet, treasury_wallet } =
            this.deriveAddresses(game);
        const seed_array = Array.from(seed);
        const metadata_address = deriveMetadataAddress(mint);

        // Create a transaction with compute budget instruction
        const [swap_alt, swap_alt_nonce] = deriveAddressLookupTableAddress(
            game,
            recent_slot,
        );

        const source = getAssociatedTokenAddressSync(IVY_MINT, user);
        const destination = getAssociatedTokenAddressSync(mint, user);

        const ins = await ivy_program.methods
            .gameCreate(
                seed_array,
                str2zt(name, 64),
                str2zt(symbol, 16),
                str2zt(game_url, 128),
                str2zt(cover_url, 128),
                str2zt(metadata_url, 128),
                new BN(ivy_purchase),
                new BN(min_game_received),
                new BN(recent_slot),
                swap_alt_nonce,
                true, // create `destination` if not exist
                mkpad(6),
            )
            .accounts({
                game: game,
                user,
                source,
                destination,
                mint: mint,
                metadata: metadata_address,
                ivyWallet: ivy_wallet,
                curveWallet: curve_wallet,
                treasuryWallet: treasury_wallet,
                ivyMint: IVY_MINT,
                world: WORLD_ADDRESS,
                swapAlt: swap_alt,
            })
            .instruction();

        const msg = new TransactionMessage({
            payerKey: user,
            recentBlockhash: NULL_RECENT_BLOCKHASH,
            instructions: [ins],
        }).compileToV0Message([world_alt]);

        return new VersionedTransaction(msg);
    }

    /**
     * Creates a swap transaction between IVY and game tokens
     */
    static async swap(
        game_address: PublicKey,
        amount: string,
        threshold: string,
        is_buy: boolean,
        user: PublicKey,
    ): Promise<Transaction> {
        // Derive game addresses instead of fetching state
        const { mint, ivy_wallet, curve_wallet, treasury_wallet } =
            this.deriveAddresses(game_address);

        // Determine source and destination mints and associated token accounts
        const source_mint = is_buy ? IVY_MINT : mint;
        const destination_mint = is_buy ? mint : IVY_MINT;

        // Get associated token accounts for the user
        const source_account = getAssociatedTokenAddressSync(source_mint, user);
        const destination_account = getAssociatedTokenAddressSync(
            destination_mint,
            user,
        );

        // Create the swap transaction
        const tx = await ivy_program.methods
            .gameSwap(
                new BN(amount),
                new BN(threshold),
                is_buy,
                true, // create destination if not exist
                mkpad(6),
            )
            .accounts({
                game: game_address,
                user: user,
                source: source_account,
                destination: destination_account,
                ivyWallet: ivy_wallet,
                curveWallet: curve_wallet,
                treasuryWallet: treasury_wallet,
                world: WORLD_ADDRESS,
                gameMint: mint,
                ivyMint: IVY_MINT,
            })
            .transaction();

        return tx;
    }

    /**
     * Creates a transaction to credit tokens to the game treasury
     */
    static async credit(
        game: PublicKey,
        amount: string,
        user: PublicKey,
    ): Promise<Transaction> {
        // Get the treasury wallet for the game
        const { mint, treasury_wallet } = this.deriveAddresses(game);

        // Get associated token account for the source
        const source = getAssociatedTokenAddressSync(mint, user);

        // Create the debit transaction
        const tx = await ivy_program.methods
            .gameCredit(new BN(amount))
            .accounts({
                game,
                user,
                mint,
                treasuryWallet: treasury_wallet,
                source,
            })
            .transaction();

        return tx;
    }

    /**
     * Creates a transaction to debit tokens from the game treasury
     */
    static async debit(
        game_address: PublicKey,
        amount: string,
        owner: PublicKey,
    ): Promise<Transaction> {
        // Get the treasury wallet for the game
        const { mint, treasury_wallet } = this.deriveAddresses(game_address);

        // Get associated token account for the destination
        const destination = getAssociatedTokenAddressSync(mint, owner);

        // Create the debit transaction
        const tx = await ivy_program.methods
            .gameDebit(new BN(amount), true, mkpad(7))
            .accounts({
                game: game_address,
                owner,
                mint,
                treasuryWallet: treasury_wallet,
                destination: destination,
            })
            .transaction();

        return tx;
    }

    /**
     * Creates a transaction to complete a burn to the game's treasury
     */
    static async burnComplete(
        game_address: PublicKey,
        id: Uint8Array,
        user: PublicKey,
    ): Promise<Transaction> {
        if (id.length !== 32) {
            throw new Error("Deposit ID must be 32 bytes");
        }

        // Get the mint for the game
        const { mint } = this.deriveAddresses(game_address);

        // Get the user's token account for the game token
        const source_account = getAssociatedTokenAddressSync(mint, user);

        // Get the burn PDA
        const burn = PublicKey.findProgramAddressSync(
            [GAME_PREFIXES.burn, game_address.toBuffer(), id],
            IVY_PROGRAM_ID,
        )[0];

        // Create the complete burn transaction
        const tx = await ivy_program.methods
            .gameBurnComplete(Array.from(id))
            .accounts({
                game: game_address,
                user: user,
                burn,
                source: source_account,
                world: WORLD_ADDRESS,
            })
            .transaction();

        return tx;
    }

    /**
     * Creates a transaction to complete a deposit to the game's treasury
     */
    static async depositComplete(
        game_address: PublicKey,
        id: Uint8Array,
        user: PublicKey,
    ): Promise<Transaction> {
        if (id.length !== 32) {
            throw new Error("Deposit ID must be 32 bytes");
        }

        // Get the treasury wallet for the game
        const { treasury_wallet, mint } = this.deriveAddresses(game_address);

        // Get the user's token account for the game token
        const source_account = getAssociatedTokenAddressSync(mint, user);

        // Get the deposit PDA
        const deposit = PublicKey.findProgramAddressSync(
            [GAME_PREFIXES.deposit, game_address.toBuffer(), id],
            IVY_PROGRAM_ID,
        )[0];

        // Create the complete deposit transaction
        const tx = await ivy_program.methods
            .gameDepositComplete(Array.from(id))
            .accounts({
                game: game_address,
                user: user,
                deposit,
                source: source_account,
                treasuryWallet: treasury_wallet,
                world: WORLD_ADDRESS,
            })
            .transaction();

        return tx;
    }

    /**
     * Sign a withdraw for the given user,
     * returning a signature
     */
    static withdrawSign(
        game_address: PublicKey,
        id: Uint8Array,
        user: PublicKey,
        withdraw_authority_key: Uint8Array,
    ): Uint8Array {
        if (!(id instanceof Uint8Array)) {
            throw new Error("id must be of type Uint8Array");
        }
        if (!(withdraw_authority_key instanceof Uint8Array)) {
            throw new Error("id must be of type Uint8Array");
        }
        if (id.length !== 32) {
            throw new Error("id length must be 32 bytes");
        }
        if (withdraw_authority_key.length !== 64) {
            throw new Error("secret key length must be 64 bytes");
        }
        const msg = new Uint8Array(96);
        game_address.toBuffer().copy(msg, 0);
        user.toBuffer().copy(msg, 32);
        Buffer.from(id).copy(msg, 64);
        return nacl.sign.detached(msg, withdraw_authority_key);
    }

    /**
     * Creates a transaction to claim a withdraw from the game's treasury
     */
    static async withdrawClaim(
        game_address: PublicKey,
        withdraw_authority: PublicKey,
        id: Uint8Array,
        user: PublicKey,
        signature: Uint8Array,
    ): Promise<Transaction> {
        if (!(id instanceof Uint8Array)) {
            throw new Error("id must be of type Uint8Array");
        }
        if (!(signature instanceof Uint8Array)) {
            throw new Error("signature must be of type Uint8Array");
        }
        if (id.length !== 32) {
            throw new Error("Deposit ID must be 32 bytes");
        }
        if (signature.length !== 64) {
            throw new Error("Signature must be 64 bytes");
        }

        // Create message
        const msg = new Uint8Array(96);
        game_address.toBuffer().copy(msg, 0);
        user.toBuffer().copy(msg, 32);
        Buffer.from(id).copy(msg, 64);

        // Get the treasury wallet for the game
        const { treasury_wallet, mint } = this.deriveAddresses(game_address);

        // Get the user's token account for the game token
        const destination_account = getAssociatedTokenAddressSync(mint, user);

        // Get the withdraw PDA
        const withdraw = PublicKey.findProgramAddressSync(
            [GAME_PREFIXES.withdraw, game_address.toBuffer(), id],
            IVY_PROGRAM_ID,
        )[0];

        // Create the complete deposit transaction
        const tx = await ivy_program.methods
            .gameWithdrawClaim(Array.from(id), Array.from(signature), true)
            .accounts({
                game: game_address,
                user: user,
                withdraw: withdraw,
                destination: destination_account,
                treasuryWallet: treasury_wallet,
                world: WORLD_ADDRESS,
                mint,
            })
            .preInstructions([
                Ed25519Program.createInstructionWithPublicKey({
                    publicKey:
                        withdraw_authority.toBuffer() as unknown as Uint8Array,
                    message: msg,
                    signature,
                }),
            ])
            .transaction();

        return tx;
    }

    /** Check if a deposit is complete. */
    static async isDepositComplete(
        connection: Connection,
        game_address: PublicKey,
        id: Uint8Array,
    ) {
        if (id.length !== 32) {
            throw new Error("wrong id length");
        }
        const deposit = PublicKey.findProgramAddressSync(
            [GAME_PREFIXES.deposit, game_address.toBuffer(), id],
            IVY_PROGRAM_ID,
        )[0];
        const info = await connection.getAccountInfo(deposit);
        if (!info) {
            return false;
        }
        return info.lamports > 0;
    }

    /** Check if a withdraw has been claimed. */
    static async isWithdrawClaimed(
        connection: Connection,
        game_address: PublicKey,
        id: Uint8Array,
    ) {
        if (id.length !== 32) {
            throw new Error("wrong id length");
        }
        const withdraw = PublicKey.findProgramAddressSync(
            [GAME_PREFIXES.withdraw, game_address.toBuffer(), id],
            IVY_PROGRAM_ID,
        )[0];
        const info = await connection.getAccountInfo(withdraw);
        if (!info) {
            return false;
        }
        return info.lamports > 0;
    }

    /**
     * Edit a game
     */
    static async edit(
        game_address: PublicKey,
        owner: PublicKey,
        new_owner: PublicKey,
        new_withdraw_authority: PublicKey,
        game_url: string,
        cover_url: string,
        metadata_url: string,
    ): Promise<Transaction> {
        if (game_url.length > MAX_TEXT_LEN) {
            throw new Error(`Game URL too long (max ${MAX_TEXT_LEN} chars)`);
        }
        if (cover_url.length > MAX_TEXT_LEN) {
            throw new Error(`Cover URL too long (max ${MAX_TEXT_LEN} chars)`);
        }
        if (metadata_url.length > MAX_TEXT_LEN) {
            throw new Error(
                `Metadata URL too long (max ${MAX_TEXT_LEN} chars)`,
            );
        }

        const { mint } = this.deriveAddresses(game_address);
        const metadata = deriveMetadataAddress(mint);

        const tx = await ivy_program.methods
            .gameEdit(
                new_owner,
                new_withdraw_authority,
                str2zt(game_url, 128),
                str2zt(cover_url, 128),
                str2zt(metadata_url, 128),
            )
            .accounts({
                game: game_address,
                owner: owner,
                metadata: metadata,
                world: WORLD_ADDRESS,
            })
            .transaction();

        return tx;
    }
}
