import express from "express";
import {
    AddressLookupTableAccount,
    Connection,
    Keypair,
    PublicKey,
    SendTransactionError,
    Signer,
    Transaction,
    VersionedTransaction,
    VersionedTransactionResponse,
} from "@solana/web3.js";
import {
    getEvents,
    Game,
    GAME_DECIMALS,
    IVY_MINT,
    Auth,
    Id,
    World,
} from "ivy-sdk";
import { confirmTransaction } from "./functions/confirmTransaction";
import {
    EVENTS_MAX_CONCURRENT_REQUESTS,
    EVENTS_USE_BATCH,
    LISTEN_PORT,
    PINATA_GATEWAY,
    PINATA_JWT,
    RPC_URL,
    WSOL_MINT,
} from "./constants";
import { Cache } from "./utils/cache";
import {
    handleAsync,
    parsePublicKey,
    validateRequestBody,
} from "./utils/requestHelpers";
import {
    createAndUploadMetadata,
    getReasonablePriorityFee,
    uploadImageToIPFS,
} from "./util";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
    AccountLayout,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

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
    fee: new Cache({
        f: () => getReasonablePriorityFee(connection),
        updateInterval: 60,
        expiryInterval: 120,
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

// Fetching the fee takes a long time
// (we fetch 1,000 txs, so it makes sense)
// So, to make things easier for end users,
// we refresh it every 60 seconds
{
    // Trigger 1st refresh
    cache.fee.get();

    // Periodically refresh the reasonable priroity fee
    setInterval(() => cache.fee.get(), 60_000);
}

// --- Middleware ---
app.use(express.json({ limit: "5mb" }));

// --- CORS middleware ---
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS, PUT, DELETE",
    );
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
});

// --- Helper Functions ---
interface PreparedTransaction {
    base64: string;
    feePayer: string;
    derived: {
        seeds: string[];
        programId: string;
    }[];
}

const NULL_BLOCKHASH: string = PublicKey.default.toBase58();
function prepareTransaction(
    tx: Transaction | VersionedTransaction,
    feePayer: PublicKey | Keypair,
    derived?: {
        seeds: PublicKey[];
        program_id: PublicKey;
    }[],
): PreparedTransaction {
    let txData: Buffer;
    if (tx instanceof Transaction) {
        tx.recentBlockhash = NULL_BLOCKHASH;
        if (feePayer instanceof Keypair) {
            tx.feePayer = feePayer.publicKey;
        } else {
            tx.feePayer = feePayer;
        }
        txData = tx.serialize({ requireAllSignatures: false });
    } else {
        // VersionedTransaction requires a recentBlockhash to serialize
        tx.message.recentBlockhash = NULL_BLOCKHASH;
        if (!(feePayer instanceof Keypair)) {
            throw new Error(
                "When preparing VersionedTransaction, we need a fake keypair",
            );
        }
        // Avoids "Error: Expected signatures length to be equal to the number of required signatures"
        tx.sign([feePayer]);
        txData = Buffer.from(tx.serialize());
    }

    return {
        base64: txData.toString("base64"),
        // The client will replace this with its own
        // public key :)
        feePayer:
            feePayer instanceof Keypair
                ? feePayer.publicKey.toBase58()
                : feePayer.toBase58(),
        derived:
            derived?.map((x) => ({
                seeds: x.seeds.map((s) => s.toBase58()),
                programId: x.program_id.toBase58(),
            })) || [],
    };
}

// --- Routes ---

// Health check endpoint
app.get("/", (_, res) => res.status(200).json({ status: "ok" }));

// Static Assets (for debug uploads)
if (!PINATA_JWT || !PINATA_GATEWAY) {
    app.use("/tmp", express.static("tmp"));
}

/**********************************
|   Routes for PHP `ivy-frontend` *
***********************************/

// Generate an ID
app.get(
    "/id",
    handleAsync(async (req, res) => {
        const { amountRaw } = req.query;

        if (typeof amountRaw !== "string") {
            throw new Error("Query param 'amountRaw' must be a string");
        }

        const idBytes = Id.generate(amountRaw);
        const idHex = Buffer.from(idBytes).toString("hex");

        return res.status(200).json({
            status: "ok",
            data: idHex,
        });
    }),
);

