import { Request } from "express";
import { Deps } from "../types/deps";

export const health = (_: Deps) => async (_req: Request) => {
    return Math.floor(new Date().getTime() / 1000);
};
