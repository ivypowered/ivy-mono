import { z } from "zod";
import { Request } from "express";
import { Deps } from "../types/deps";
import {
    Game,
    IVY_MINT,
} from "ivy-sdk";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { prepareTransaction } from "../utils/transactions";
import { parseHex, parsePublicKey } from "../utils/requestHelpers";

const createSchema = z.object({
    seed: z.string(),
    name: z.string(),
    symbol: z.string(),
    icon_url: z.string(),
    game_url: z.string(),
    short_desc: z.string(),
    metadata_url: z.string(),
    ivy_purchase: z.string(),
});

export const createGameTx = ({ cache }: Deps) => async (req: Request) => {
    const data = createSchema.parse(req.body);

    const user_wallet = Keypair.generate();
    const seed = Buffer.from(data.seed, "hex") as Uint8Array;
    const recent_slot = (await cache.slot.get()) - 1;
    const world_alt = (await cache.worldAlt.get()).alt;

    const tx = await Game.create(
        seed,
        data.name,
        data.symbol,
        data.icon_url,
        data.game_url,
        data.short_desc,
        data.metadata_url,
        user_wallet.publicKey,
        recent_slot,
        data.ivy_purchase,
        world_alt,
    );

    const game = Game.deriveAddress(seed);
    const { mint } = Game.deriveAddresses(game);
    const prepared = prepareTransaction("GameCreate", tx, user_wallet, [
        // src (user -> Ivy mint)
        {
            seeds: [user_wallet.publicKey, TOKEN_PROGRAM_ID, IVY_MINT],
            program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
        },
        // dst (user -> game mint)
        {
            seeds: [user_wallet.publicKey, TOKEN_PROGRAM_ID, mint],
            program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
        },
    ]);

    return {
        address: game.toString(),
        tx: prepared,
    };
};

const editSchema = z.object({
    game: z.string(),
    owner: z.string(),
    new_owner: z.string(),
    new_withdraw_authority: z.string(),
    game_url: z.string(),
    short_desc: z.string(),
    metadata_url: z.string(),
    icon_url: z.string(),
});

export const editGameTx = (_deps: Deps) => async (req: Request) => {
    const data = editSchema.parse(req.body);

    const game_address = parsePublicKey(data.game, "game");
    const owner_address = parsePublicKey(data.owner, "owner");
    const new_owner_address = parsePublicKey(data.new_owner, "new_owner");
    const new_withdraw_authority_address = parsePublicKey(
        data.new_withdraw_authority,
        "new_withdraw_authority",
    );

    const tx = await Game.edit(
        game_address,
        owner_address,
        new_owner_address,
        new_withdraw_authority_address,
        data.game_url,
        data.short_desc,
        data.metadata_url,
        data.icon_url,
    );

    // Preserve original insName "GameCreate" for compatibility
    const prepared = prepareTransaction("GameCreate", tx, owner_address);
    return prepared;
};

const debitSchema = z.object({
    game: z.string(),
    amount: z.string(),
    user: z.string(),
});

export const debitGameTx = (_deps: Deps) => async (req: Request) => {
    const data = debitSchema.parse(req.body);

    const game_public_key = parsePublicKey(data.game, "game");
    const user_public_key = parsePublicKey(data.user, "user");

    const tx = await Game.debit(game_public_key, data.amount, user_public_key);
    const prepared = prepareTransaction("GameDebit", tx, user_public_key);
    return prepared;
};

const withdrawClaimSchema = z.object({
    game: z.string(),
    withdraw_id: z.string(),
    user: z.string(),
    signature: z.string(),
    withdraw_authority: z.string(),
});

export const withdrawClaimTx = (_deps: Deps) => async (req: Request) => {
    const data = withdrawClaimSchema.parse(req.body);

    const game_public_key = parsePublicKey(data.game, "game");
    const user_public_key = parsePublicKey(data.user, "user");
    const withdraw_authority = parsePublicKey(
        data.withdraw_authority,
        "withdraw_authority",
    );
    const withdraw_id_bytes = parseHex(data.withdraw_id, "withdraw_id");
    const signature_bytes = parseHex(data.signature, "signature");

    const tx = await Game.withdrawClaim(
        game_public_key,
        withdraw_authority,
        withdraw_id_bytes,
        user_public_key,
        signature_bytes,
    );

    const prepared = prepareTransaction("GameWithdrawClaim", tx, user_public_key);
    return prepared;
};

const depositCompleteSchema = z.object({
    game: z.string(),
    deposit_id: z.string(),
});

export const depositCompleteTx = (_deps: Deps) => async (req: Request) => {
    const data = depositCompleteSchema.parse(req.body);

    const game_public_key = parsePublicKey(data.game, "game");
    const deposit_id_bytes = parseHex(data.deposit_id, "deposit_id");

    const user = Keypair.generate().publicKey;

    const tx = await Game.depositComplete(game_public_key, deposit_id_bytes, user);

    const { mint } = Game.deriveAddresses(game_public_key);
    const prepared = prepareTransaction("GameDepositComplete", tx, user, [
        {
            // user source ATA
            seeds: [user, TOKEN_PROGRAM_ID, mint],
            program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
        },
    ]);

    return prepared;
};

const burnCompleteSchema = z.object({
    game: z.string(),
    burn_id: z.string(),
});

export const burnCompleteTx = (_deps: Deps) => async (req: Request) => {
    const data = burnCompleteSchema.parse(req.body);

    const game_public_key = parsePublicKey(data.game, "game");
    const burn_id_bytes = parseHex(data.burn_id, "burn_id");

    const user = Keypair.generate().publicKey;

    const tx = await Game.burnComplete(game_public_key, burn_id_bytes, user);

    const { mint } = Game.deriveAddresses(game_public_key);
    const prepared = prepareTransaction("GameBurnComplete", tx, user, [
        {
            // user source ATA
            seeds: [user, TOKEN_PROGRAM_ID, mint],
            program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
        },
    ]);

    return prepared;
};