// Upload an image to IPFS
app.post(
    "/assets/images",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "base64_image", type: "string" },
            { name: "image_type", type: "string" },
        ]);

        const image_url = await uploadImageToIPFS(
            data.base64_image,
            data.image_type,
        );
        return res.status(200).json({ status: "ok", data: image_url });
    }),
);

// Upload token metadata to IPFS
app.post(
    "/assets/metadata",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "name", type: "string" },
            { name: "symbol", type: "string" },
            { name: "icon_url", type: "string" },
            { name: "description", type: "string" },
        ]);

        const metadata_url = await createAndUploadMetadata(
            data.name,
            data.symbol,
            data.icon_url,
            data.description,
        );
        return res.status(200).json({ status: "ok", data: metadata_url });
    }),
);

// Create a game
app.post(
    "/tx/game/create",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "name", type: "string" },
            { name: "symbol", type: "string" },
            { name: "short_desc", type: "string" },
            { name: "icon_url", type: "string" },
            { name: "game_url", type: "string" },
            { name: "cover_url", type: "string" },
            { name: "metadata_url", type: "string" },
            { name: "ivy_purchase", type: "string" },
            { name: "min_game_received", type: "string" },
        ]);

        const user_wallet = Keypair.generate();
        const seed = Game.generateSeed();
        const recent_slot = (await cache.slot.get()) - 1;
        const world_alt = (await cache.worldAlt.get()).alt;
        const tx = await Game.create(
            seed,
            data.name,
            data.symbol,
            data.short_desc,
            data.icon_url,
            data.game_url,
            data.cover_url,
            data.metadata_url,
            user_wallet.publicKey,
            recent_slot,
            data.ivy_purchase,
            data.min_game_received,
            world_alt,
        );

        const game = Game.deriveAddress(seed);
        const { mint } = Game.deriveAddresses(game);
        const prepared = prepareTransaction(tx, user_wallet, [
            // src
            {
                seeds: [user_wallet.publicKey, TOKEN_PROGRAM_ID, IVY_MINT],
                program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
            },
            // dst
            {
                seeds: [user_wallet.publicKey, TOKEN_PROGRAM_ID, mint],
                program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
            },
        ]);

        return res.status(200).json({
            status: "ok",
            data: {
                address: game.toString(),
                tx: prepared,
            },
        });
    }),
);

// Edit a game
app.post(
    "/tx/game/edit",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "game", type: "string" },
            { name: "owner", type: "string" },
            { name: "new_owner", type: "string" },
            { name: "new_withdraw_authority", type: "string" },
            { name: "game_url", type: "string" },
            { name: "cover_url", type: "string" },
            { name: "metadata_url", type: "string" },
        ]);

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
            data.cover_url,
            data.metadata_url,
        );

        const prepared = prepareTransaction(tx, owner_address);

        return res.status(200).json({
            status: "ok",
            data: prepared,
        });
    }),
);

// Debit from game
app.post(
    "/tx/game/debit",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "game", type: "string" },
            { name: "amount", type: "string" },
            { name: "user", type: "string" },
        ]);

        const game_public_key = parsePublicKey(data.game, "game");
        const user_public_key = parsePublicKey(data.user, "user");

        const tx = await Game.debit(
            game_public_key,
            data.amount,
            user_public_key,
        );

        const prepared = prepareTransaction(tx, user_public_key);

        return res.status(200).json({
            status: "ok",
            data: prepared,
        });
    }),
);

// Helper function to convert hex ID to byte array
function parseHex(hexId: string, idName: string): Uint8Array {
    try {
        // Remove '0x' prefix if present
        if (hexId.startsWith("0x")) {
            hexId = hexId.substring(2);
        }

        // Convert to Uint8Array
        return Uint8Array.from(Buffer.from(hexId, "hex"));
    } catch (error) {
        throw new Error(`Invalid ${idName} format: ${error}`);
    }
}

// Claim a game withdraw
app.post(
    "/tx/game/withdraw-claim",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "game", type: "string" },
            { name: "withdraw_id", type: "string" },
            { name: "user", type: "string" },
            { name: "signature", type: "string" },
            { name: "withdraw_authority", type: "string" },
        ]);

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

        const prepared = prepareTransaction(tx, user_public_key);

        return res.status(200).json({
            status: "ok",
            data: prepared,
        });
    }),
);

