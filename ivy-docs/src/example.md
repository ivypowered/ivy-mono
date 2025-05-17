# Example

In this development example, we'll create a coin flip game called Flip495. The user is allowed to bet up to a maximum amount. They'll double their money with 49.5% probability, and lose all of it with 50.5% probability, giving the house a 1% edge.

We'll build this application using:

- Frontend: HTML, CSS, and JS with Bootstrap
- Backend: Node.js with Express
- Database: SQLite

The finished code for this game is [available on GitHub](https://github.com/ivypowered/flip495) and [published on Ivy](https://ivypowered.com/game?address=....).

## The Frontend

We'll create a basic frontend using HTML, CSS, and JavaScript. As our starting point, let's create a basic HTML interface with Bootstrap. Create a directory named `flip495`. Inside, create a file named `index.html`, and insert the following:

```html
<!doctype html>
<html lang="en" data-bs-theme="dark">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Flip495</title>
        <link
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css"
            rel="stylesheet"
        />
    </head>
    <body
        class="bg-dark d-flex justify-content-center align-items-center vh-100"
    >
        <div class="container" style="max-width: 600px">
            <div class="card border-secondary">
                <div class="card-header text-center border-secondary">
                    <h3 class="mt-2">Flip495</h3>
                </div>
                <div class="card-body">
                    <div class="text-center mb-3">
                        <h5>
                            Balance:
                            <span class="badge bg-primary"
                                ><span id="balance">100</span></span
                            >
                        </h5>
                    </div>
                    <label for="bet-amount" class="form-label"
                        >Bet Amount:</label
                    >
                    <div class="input-group mb-3">
                        <input
                            type="number"
                            class="form-control"
                            id="bet-amount"
                            value="1"
                            min="0"
                            step="1"
                        />
                        <button class="btn btn-outline-info" id="half-bet">
                            1/2
                        </button>
                        <button class="btn btn-outline-info" id="double-bet">
                            2X
                        </button>
                        <button class="btn btn-outline-info" id="max-bet">
                            MAX
                        </button>
                    </div>
                    <button id="flip-button" class="btn btn-primary w-100 mb-3">
                        Flip Coin
                    </button>
                    <p
                        id="result-message"
                        class="fw-bold text-center hidden"
                    ></p>

                    <div class="form-label">Transactions:</div>
                    <div class="row g-3">
                        <div class="col-sm-6">
                            <div class="input-group">
                                <input
                                    type="number"
                                    class="form-control"
                                    id="deposit-amount"
                                    placeholder="Amount"
                                    min="0"
                                    step="1"
                                />
                                <button
                                    class="btn btn-success"
                                    id="deposit-button"
                                >
                                    Deposit
                                </button>
                            </div>
                        </div>

                        <div class="col-sm-6">
                            <div class="input-group">
                                <input
                                    type="number"
                                    class="form-control"
                                    id="withdraw-amount"
                                    placeholder="Amount"
                                    min="0"
                                    step="1"
                                />
                                <button
                                    class="btn btn-warning"
                                    id="withdraw-button"
                                >
                                    Withdraw
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div
                    class="card-footer text-center text-muted border-secondary"
                >
                    <small
                        >Player Win Chance: 49.5% | Max Bet:
                        <span id="max-bet-display">50</span></small
                    >
                </div>
            </div>
        </div>
    </body>
</html>
```

This interface will be the starting point for our application. It contains fields that allow the user to bet, deposit, and withdraw the Flip495 game currency.

## The Server

We'll build our server using Node.js and the Express web server. In your `flip495` directory, run `npm init -y` to create a new Node.js project. Then, create a new file named `index.js`:

```js
const express = require("express");
const path = require("path");
const app = express();

const PORT = 5578;

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, (err) => {
    if (err) {
        console.error(`Error: Can't start server on port ${PORT}`);
        return;
    }
    console.log(`Server is running on port ${PORT}`);
    dbInit();
});
```

Run `npm install express` to install the Express library, then `node index.js`. Visit `http://127.0.0.1:5578` in your web browser, and you should see your rendered `index.html`.

## Database

