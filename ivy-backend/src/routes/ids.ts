import { z } from "zod";
import { Request } from "express";
import { Deps } from "../types/deps";
import { Game, Id } from "ivy-sdk";
import { KEYGEN_URL } from "../constants";

export const generateId = (_: Deps) => async (req: Request) => {
    const schema = z.object({ amountRaw: z.string() });
    const { amountRaw } = schema.parse(req.query);
    const idBytes = Id.generate(amountRaw);
    const idHex = Buffer.from(idBytes).toString("hex");
    return idHex;
};

export const generateGameSeed = (_: Deps) => async (_req: Request) => {
    if (!KEYGEN_URL) {
        return Buffer.from(Game.generateSeed()).toString("hex");
    }
    const seed_url = KEYGEN_URL + "/seed/game";
    let response: any;
    try {
        response = await (
            await fetch(seed_url, {
                method: "POST",
            })
        ).json();
    } catch (e) {
        if (!(e instanceof Error)) throw e;
        throw new Error(`can't fetch ${seed_url}: ${e.message} @ ${e.stack}`);
    }
    if (typeof response !== "object" || typeof response["seed"] !== "string") {
        throw new Error("invalid response from keygen");
    }
    return response["seed"];
};