// Complete a game deposit
app.post(
    "/tx/game/deposit-complete",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "game", type: "string" },
            { name: "deposit_id", type: "string" },
        ]);

        const game_public_key = parsePublicKey(data.game, "game");
        const deposit_id_bytes = parseHex(data.deposit_id, "deposit_id");

        const user = Keypair.generate().publicKey;

        const tx = await Game.depositComplete(
            game_public_key,
            deposit_id_bytes,
            user,
        );

        const { mint } = Game.deriveAddresses(game_public_key);
        const prepared = prepareTransaction(tx, user, [
            {
                // user source ATA
                seeds: [user, TOKEN_PROGRAM_ID, mint],
                program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
            },
        ]);

        return res.status(200).json({
            status: "ok",
            data: prepared,
        });
    }),
);

// Complete a game burn
app.post(
    "/tx/game/burn-complete",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "game", type: "string" },
            { name: "burn_id", type: "string" },
        ]);

        const game_public_key = parsePublicKey(data.game, "game");
        const burn_id_bytes = parseHex(data.burn_id, "burn_id");

        const user = Keypair.generate().publicKey;

        const tx = await Game.burnComplete(
            game_public_key,
            burn_id_bytes,
            user,
        );

        const { mint } = Game.deriveAddresses(game_public_key);
        const prepared = prepareTransaction(tx, user, [
            {
                // user source ATA
                seeds: [user, TOKEN_PROGRAM_ID, mint],
                program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
            },
        ]);

        return res.status(200).json({
            status: "ok",
            data: prepared,
        });
    }),
);

/// Test for TX expiration or failure
// (we don't need this anymore; still useful code)
if ((() => false)()) {
    app.get(
        "/tx/is-expired-or-failed/:signature",
        handleAsync(async (req, res) => {
            const { signature } = req.params;
            const { lastValidBlockHeight } = req.query;

            if (!signature) {
                throw new Error("Missing required parameter: signature");
            }
            if (
                !lastValidBlockHeight ||
                typeof lastValidBlockHeight !== "string"
            ) {
                throw new Error(
                    "Missing or invalid required query param: lastValidBlockHeight",
                );
            }

            const lastValidBlockHeightInteger = parseInt(
                lastValidBlockHeight as string,
            );
            if (isNaN(lastValidBlockHeightInteger)) {
                throw new Error("lastValidBlockHeight must be a valid number");
            }

            // 1. Fetch block height
            const currentBlockHeight =
                await connection.getBlockHeight("confirmed");

            // 2. Get signature status (this MUST happen after).
            const tx = await connection.getSignatureStatus(signature, {
                // Solana node will search its full TX history for the Transaction
                // This is necessary for correctness
                searchTransactionHistory: true,
            });

            // We are expired if:
            // - At time t2, the transaction does not exist on the blockchain.
            // - At time t1 < t2, the block height surpassed the last valid block height.
            // This is because a Solana transaction will not be included in
            // a block height greater than its last valid block height.
            //
            // Note that we cannot switch t1 and t2, otherwise,
            // if (block height) < (last valid block height),
            // we could fetch the tx from the blockchain, it could not exist,
            // some time could pass, and a (block height) > (last valid block height)
            // could be returned. Then, `isExpired` would be true, and we would be cooked!
            const isExpired =
                !tx.value && currentBlockHeight > lastValidBlockHeightInteger;

            // If the TX has an error, it's failed.
            const isFailed = tx.value && tx.value.err ? true : false;

            return res.status(200).json({
                status: "ok",
                data: isExpired || isFailed,
            });
        }),
    );
}

// Get the game balance for a user
app.get(
    "/games/:game/balances/:user",
    handleAsync(async (req, res) => {
        const { game, user } = req.params;
        if (!game || !user) throw new Error("Missing required parameter: user");

        const game_address = parsePublicKey(game, "game");
        const user_address = parsePublicKey(user, "user");

        const balance_raw = await Game.getBalance(
            connection,
            game_address,
            user_address,
        );
        const balance = parseInt(balance_raw) / Math.pow(10, GAME_DECIMALS);

        return res.status(200).json({
            status: "ok",
            data: balance,
        });
    }),
);