To store balance information for our users, we'll use a Sqlite3 database. We'll handle balances in [raw integer format](./amounts.md) instead of floating-point form. In your development folder, run `npm install better-sqlite3`. Add the given imports at the top of your `index.js`:

```js
const Database = require("better-sqlite3");
const db = new Database("./main.db");
```

Then add the following before the Express setup:

```js
// Init our database
db.defaultSafeIntegers(); // use BigInt for raw amounts
db.exec(
    `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        balanceRaw INTEGER NOT NULL
    );`,
);

// Credit to a user, creating it
// if it doesn't exist
function dbUserCredit(id, amountRaw) {
    db.prepare(
        `INSERT INTO users (id, balanceRaw)
        VALUES (:id, :amountRaw)
        ON CONFLICT(id) DO UPDATE
        SET balanceRaw = balanceRaw + :amountRaw
        WHERE id = :id;`,
    ).run({ id, amountRaw });
}

// Debit from a user
function dbUserDebit(id, amountRaw) {
    db.prepare(
        `UPDATE users
        SET balanceRaw = balanceRaw - :amountRaw
        WHERE id = :id;`,
    ).run({ id, amountRaw });
}

// Grab the raw balance of a given user
function dbUserGetBalanceRaw(id) {
    const result = db
        .prepare(
            `SELECT balanceRaw
            FROM users
            WHERE id = :id`,
        )
        .get({ id });
    if (result) {
        return result.balanceRaw;
    }
    return 0n;
}
```

This gives us a simple SQL database to store our users, as well as some convenience functions to credit to a user, debit from a user, and get the user's current balance.

## Authentication

We'll use [Ivy's wallet-based authentication](./authentication.md) to authenticate users to our game backend. In your development folder, run `npm install ivy-sdk`. Then, add the following at the top of your `index.js` file:

```js
const { Game, Auth } = require("ivy-sdk");
const { PublicKey } = require("@solana/web3.js");
const GAME_ADDRESS = new PublicKey("[Flip495 game public key]");
```

We include `GAME_ADDRESS` because in order to properly validate authentication signatures we need to know which game we're validating them for.

## Balances

Let's add a route to allow users to check their balance:

```js
// Get user balance
app.post("/balance", (req, res) => {
    const { message, signature } = req.body;

    // Authenticate user
    const user = Auth.verifyMessage(
        GAME_ADDRESS,
        message,
        Buffer.from(signature, "hex"),
    );

    // User ID is their public key in Base58 format
    const userId = user.toBase58();

    // Get user balance from database
    const balanceRaw = dbUserGetBalanceRaw(userId);

    // Return the balance to the client
    res.status(200).json({
        status: "ok",
        data: balanceRaw.toString(), // Convert BigInt to string for JSON
    });
});
```

## Deposits

We want users to be able to deposit value to our game. Our high level flow for a deposit will be:

1. The user will make a request to the server to create a new deposit attached to their account
2. The user will complete the deposit on the blockchain
3. The user will call back to the server to complete their deposit

We'll start by importing deposit ID generation capabilities from `ivy-sdk`. Insert this at the top of the file:

```js
const { Id } = require("ivy-sdk");
```

Now, let's amend our database initialization code to include a new table for deposits:

```js
// Init our database
db.defaultSafeIntegers(); // use BigInt for raw amounts
db.exec(
    `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        balanceRaw INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deposits (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        completed INTEGER NOT NULL
    );`,
);
```

We'll also create some database functions for deposits:

```js
// Create a new deposit
function dbDepositCreate(id, userId) {
    db.prepare(
        `INSERT INTO deposits (id, userId, completed)
        VALUES (:id, :userId, 0)`,
    ).run({ id, userId });
}

// Get a deposit by ID
function dbDepositGet(id) {
    return db
        .prepare(
            `SELECT * FROM deposits
            WHERE id = :id`,
        )
        .get({ id });
}

// Mark a deposit as completed.
// Returns `true` if the deposit was marked complete by this call,
//         `false` if it was already marked complete
function dbDepositComplete(id) {
    const info = db
        .prepare(
            `UPDATE deposits
        SET completed = 1
        WHERE id = :id AND completed = 0`,
        )
        .run({ id });
    return info.changes > 0;
}
```

