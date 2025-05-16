import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { TEXT_ENCODER } from "./interface";

const AUTH_MSG_REGEX =
    /^Authenticate user ([1-9A-Za-z]+) to game ([1-9A-Za-z]+) on ivypowered.com, valid from ([0-9]+) to ([0-9]+)$/;

export class Auth {
    /// Create an authentication message from a game and user.
    static createMessage(game: PublicKey, user: PublicKey): string {
        const now = Math.floor(new Date().getTime() / 1000);
        const start = now - 60;
        const end = now + 86400;
        return `Authenticate user ${user.toBase58()} to game ${game.toBase58()} on ivypowered.com, valid from ${start} to ${end}`;
    }

    /// Gets the expiry of a given authentication message
    /// as a Unix timestamp
    static getMessageExpiry(msg: string): number {
        const results = msg.match(AUTH_MSG_REGEX);
        if (!results) {
            throw new Error("getMessageExpiry: incorrect auth msg format");
        }
        const v = parseInt(results[4]);
        if (v - v !== 0) {
            throw new Error("getMessageExpiry: invalid msg expiry");
        }
        return v;
    }

    /// Verifies the given authentication message,
    /// returning the user that signed it.
    static verifyMessage(
        game: PublicKey,
        msg: string,
        signature: Uint8Array,
    ): PublicKey {
        if (!(game instanceof PublicKey)) {
            throw new Error("Unauthorized: Game must be a public key");
        }
        if (typeof msg !== "string") {
            throw new Error("Unauthorized: Message must be a string");
        }
        if (!(signature instanceof Uint8Array)) {
            throw new Error("Unauthorized: Signature must be a Uint8Array");
        }
        if (msg.length > 256) {
            throw new Error("Unauthorized: Message too long");
        }
        const results = msg.match(AUTH_MSG_REGEX);
        if (!results) {
            throw new Error("Unauthorized: Incorrect message format");
        }
        const [, user_b58, game_provided_b58, start_str, end_str] = results;
        let user: PublicKey;
        try {
            user = new PublicKey(user_b58);
        } catch (_) {
            throw new Error(
                "Unauthorized: Message user is not a valid b58-encoded address",
            );
        }
        if (
            !nacl.sign.detached.verify(
                TEXT_ENCODER.encode(msg),
                signature,
                user.toBytes(),
            )
        ) {
            throw new Error("Unauthorized: Message signature is invalid");
        }
        let game_provided: PublicKey;
        try {
            game_provided = new PublicKey(game_provided_b58);
        } catch (_) {
            throw new Error(
                "Unauthorized: Message game is not a valid b58-encoded public key",
            );
        }
        if (!game.equals(game_provided)) {
            throw new Error(
                `Unauthorized: Expected message to have game ${game.toBase58()}, but got ${game_provided.toBase58()}`,
            );
        }
        const start = parseInt(start_str);
        if (!start) {
            throw new Error(
                "Unauthorized: Message start time is not a natural number",
            );
        }
        const end = parseInt(end_str);
        if (!end) {
            throw new Error(
                "Unauthorized: Message end time is not a natural number",
            );
        }
        const now = Math.floor(new Date().getTime() / 1000);
        if (now < start || now > end) {
            throw new Error(
                `Unauthorized: Message is only valid within the interval [${start}, ${end}], but the current time is ${now}`,
            );
        }
        return user;
    }
}