/// Sign a withdraw for a user
app.post(
    "/games/:game/withdrawals/:id",
    handleAsync(async (req, res) => {
        const { game, id } = req.query;
        if (typeof game !== "string") {
            throw new Error("game must be string");
        }
        if (typeof id !== "string") {
            throw new Error("id must be string");
        }

        const data = validateRequestBody(req.body, [
            { name: "user", type: "string" },
            { name: "withdraw_authority_key", type: "string" },
        ]);

        const game_public_key = parsePublicKey(game, "game");
        const user_public_key = parsePublicKey(data.user, "user");
        const withdraw_id_bytes = parseHex(id, "id");

        // Parse the withdraw authority private key
        let withdraw_authority_key: Uint8Array = parseHex(
            data.withdraw_authority_key,
            "withdraw_authority_key",
        );

        // Generate the signature
        const signature = Game.withdrawSign(
            game_public_key,
            withdraw_id_bytes,
            user_public_key,
            withdraw_authority_key,
        );

        return res.status(200).json({
            status: "ok",
            data: {
                signature: Buffer.from(signature).toString("hex"),
            },
        });
    }),
);

// Verify a game message
app.post(
    "/games/:game/authenticate",
    handleAsync(async (req, res) => {
        const { game } = req.query;
        const { message, signature } = req.body;

        // Validate required parameters
        if (typeof game !== "string") {
            throw new Error("Query param 'game' must be a string");
        }
        if (typeof message !== "string") {
            throw new Error("Body param 'message' must be a string");
        }
        if (typeof signature !== "string") {
            throw new Error("Body param 'signature' must be a string");
        }

        // Parse game address
        const gamePublicKey = parsePublicKey(game, "game");

        // Parse signature (from base58)
        const signatureBytes = bs58.decode(signature);

        // Verify the message and get the authenticated user
        const user = Auth.verifyMessage(gamePublicKey, message, signatureBytes);

        return res.status(200).json({
            status: "ok",
            data: user.toBase58(),
        });
    }),
);

/************************************
|   Routes for React: `ivy-react`   |
************************************/

// Send a transaction
app.post(
    "/tx/send",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "tx_base64", type: "string" },
        ]);

        let signature: string;
        try {
            signature = await connection.sendEncodedTransaction(
                data.tx_base64,
                {
                    preflightCommitment: connection.commitment,
                },
            );
        } catch (e) {
            if (!(e instanceof SendTransactionError)) {
                throw new Error("can't send tx: " + String(e));
            }
            const logsStr = JSON.stringify(
                await e.getLogs(connection),
                null,
                4,
            );
            throw new Error(`${e.transactionError.message}\nLogs: ${logsStr}`);
        }

        return res.status(200).json({
            status: "ok",
            data: { signature },
        });
    }),
);

/// Confirm a transaction with signature `signature`
app.get(
    "/tx/confirm/:signature",
    handleAsync(async (req, res) => {
        const { signature } = req.params;
        const { lastValidBlockHeight } = req.query;

        if (!signature) {
            throw new Error("Missing required parameter: signature");
        }
        if (!lastValidBlockHeight || typeof lastValidBlockHeight !== "string") {
            throw new Error(
                "Missing or invalid required query param: lastValidBlockHeight",
            );
        }

        const block_height = parseInt(lastValidBlockHeight);
        if (isNaN(block_height)) {
            throw new Error("lastValidBlockHeight must be a valid number");
        }

        await confirmTransaction(connection, signature, block_height);

        return res.status(200).json({
            status: "ok",
            data: null,
        });
    }),
);

// Get multiple accounts' data as base64 array (for ALT lookup)
app.post(
    "/accounts-data",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "accounts", type: "array" },
        ]);

        if (!Array.isArray(data.accounts)) {
            throw new Error("Accounts must be an array");
        }

        // Convert string accounts to PublicKey objects
        const publicKeys = data.accounts.map((account) =>
            parsePublicKey(account, "account"),
        );

        if (data.accounts.length > 100) {
            throw new Error("Maximum of 100 accounts allowed");
        }

        // Fetch the accounts data
        const accountsData =
            await connection.getMultipleAccountsInfo(publicKeys);

        // Format the response with base64 data
        const result = accountsData.map((account) => {
            if (!account) return null;
            return account.data.toString("base64");
        });

        return res.status(200).json({
            status: "ok",
            data: result,
        });
    }),
);