Finally, we'll create a `/deposit-create` route and a `/deposit-complete` route:

```js
// Create a new deposit
app.post("/deposit-create", (req, res) => {
    const { amountRaw, message, signature } = req.body;

    // Authenticate user
    const user = Auth.verifyMessage(
        GAME_ADDRESS,
        message,
        Buffer.from(signature, "hex"),
    );

    // User ID is their public key in Base58 format
    const userId = user.toBase58();

    // Generate a unique deposit ID
    const depositId = Id.generate(amountRaw);
    const depositIdHex = Buffer.from(depositId).toString("hex");

    // Store the deposit ID in the database
    dbDepositCreate(depositIdHex, userId);

    // Return the deposit ID and URL to the client
    res.status(200).json({
        status: "ok",
        data: {
            id: depositIdHex,
            url: `https://ivypowered.com/deposit?game=${GAME_ADDRESS.toBase58()}&id=${depositIdHex}&user=${userId}`,
        },
    });
});

// Complete a started deposit
app.post("/deposit-complete", async (req, res) => {
    const { id } = req.body;
    const deposit = dbDepositGet(id);

    if (!deposit) {
        // No such deposit
        throw new Error("Deposit not found");
    }

    if (deposit.completed) {
        // Already completed
        return res.status(200).json({
            status: "ok",
            data: true,
        });
    }

    // Check for completion
    const response = await fetch(
        `https://ivypowered.com/api/games/${GAME_ADDRESS.toBase58()}/deposits/${id}`,
    );
    const result = await response.json();
    if (result.status !== "ok" || !result.data || !result.data.signature) {
        // Deposit not complete yet
        return res.status(200).json({
            status: "ok",
            data: false,
        });
    }

    // Deposit is complete
    if (dbDepositComplete(id)) {
        // Deposit has not yet been marked as complete,
        // let's credit user with amount
        const amountRaw = Id.extractRawAmount(Buffer.from(deposit.id, "hex"));
        dbUserCredit(deposit.userId, BigInt(amountRaw));
    }

    return res.status(200).json({
        status: "ok",
        data: true,
    });
});
```

## Withdrawals

We want users to be able to withdraw value from our game. Our high level flow for a withdrawal will be:

1. The user will make a request to the server to create a new withdrawal
2. The backend will sign the withdrawal with its withdrawal authority
3. The user will complete the withdrawal on the blockchain

Create and update your game with a [withdraw authority](./withdrawals.md). Then, make a new file named `.env` in your development directory, and insert the following:

```
WITHDRAW_AUTHORITY_KEY=[Your withdraw authority key in hex]
```

To support `.env` files, run the command `npm install dotenv` in your development directory. Then, add the following to the top of your `index.js` file:

```js
// Initialize environment variables
require("dotenv").config();

