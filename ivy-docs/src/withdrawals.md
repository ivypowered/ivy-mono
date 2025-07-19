# Withdrawals

To issue game withdrawals in Ivy, you'll want to create a withdraw authority, an account authorized to issue withdrawals. Then, for each game withdraw, you'll generate a [unique ID](./identifiers.md). Next, you'll cryptographically sign a withdraw message with your withdraw authority, and give the signature to the user. The user will submit the signature to the blockchain, and receive tokens in return.

## Step 1: The Withdraw Authority

By default, your game has no withdraw authority, which means that there is no account that is authorized to issue withdrawals to users. To change this, first you'll want to create an ed25519 keypair for your reward authority. You can do this in several ways, and we'll provide a few here:

### Web Keygen Tool

The Ivy frontend provides [an online ed25519 key generation tool](https://ivypowered.com/keygen) which allows you to create public/private key pairs. All keys are generated client-side and do not leave your computer.

### Using JavaScript

You can generate an ed25519 keypair using the `tweetnacl` cryptographic library:

```js
const nacl = require("tweetnacl");
const bs58 = require("bs58");

const kp = nacl.sign.keyPair();
console.log("Public key", bs58.encode(kp.publicKey));
console.log("Private key", Buffer.from(kp.secretKey).toString("hex"));
```

Once you have a valid withdraw authority keypair, store your secret key in a safe location. Then, go to your game's page on Ivy. Connect the game owner's wallet, and press the edit button next to the game's symbol. Input the withdraw authority public key, press Save Changes, and confirm the transaction on-chain. You've just created and set an update authority for your game.

## Step 2: Signing a Withdraw Message

Once you've set your game's withdraw authority, you'll want to sign a withdraw message for each withdrawal request. This signature authorizes users to claim tokens from your game's treasury.

Technical details: Here, we're using the ed25519 withdraw authority private key to sign a 96-byte message, which is the concatenation of the 32-byte game address, the 32-byte user public key, and the 32-byte withdraw ID, in that order.

### Using the REST API

If you're using the REST API, you can sign a withdrawal like this:

<small class="route-tag">POST</small> `/api/games/{game}/withdrawals/{id}`

Request body should include:

```json
{
    "user": "user_public_key_in_base58",
    "withdraw_authority_key": "withdraw_authority_private_key_in_hex"
}
```

The API will return a signature in this format:

```json
{
    "status": "ok",
    "data": {
        "signature": "signature_in_hex"
    }
}
```

This endpoint is provided for testing, but it's not recommended to sign withdraw messages like this in production as this method involves sending your private key over the Internet.

### Using the JavaScript SDK

If you're using the JavaScript SDK, you can sign a withdrawal like this:

```js
import { Game } from "ivy-sdk";
import { PublicKey } from "@solana/web3.js";

// Define the game's public key
const gameAddress = new PublicKey(
    "GamePublicKey11111111111111111111111111111111",
);

// Define the user's public key (recipient of the withdraw)
const userAddress = new PublicKey(
    "UserPublicKey11111111111111111111111111111111",
);

// Define the withdraw ID (as a Uint8Array, generated as per Identifiers doc)
const withdrawId = Uint8Array.from(/* ... generated ID bytes ... */);

// Define the withdraw authority's private key (64 bytes in Uint8Array format)
const withdrawAuthorityKey =
    Uint8Array.from(/* ... private key in bytes ... */);

// Generate the signature
const signature = await Game.withdrawSign(
    gameAddress,
    withdrawId,
    userAddress,
    withdrawAuthorityKey,
);

console.log("Signature:", Buffer.from(signature).toString("hex"));
```

### In Other Languages

If you're using Go, you can sign a withdrawal like this:

```go
package main

import "crypto/ed25519"

// Sign a withdrawal message using ed25519
func SignWithdrawal(game [32]byte, user [32]byte, id [32]byte, privkey [64]byte) [64]byte {
	privateKey := ed25519.PrivateKey(privkey[:])

	// Create the message: game_address (32 bytes) + user_key (32 bytes) + withdraw_id (32 bytes)
	message := make([]byte, 0, 96)
	message = append(message, game[:]...)
	message = append(message, user[:]...)
	message = append(message, id[:]...)

	// Sign the message
	signature := ed25519.Sign(privateKey, message)
	var s [64]byte
	copy(s[:], signature[:])
	return s
}
```

## Step 3: Claiming the Withdrawal

To allow users to claim their funds, you'll provide them with:

1. The withdrawal ID (in hex format)
2. The signature you generated (in hex format)
3. The game's address (in base58)
4. The user's address (in base58)

Users can then claim their tokens by visiting:
`https://ivypowered.com/withdraw?game=[game_address]&id=[withdraw_id_in_hex]&signature=[signature_in_hex]&user=[user_address]`. They'll submit a transaction to the blockchain. The Ivy smart contract will verify the withdraw and disburse the funds from the game's treasury.

You can also add `&redirect=[any URL]` to the end of the withdraw URL to redirect the user upon successful withdrawal.

## Step 4: Verifying a Withdrawal

Technically, your job is done once you provide the user with the information in step 3. However, if you want to provide confirmation to the user or simply to track server-side that a withdraw has been claimed, you can check whether a withdraw has been claimed using either the REST API or the JS SDK.

### Using the REST API

To retrieve withdraw information, you can use the following route:

<small class="route-tag">GET</small> `/api/games/{game}/withdrawals/{id}`

Where:

- `{game}` is the game's public key in base58 format
- `{id}` is the withdraw ID in hex format

The API will return information about the withdraw:

```json
{
    "status": "ok",
    "data": {
        "signature": "5KtPn9DKKCdBWwY9GzP3X7vFxvZ9xubmGHwQ4FVp9UQapkx2VpnQMdieQNtHsGfxqiFPqJbHTqnVQ2owGvzaagLs",
        "timestamp": 1682547362,
        "withdraw_authority": "WithdrawAuthorityPublicKey11111111111111111"
    }
}
```

Where

- `signature`: The signature of the withdraw transaction on the blockchain (this is NOT the cryptographic signature created by your withdraw authority)
- `timestamp`: When the withdraw was processed (in Unix time)
- `withdraw_authority`: The public key of the authority that signed this withdraw

### Using the JavaScript SDK

Alternatively, you can retrieve withdrawal information directly from the Solana blockchain using the Ivy JS SDK.

```js
import { Game } from "ivy-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

// Initialize a connection to a Solana RPC endpoint
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Define the game's public key
const gameAddress = new PublicKey(
    "GamePublicKey11111111111111111111111111111111",
);

// Define the withdraw ID (as a Uint8Array)
const withdrawId = Uint8Array.from(/* ... withdraw ID in bytes ... */);

// Check whether the withdraw has been claimed
const isClaimed = await Game.isWithdrawClaimed(
    connection,
    gameAddress,
    withdrawId,
);

console.log("Withdraw claimed:", isClaimed);
```