// Get user's token balance
app.post(
    "/token-balance",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "user", type: "string" },
            { name: "mint", type: "string" },
        ]);

        const user = parsePublicKey(data.user, "user");
        const mint = parsePublicKey(data.mint, "mint");
        let balance: string; // raw, so it's in u64
        if (mint.equals(WSOL_MINT)) {
            // this is Solana, get user's native balance
            const info = await connection.getAccountInfo(user);
            if (info) {
                balance = info.lamports.toString();
            } else {
                balance = "0";
            }
        } else {
            // get associated token account
            const info = await connection.getAccountInfo(
                getAssociatedTokenAddressSync(mint, user),
            );
            if (info) {
                balance = String(AccountLayout.decode(info.data).amount);
            } else {
                balance = "0";
            }
        }

        return res.status(200).json({
            status: "ok",
            data: balance,
        });
    }),
);

// Get game treasury balance
app.post(
    "/treasury-balance",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "game", type: "string" },
        ]);
        const game = parsePublicKey(data.game, "game");
        const { treasury_wallet } = Game.deriveAddresses(game);
        const v = await connection.getTokenAccountBalance(treasury_wallet);
        return res.status(200).json({
            status: "ok",
            data: v.value.amount,
        });
    }),
);

// Get a map (mint -> delta) detailing how the provided
// transaction affected the user's token balances
app.post(
    "/tx-token-deltas",
    handleAsync(async (req, res) => {
        const data = validateRequestBody(req.body, [
            { name: "user", type: "string" },
            { name: "signature", type: "string" },
        ]);

        const user = parsePublicKey(data.user, "user");
        const signature = String(data.signature);
        const signature_length = bs58.decode(signature).length;
        if (signature_length !== 64) {
            throw new Error(
                "incorrect signature length: expected 64 bytes, got " +
                    signature_length,
            );
        }

        let result: VersionedTransactionResponse | null = null;
        // Fetch TX with retry logic - transaction might not have
        // propagated to this node yet
        for (let i = 0; i < 10; i++) {
            result = await connection.getTransaction(signature, {
                maxSupportedTransactionVersion: 1,
            });
            if (result) {
                break;
            }
            await new Promise((res) => setTimeout(res, 1000));
        }
        if (!result) {
            throw new Error("Can't find signature " + signature);
        }
        const owner = user.toString();
        const b: Record<string, number> = {};
        result.meta?.postTokenBalances
            ?.filter((x) => x.owner == owner)
            .forEach((x) => (b[x.mint] = x.uiTokenAmount.uiAmount || 0));
        result.meta?.preTokenBalances
            ?.filter((x) => x.owner == owner)
            .forEach(
                (x) =>
                    (b[x.mint] =
                        (b[x.mint] || 0) - (x.uiTokenAmount.uiAmount || 0)),
            );
        let sol_change = 0;
        sol_change += (result.meta?.postBalances?.[0] || 0) / 1e9;
        sol_change += (result.meta?.fee || 0) / 1e9;
        sol_change -= (result.meta?.preBalances?.[0] || 0) / 1e9;
        b[WSOL_MINT.toBase58()] = sol_change;

        return res.status(200).json({
            status: "ok",
            data: b,
        });
    }),
);

// Get blockchain context to help craft transactions :)
app.get(
    "/ctx",
    handleAsync(async (req, res) => {
        const [glb, reasonablePriorityFee] = await Promise.all([
            cache.blockhash.get(),
            cache.fee.get(),
        ]);
        return res.status(200).json({
            status: "ok",
            data: {
                blockhash: glb.blockhash,
                lastValidBlockHeight: glb.lastValidBlockHeight,
                reasonablePriorityFee,
            },
        });
    }),
);

// Get world ALT info
app.get(
    "/world-alt",
    handleAsync(async (_, res) => {
        const { alt, data } = await cache.worldAlt.get();
        return res.status(200).json({
            status: "ok",
            data: {
                key: alt.key.toBase58(),
                data: data.toString("base64"),
            },
        });
    }),
);

/*************************************
|  Routes for Rust `ivy-aggregator`  |
*************************************/

// Event Routes
app.get(
    "/events",
    handleAsync(async (req, res) => {
        const { after } = req.query;
        if (
            after !== undefined &&
            after !== null &&
            typeof after !== "string"
        ) {
            throw new Error(
                "Query param 'after' must be string, null, or undefined",
            );
        }

        const events = await getEvents(
            connection,
            after as string | undefined,
            EVENTS_MAX_CONCURRENT_REQUESTS,
            EVENTS_USE_BATCH,
        );

        return res.status(200).json({
            status: "ok",
            data: events,
        });
    }),
);

// Start server
app.listen(LISTEN_PORT, () => {
    console.log(`Server is running on port ${LISTEN_PORT}`);
});