// Get withdraw authority key
const WITHDRAW_AUTHORITY_KEY = Buffer.from(
    process.env.WITHDRAW_AUTHORITY_KEY,
    "hex",
);
```

Now, let's update our database initialization code to have a withdrawal table:

```js
// Init our database
db.defaultSafeIntegers(); // use BigInt for raw amounts
db.exec(
    `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        balanceRaw INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deposits (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        completed INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS withdrawals (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        signature TEXT NOT NULL
    )`,
);
```

Then, we'll add a function to create a new withdrawal:

```js
// Create a new withdrawal
function dbWithdrawCreate(id, userId, signature) {
    db.prepare(
        `INSERT INTO withdraws (id, userId, signature)
        VALUES (:id, :userId, :signature)`,
    ).run({ id, userId, signature });
}
```

Then, we'll add a withdrawal route:

```js
// Create a withdrawal
app.post("/withdraw", (req, res) => {
    const { amountRaw, message, signature } = req.body;

    // Authenticate user
    const user = Auth.verifyMessage(
        GAME_ADDRESS,
        message,
        Buffer.from(signature, "hex"),
    );

    // User ID is their public key in Base58 format
    const userId = user.toBase58();

    // Generate a unique withdrawal ID
    const withdrawId = Id.generate(amountRaw);
    const withdrawIdHex = Buffer.from(withdrawId).toString("hex");

    // Sign the withdrawal with our withdraw authority
    const withdrawSignature = Game.withdrawSign(
        /* gameAddress */ GAME_ADDRESS,
        /* id */ withdrawId,
        /* user */ user,
        /* withdrawAuthorityKey */ WITHDRAW_AUTHORITY_KEY,
    );
    const withdrawSignatureHex = Buffer.from(withdrawSignature).toString("hex");

    // Debit the user's balance
    dbUserDebit(userId, BigInt(amountRaw));

    // Store the withdrawal in the database
    dbWithdrawCreate(withdrawIdHex, userId, withdrawSignatureHex);

    // Return the withdrawal URL to the client
    res.status(200).json({
        status: "ok",
        data: `https://ivypowered.com/withdraw?game=${GAME_ADDRESS.toBase58()}&id=${withdrawIdHex}&signature=${withdrawSignatureHex}`,
    });
});
```

## Betting

Let's implement the coin flip functionality for Flip495.

First, add the following to the top of your `index.js` file:

```js
const crypto = require("node:crypto");
const MAX_BET_AMOUNT_RAW = 100_000_000_000_000n; // 100,000 tokens
```

The `crypto` library will enable us to generate cryptographically random values for our coin flip, and the `MAX_BET_AMOUNT_RAW` will govern how much users are allowed to bet.

Next, add the following to your `index.js` file before the `app.get()` call:

```js
// Middleware to parse JSON request bodies
app.use(express.json());
```

This will allow us to accept JSON-encoded requests in our app.

Now, let's create a new POST route called `/flip`. Add the following to your `index.js` file before the `app.listen()` call:

```js
// Coin flip route
app.post("/flip", (req, res) => {
    const { amountRaw: amountRawString, message, signature } = req.body;

    // Validate amount
    const amountRaw = BigInt(amountRawString);
    if (amountRaw > MAX_BET_AMOUNT_RAW || amountRaw === 0n) {
        throw new Error("Invalid bet amount");
    }

    // Authenticate user
    const user = Auth.verifyMessage(
        GAME_ADDRESS,
        message,
        Buffer.from(signature, "hex"),
    );

    // User ID is their public key in Base58 format
    const id = user.toBase58();

    // Debit bet amount
    dbUserDebit(id, amountRaw);

    // Generate number from range [0, 1000)
    const number = crypto.randomInt(1000);

    // Compute result of coin flip
    // - Full set: [0, 1000), exactly 1,000 numbers
    // - Required subset: [0, 495), exactly 495 numbers
    // - Probability of number being in subset: 495/1000 = 49.5%
    const win = number < 495;

    if (win) {
        // Credit twice the bet amount
        dbUserCredit(id, amountRaw * 2n);
    }

    // Return whether the user won
    res.status(200).json({
        status: "ok",
        data: win,
    });
});

// Handle errors and return them to the client
app.use((err, req, res, next) => {
    res.status(500).json({
        status: "err",
        msg: String(err),
    });
});
```

## Frontend Script

Let's add some JavaScript to our frontend to tie everything together. In your `index.html`, add the following before the closing `</body>` tag:

```js
<script type="text/javascript" src="./script.js"></script>
```

Then, in your `index.js`, add the following route to serve the script:

```js
app.get("/script.js", (req, res) => {
    res.sendFile(path.join(__dirname, "script.js"));
});
```

In your development directory, create a new file named `script.js` with the following content:

```js
// Constants
const RAW_CONVERSION_FACTOR = 1000000000;
const TOKEN_SYMBOL = "F495";

// Parent origin from URL
const parentOrigin = new URLSearchParams(location.search).get("parentOrigin");

// Simple state management
const state = {
    user: null,
    message: null,
    signature: null,
    balance: BigInt(0),
    betAmount: 1,
    maxBet: 100000,
    resultMessage: null,
    resultColor: "white",
    isLoading: false,
};

