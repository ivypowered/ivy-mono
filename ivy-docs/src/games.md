# Games

Games are the central organizing resource in Ivy.

## Using the REST API

The REST API provides an endpoint to retrieve a game's information by its address.

<small class="route-tag">GET</small> `/api/games/{address}`
Retrieve a specific game by its address.

### The Game object

---

**name** `string`

The display name of the game.

---

**symbol** `string`

The token symbol for the game's currency.

---

**short_desc** `string`

A brief description of the game.

---

**address** `PublicKey`

Unique identifier (Solana address) for the game object.

---

**swap_alt** `PublicKey`

Address of the Address Lookup Table (ALT) used for swaps within this game's AMM.

---

**game_url** `string`

URL link to the game's official website or playable location.

---

**cover_url** `string`

URL of the game's cover image.

---

**metadata_url** `string`

URL pointing to the game's extended metadata (e.g., an IPFS JSON file).

---

**create_timestamp** `integer`

Time at which the game object was created (Unix timestamp in seconds).

---

**ivy_balance** `integer`

Current RAW balance of IVY tokens held in the game's bonding curve. This amount equals the game's IVY market cap.

---

**game_balance** `integer`

Current RAW balance of the game's token in the game's bonding curve.

---

**starting_ivy_balance** `integer`

The initial amount of IVY tokens deposited into the AMM pool when the game was created (smallest unit). The total amount of IVY deposited into the game's curve is equal to `ivy_balance - starting_ivy_balance`.

### Example Request

```bash
curl https://ivypowered.com/api/games/GamePublicKey11111111111111111111111111111111
```

### Example Response

```json
{
    "status": "ok",
    "data": {
        "name": "Pixel Warriors",
        "symbol": "PIXEL",
        "short_desc": "A retro 2D battle arena.",
        "address": "GamePublicKey11111111111111111111111111111111",
        "swap_alt": "SwapAltPublicKey11111111111111111111111111111",
        "game_url": "https://pixelwarriors.example.com",
        "cover_url": "https://ipfs.io/ipfs/bafybeihcover1...",
        "metadata_url": "https://ipfs.io/ipfs/bafkreihmetadata1...",
        "create_timestamp": 1678942624,
        "ivy_balance": 150000000000,
        "game_balance": 7500000000000,
        "starting_ivy_balance": 100000000000,
        "normalized_name": "pixelwarriors"
    }
}
```

## Using the JavaScript API

If you're using the JavaScript SDK, you can retrieve game information directly from the Solana blockchain.

### Loading Game State

To retrieve a game's on-chain state, use the `Game.loadState()` method:

```js
import { Game } from "ivy-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

// Initialize a connection to a Solana RPC endpoint
const connection = new Connection("https://api.mainnet-beta.solana.com");

// Define the game's public key
const gameAddress = new PublicKey(
    "GamePublicKey11111111111111111111111111111111",
);

// Load the game state
const gameState = await Game.loadState(connection, gameAddress);
```

The returned `GameState` object contains the following properties:

```js
{
  seed: Uint8Array,           // Internal seed used to derive the game address
  owner: PublicKey,           // Address of the game owner
  reward_authority: PublicKey, // Address authorized to sign rewards
  game_url: string,           // URL to the game
  cover_url: string,          // URL to the game's cover image
  short_desc: string,         // Brief description of the game
  mint: PublicKey,            // Address of the game's token mint
  ivy_wallet: PublicKey,      // Address holding the game's IVY tokens
  curve_wallet: PublicKey,    // Address for the bonding curve
  treasury_wallet: PublicKey, // Address of the game's treasury
  ivy_balance: string,        // Amount of IVY in the curve (as string)
  game_balance: string        // Amount of game tokens in the curve (as string)
}
```

### Loading Basic Metadata

To get the game's on-chain metadata (name, symbol, etc.), use the `Game.loadChainMetadata()` method:

```js
import { Game } from "ivy-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const gameAddress = new PublicKey(
    "GamePublicKey11111111111111111111111111111111",
);

const metadata = await Game.loadChainMetadata(connection, gameAddress);
```

The returned `ChainMetadata` object includes:

```js
{
  name: string,      // Name of the game
  symbol: string,    // Token symbol
  uri: string,       // Metadata URI
}
```

### Loading Complete Metadata

The game's on-chain metadata contains a Metadata URI that points to more complete metadata, including the game's icon and full description. You can fetch this extended metadata using the `fetchWebMetadata()` function:

```js
import { Game, fetchWebMetadata } from "ivy-sdk";
import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const gameAddress = new PublicKey(
    "GamePublicKey11111111111111111111111111111111",
);

// First load the chain metadata to get the URI
const chainMetadata = await Game.loadChainMetadata(connection, gameAddress);

// Then fetch the web metadata from the URI
const webMetadata = await fetchWebMetadata(chainMetadata.uri);
```

The returned `WebMetadata` object contains additional game details:

```js
{
  name: string,         // Name (same as on-chain)
  symbol: string,       // Token symbol (same as on-chain)
  image: string,        // URL to the game's icon
  description: string  // Full description of the game
}
```
