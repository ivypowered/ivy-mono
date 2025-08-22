import express from "express";
import { AddressLookupTableAccount, Connection } from "@solana/web3.js";
import { World } from "ivy-sdk";
import {
    HELIUS_RPC_URL,
    LISTEN_PORT,
    PINATA_GATEWAY,
    PINATA_JWT,
    RPC_URL,
} from "./constants";
import { Cache } from "./utils/cache";
import { handleAsync } from "./utils/requestHelpers";
import { PriorityFee } from "./priority-fee";

// Route groups
import { health } from "./routes/root";
import { uploadImage, uploadMetadata } from "./routes/assets";
import { generateGameSeed, generateId, generateSyncSeed } from "./routes/ids";
import {
    burnCompleteTx,
    createGameTx,
    debitGameTx,
    depositCompleteTx,
    editGameTx,
    withdrawClaimTx,
} from "./routes/gameTx";
import { authenticate, getGameBalance, signWithdrawal } from "./routes/games";
import {
    confirmTransactionRoute,
    getTransactionEffects,
    sendTransaction,
} from "./routes/transactions";
import {
    getAccountsData,
    getContext,
    getTokenBalance,
    getTreasuryBalance,
    getWebMetadata,
    getWorldAlt,
} from "./routes/chain";
import { getSolPrice } from "./routes/price";
import { createSyncTx } from "./routes/sync";
import { Deps } from "./types/deps";

// --- Setup ---
const app = express();
const connection = new Connection(RPC_URL, "confirmed");
const cache = {
    blockhash: new Cache({
        f: () => connection.getLatestBlockhash(),
        updateInterval: 5,
        expiryInterval: 30,
    }),
    slot: new Cache({
        f: () => connection.getSlot(),
        updateInterval: 2,
        expiryInterval: 5,
    }),
    worldAlt: new Cache({
        f: async () => {
            const world = await World.loadState(connection);
            const data = (await connection.getAccountInfo(world.world_alt))
                ?.data;
            if (!data) {
                throw new Error("Can't find world ALT");
            }
            const alt = new AddressLookupTableAccount({
                key: world.world_alt,
                state: AddressLookupTableAccount.deserialize(data),
            });
            return { data, alt };
        },
        updateInterval: Number.MAX_SAFE_INTEGER,
        expiryInterval: Number.MAX_SAFE_INTEGER,
    }),
};

// The priority fee service. We don't use this on localhost :)
const priorityFeeService: PriorityFee | null = HELIUS_RPC_URL
    ? new PriorityFee(HELIUS_RPC_URL)
    : null;
if (priorityFeeService) {
    // start priority fee background task
    priorityFeeService.run();
}

// Build dependencies for routes
const deps: Deps = {
    connection,
    cache,
    priorityFeeService,
};

// --- Middleware ---
app.use(express.json({ limit: "5mb" }));

// Static Assets (for debug uploads)
if (!PINATA_JWT || !PINATA_GATEWAY) {
    app.use("/tmp", express.static("tmp"));
}

/**********************************
|   Routes                        |
***********************************/
// Health
app.get("/", handleAsync(health(deps)));

// ID + Seeds
app.get("/id", handleAsync(generateId(deps)));
app.post("/game-seed", handleAsync(generateGameSeed(deps)));
app.post("/sync-seed", handleAsync(generateSyncSeed(deps)));

// Assets
app.post("/assets/images", handleAsync(uploadImage(deps)));
app.post("/assets/metadata", handleAsync(uploadMetadata(deps)));

// Game TX
app.post("/tx/game/create", handleAsync(createGameTx(deps)));
app.post("/tx/game/edit", handleAsync(editGameTx(deps)));
app.post("/tx/game/debit", handleAsync(debitGameTx(deps)));
app.post("/tx/game/withdraw-claim", handleAsync(withdrawClaimTx(deps)));
app.post("/tx/game/deposit-complete", handleAsync(depositCompleteTx(deps)));
app.post("/tx/game/burn-complete", handleAsync(burnCompleteTx(deps)));

// Sync TX
app.post("/tx/sync/create", handleAsync(createSyncTx(deps)));

// Games REST
app.get("/games/:game/balances/:user", handleAsync(getGameBalance(deps)));
app.post("/games/:game/withdrawals/:id", handleAsync(signWithdrawal(deps)));
app.post("/games/:game/authenticate", handleAsync(authenticate(deps)));

// Transaction utilities
app.post("/tx/send", handleAsync(sendTransaction(deps)));
app.get("/tx/confirm/:signature", handleAsync(confirmTransactionRoute(deps)));
app.get("/tx/effects/:signature", handleAsync(getTransactionEffects(deps)));

// Chain utilities
app.post("/accounts-data", handleAsync(getAccountsData(deps)));
app.post("/token-balance", handleAsync(getTokenBalance(deps)));
app.post("/treasury-balance", handleAsync(getTreasuryBalance(deps)));
app.get("/ctx/:insName", handleAsync(getContext(deps)));
app.get("/world-alt", handleAsync(getWorldAlt(deps)));
app.post("/web-metadata", handleAsync(getWebMetadata(deps)));

// Price
app.get("/sol-price", handleAsync(getSolPrice(deps)));

// Start server
app.listen(LISTEN_PORT, () => {
    console.log(`Server is running on port ${LISTEN_PORT}`);
});