// Get DOM elements
const elements = {
    balance: document.getElementById("balance"),
    betAmount: document.getElementById("bet-amount"),
    halfBet: document.getElementById("half-bet"),
    doubleBet: document.getElementById("double-bet"),
    maxBet: document.getElementById("max-bet"),
    flipButton: document.getElementById("flip-button"),
    resultMessage: document.getElementById("result-message"),
    depositAmount: document.getElementById("deposit-amount"),
    depositButton: document.getElementById("deposit-button"),
    withdrawAmount: document.getElementById("withdraw-amount"),
    withdrawButton: document.getElementById("withdraw-button"),
};

// Update UI with current state
function render() {
    elements.balance.textContent = (
        Number(state.balance) / RAW_CONVERSION_FACTOR
    ).toLocaleString();
    elements.betAmount.value = state.betAmount;

    const isAuthenticated = state.user && state.signature;
    elements.depositButton.disabled = !isAuthenticated || state.isLoading;
    elements.withdrawButton.disabled = !isAuthenticated || state.isLoading;

    elements.resultMessage.textContent = state.resultMessage || "";
    elements.resultMessage.style.display = state.resultMessage
        ? "block"
        : "none";
    elements.resultMessage.style.color = state.resultColor;

    elements.flipButton.disabled = state.isLoading;
    if (state.isLoading) {
        elements.flipButton.textContent = "Processing...";
    } else if (!state.user) {
        elements.flipButton.textContent = "Connect Wallet";
    } else if (!state.signature) {
        elements.flipButton.textContent = "Log In";
    } else {
        elements.flipButton.textContent = "Flip Coin";
    }
}

// Auth functions
function connectWallet() {
    if (parentOrigin)
        parent.postMessage({ action: "connect_wallet" }, parentOrigin);
}

function signMessage() {
    if (parentOrigin)
        parent.postMessage({ action: "sign_message" }, parentOrigin);
}

// Basic API request helper
async function apiRequest(endpoint, data = {}) {
    if (!state.user || !state.message || !state.signature) {
        throw new Error("Authentication required");
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...data,
            user: state.user,
            message: state.message,
            signature: state.signature,
        }),
    });

    const result = await response.json();
    if (result.status === "err") {
        throw new Error(result.msg || "API request failed");
    }
    return result.data;
}

// Get user balance
async function fetchBalance() {
    state.isLoading = true;
    render();
    try {
        const balanceRaw = await apiRequest("/balance");
        state.balance = BigInt(balanceRaw);
    } catch (error) {
        state.resultMessage = `Error fetching balance: ${error.message}`;
        state.resultColor = "white";
    } finally {
        state.isLoading = false;
        render();
    }
}

// Main flip coin function
async function flipCoin() {
    const betAmount = parseInt(elements.betAmount.value, 10);
    if (isNaN(betAmount) || betAmount <= 0 || betAmount > state.maxBet) {
        state.resultMessage = `Invalid bet. Must be 1 to ${state.maxBet} ${TOKEN_SYMBOL}.`;
        state.resultColor = "white";
        render();
        return;
    }

    const betAmountRaw = BigInt(betAmount) * BigInt(RAW_CONVERSION_FACTOR);
    if (betAmountRaw > state.balance) {
        state.resultMessage = "Insufficient balance.";
        state.resultColor = "white";
        render();
        return;
    }

    state.isLoading = true;
    state.resultMessage = "Flipping coin...";
    state.resultColor = "white";
    render();

    try {
        const win = await apiRequest("/flip", {
            amountRaw: String(betAmountRaw),
        });
        state.resultMessage = `You ${win ? "won" : "lost"} ${betAmount} ${TOKEN_SYMBOL}.`;
        state.resultColor = win ? "green" : "red";
        await fetchBalance();
    } catch (error) {
        state.resultMessage = `Flip error: ${error.message}`;
        state.resultColor = "white";
        state.isLoading = false;
        render();
    }
}

