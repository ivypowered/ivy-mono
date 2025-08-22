import { z } from "zod";
import { Request } from "express";
import { Deps } from "../types/deps";
import { Auth, Game, GAME_DECIMALS } from "ivy-sdk";
import { parsePublicKey, parseHex } from "../utils/requestHelpers";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

const getGameBalanceSchema = z.object({
    game: z.string(),
    user: z.string(),
});

export const getGameBalance =
    ({ connection }: Deps) =>
    async (req: Request) => {
        const params = getGameBalanceSchema.parse(req.params);

        const game_address = parsePublicKey(params.game, "game");
        const user_address = parsePublicKey(params.user, "user");

        const balance_raw = await Game.getBalance(
            connection,
            game_address,
            user_address,
        );
        const balance = parseInt(balance_raw) / Math.pow(10, GAME_DECIMALS);

        return balance;
    };

const signWithdrawalBodySchema = z.object({
    user: z.string(),
    withdraw_authority_key: z.string(),
});

const signWithdrawalParamsSchema = z.object({
    game: z.string(),
    id: z.string(),
});

export const signWithdrawal = (_deps: Deps) => async (req: Request) => {
    const { game, id } = signWithdrawalParamsSchema.parse(req.params);
    const { user, withdraw_authority_key } = signWithdrawalBodySchema.parse(
        req.body,
    );

    const game_public_key = parsePublicKey(game, "game");
    const user_public_key = parsePublicKey(user, "user");
    const withdraw_id_bytes = parseHex(id, "id");

    // Parse the withdraw authority private key (hex -> bytes)
    const withdraw_authority_key_bytes: Uint8Array = parseHex(
        withdraw_authority_key,
        "withdraw_authority_key",
    );

    // Generate the signature
    const signature = Game.withdrawSign(
        game_public_key,
        withdraw_id_bytes,
        user_public_key,
        withdraw_authority_key_bytes,
    );

    return { signature: Buffer.from(signature).toString("hex") };
};

const authParamsSchema = z.object({
    game: z.string(),
});
const authBodySchema = z.object({
    message: z.string(),
    signature: z.string(), // base58
});

export const authenticate = (_deps: Deps) => async (req: Request) => {
    const { game } = authParamsSchema.parse(req.params);
    const { message, signature } = authBodySchema.parse(req.body);

    const gamePublicKey = parsePublicKey(game, "game");
    const signatureBytes = bs58.decode(signature);

    const user = Auth.verifyMessage(gamePublicKey, message, signatureBytes);
    return user.toBase58();
};
