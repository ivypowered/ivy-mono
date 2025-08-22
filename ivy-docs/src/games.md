# Games

Games are the central organizing resource in Ivy.

## Using the REST API

The REST API provides endpoints to retrieve game information and receipt details.

### Endpoints

<small class="route-tag">GET</small> `/api/games/{address}`
Retrieve a specific game by its address.

<small class="route-tag">GET</small> `/api/games/{game}/burn/{id}`
Get burn receipt information for a specific game.

<small class="route-tag">GET</small> `/api/games/{game}/deposit/{id}`
Get deposit receipt information for a specific game.

<small class="route-tag">GET</small> `/api/games/{game}/withdraw/{id}`
Get withdraw receipt information for a specific game.

### The Game object

---

**name** `string`

The display name of the game.

---

**symbol** `string`

The token symbol for the game's currency.

---

**description** `string`

A full description of the game.

---

**address** `PublicKey`

Unique identifier (Solana address) for the game object.

---

**mint** `PublicKey`

Address of the game's token mint.

---

**swap_alt** `PublicKey`

Address of the Address Lookup Table (ALT) used for swaps within this game's AMM.

---

**owner** `PublicKey`

Address of the game's owner account.

---

**withdraw_authority** `PublicKey`

Address authorized to withdraw from the game's treasury.

---

**game_url** `string`

URL link to the game's official website or playable location.

---

**icon_url** `string`

URL of the game's icon/logo image.

---

**metadata_url** `string`

URL pointing to the game's extended metadata (e.g., an IPFS JSON file).

---

**create_timestamp** `integer`

Time at which the game object was created (Unix timestamp in seconds).

---

**ivy_balance** `string`

Current RAW balance of IVY tokens held in the game's bonding curve (serialized as string). This amount equals the game's IVY market cap.

---

**game_balance** `string`

Current RAW balance of the game's token in the game's bonding curve (serialized as string).

---

**starting_ivy_balance** `string`

The initial amount of IVY tokens deposited into the AMM pool when the game was created (serialized as string). The total amount of IVY deposited into the game's curve is equal to `ivy_balance - starting_ivy_balance`.

---

**last_price_usd** `number`

The last traded price of the game token in USD.

---

**mkt_cap_usd** `number`

The current market capitalization of the game in USD.

---

**change_pct_24h** `number`

The percentage change in price over the last 24 hours.

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
        "description": "A retro 2D battle arena where players compete for glory.",
        "address": "GamePublicKey11111111111111111111111111111111",
        "mint": "MintPublicKey11111111111111111111111111111111",
        "swap_alt": "SwapAltPublicKey11111111111111111111111111111",
        "owner": "OwnerPublicKey11111111111111111111111111111111",
        "withdraw_authority": "WithdrawAuthKey11111111111111111111111111111",
        "game_url": "https://pixelwarriors.example.com",
        "icon_url": "https://ipfs.io/ipfs/bafybeihicon1...",
        "metadata_url": "https://ipfs.io/ipfs/bafkreihmetadata1...",
        "create_timestamp": 1678942624,
        "ivy_balance": "150000000000",
        "game_balance": "7500000000000",
        "starting_ivy_balance": "100000000000",
        "last_price_usd": 0.0042,
        "mkt_cap_usd": 42000.5,
        "change_pct_24h": 15.3
    }
}
```

### Receipt Endpoints

The API also provides endpoints to query receipt information for burns, deposits, and withdrawals:

#### Burn Receipt Example

```bash
curl https://ivypowered.com/api/games/GamePublicKey11111111111111111111111111111111/burn/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

#### Deposit Receipt Example

```bash
curl https://ivypowered.com/api/games/GamePublicKey11111111111111111111111111111111/deposit/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

#### Withdraw Receipt Example

```bash
curl https://ivypowered.com/api/games/GamePublicKey11111111111111111111111111111111/withdraw/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

Note: The receipt ID must be a 32-byte value provided as a 64-character hexadecimal string.

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