// Deposit function
async function initiateDeposit() {
    const amount = parseInt(elements.depositAmount.value, 10);
    if (isNaN(amount) || amount <= 0) {
        state.resultMessage = "Invalid deposit amount.";
        state.resultColor = "white";
        render();
        return;
    }

    state.isLoading = true;
    state.resultMessage = "Initiating deposit...";
    state.resultColor = "blue";
    render();

    try {
        const amountRaw = String(amount * RAW_CONVERSION_FACTOR);
        const { id, url } = await apiRequest("/deposit-create", { amountRaw });
        window.open(url, "_blank");
        state.resultMessage =
            "Deposit initiated. Please complete in the new window.";
        state.resultColor = "lightblue";
        while (true) {
            // Periodically poll to complete deposit
            const finished = await apiRequest("/deposit-complete", { id });
            if (finished) {
                break;
            }
        }
        await fetchBalance();
    } catch (error) {
        state.resultMessage = `Deposit error: ${error.message}`;
        state.resultColor = "white";
    } finally {
        state.isLoading = false;
        render();
    }
}

// Withdraw function
async function initiateWithdrawal() {
    const amount = parseInt(elements.withdrawAmount.value, 10);
    if (isNaN(amount) || amount <= 0) {
        state.resultMessage = "Invalid withdrawal amount.";
        state.resultColor = "white";
        render();
        return;
    }

    const amountRaw = BigInt(amount) * BigInt(RAW_CONVERSION_FACTOR);
    if (amountRaw > state.balance) {
        state.resultMessage = "Insufficient balance for withdrawal.";
        state.resultColor = "white";
        render();
        return;
    }

    state.isLoading = true;
    state.resultMessage = "Processing withdrawal...";
    state.resultColor = "orange";
    render();

    try {
        const withdrawUrl = await apiRequest("/withdraw", {
            amountRaw: String(amountRaw),
        });
        window.open(withdrawUrl, "_blank");
        state.resultMessage =
            "Withdrawal initiated. Please complete in the new window.";
        state.resultColor = "orange";
        await fetchBalance();
    } catch (error) {
        state.resultMessage = `Withdrawal error: ${error.message}`;
        state.resultColor = "white";
    } finally {
        state.isLoading = false;
        render();
    }
}

// Message listener for parent frame
window.addEventListener("message", (event) => {
    if (!parentOrigin || event.origin !== parentOrigin) return;

    const ivyState = event.data;
    state.user = ivyState.user;
    state.message = ivyState.message;
    state.signature = ivyState.signature;

    if (state.user && state.signature) {
        fetchBalance();
    }
    render();
});

// Setup event listeners
elements.halfBet.addEventListener("click", () => {
    state.betAmount = Math.max(1, Math.floor(state.betAmount / 2));
    render();
});

elements.doubleBet.addEventListener("click", () => {
    state.betAmount = Math.min(state.maxBet, state.betAmount * 2);
    render();
});

elements.maxBet.addEventListener("click", () => {
    state.betAmount = state.maxBet;
    render();
});

elements.betAmount.addEventListener("change", () => {
    const value = parseInt(elements.betAmount.value, 10);
    state.betAmount = isNaN(value)
        ? 1
        : Math.min(Math.max(1, value), state.maxBet);
    render();
});

elements.flipButton.addEventListener("click", () => {
    if (!state.user) {
        connectWallet();
    } else if (!state.signature) {
        signMessage();
    } else {
        flipCoin();
    }
});

elements.depositButton.addEventListener("click", initiateDeposit);
elements.withdrawButton.addEventListener("click", initiateWithdrawal);

// Subscribe to state updates
parent.postMessage({ action: "subscribe" }, parentOrigin);

render();
```

## Publishing

We're done! All the components of our game are finished. Now, we'll want to publish it on the web so that we have a link to put on Ivy. To do this, you have some options.

- If you have a machine that's available on the Internet, you can run the Node.js server in the background and point a reverse proxy such as [Nginx](https://nginx.org) to it to make it available. You can use your own domain, or get a subdomain at places like [FreeDNS](https://freedns.afraid.org). To support HTTPS, you can put your server behind [Cloudflare](https://cloudflare.com) or get a certificate from [Let's Encrypt](https://letsencrypt.org/).
- If you don't want to use your own machine, you can use hosting platforms like [Vercel](https://vercel.com/) or [Glitch](https://glitch.com/) to serve the game.
