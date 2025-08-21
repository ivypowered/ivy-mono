import { Request } from "express";
import { Deps } from "../types/deps";
import { SolPrice } from "../sol_price";

export const getSolPrice = (_: Deps) => async (_req: Request) => {
    const price = await SolPrice.get();
    return price;
};
