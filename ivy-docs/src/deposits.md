# Deposits

To accept game deposits in your currency, you'll first create a [unique ID](./identifiers.md) for your deposit.

## Collecting Your Deposit

Once you have a valid deposit ID, simply point your user to the link `https://ivypowered.com/deposit?game=[your game address]&id=[your deposit ID in hex]`. This page will prompt the user to complete the deposit on the Solana blockchain.

You can also append `&redirect=[redirect URL]` to the given link to redirect the user to an arbitrary URL when they finish paying.

Next, on your backend, you'll want to check whether the deposit is complete. If you're using the REST API, this can be done via the following route:

<small class="route-tag">GET</small> `/api/games/{address}/deposits/{id}`
Retrieve a deposit by its ID and associated game address.

The API will return deposit information if the deposit exists in this format:

```json
{
    "status": "ok",
    "data": {
        "signature": "transaction_signature_here",
        "timestamp": 1234567890
    }
}
```

Where `signature` is the Solana transaction signature and `timestamp` is a Unix timestamp representing when the deposit was processed.

If you're using the JavaScript SDK, you can check the deposit status like this:

```js
import { Game } from "ivy-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

// Initialize a connection to a Solana RPC endpoint
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Define the game's public key
const gameAddress = new PublicKey(
    "GamePublicKey11111111111111111111111111111111",
);

// Define the deposit ID (as a Uint8Array, generated as per Identifiers doc)
const depositId = Uint8Array.from(/* ... generated ID bytes ... */);

// Check whether the deposit is complete
const isComplete = await Game.isDepositComplete(
    connection,
    gameAddress,
    depositId,
);
```
