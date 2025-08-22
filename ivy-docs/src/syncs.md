# Syncs

Syncs are synthetic tokens on Ivy that mirror and track external tokens from various platforms, allowing users to gain exposure to popular assets while participating in the Ivy ecosystem.

## How Syncs Work

Syncs create a parallel token that tracks an external token from supported platforms. The Sync token maintains price correlation with its underlying token while providing additional utility within the Ivy ecosystem.

All Sync trades incur a 0.75% protocol fee that supports the Ivy ecosystem. This fee is automatically deducted during swaps and helps maintain the infrastructure for cross-platform token tracking.

To identify a synced token, look for the pyramid icon next to the symbol on the token's page.

## Using the REST API

The REST API provides endpoints to retrieve sync information and trading data.

### Endpoints

<small class="route-tag">GET</small> `/api/syncs/{address}`
Retrieve a specific sync by its address.

### The Sync object

---

**name** `string`

The display name of the sync token.

---

**symbol** `string`

The token symbol for the sync.

---

**description** `string`

A description of the sync token.

---

**address** `PublicKey`

Unique identifier (Solana address) for the sync object.

---

**external_mint** `PublicKey`

Address of the underlying external token mint being tracked.

---

**create_timestamp** `integer`

Time at which the sync was created (Unix timestamp in seconds).

---

**metadata_url** `string`

URL pointing to the sync's metadata (e.g., an IPFS JSON file).

---

**icon_url** `string`

URL of the sync's icon/logo image.

---

**game_url** `string`

URL of the sync's game.

---

**is_migrated** `boolean`

Whether the sync has transitioned to a different liquidity mechanism.

---

**pswap_pool** `PublicKey | null`

Address of the AMM pool (when applicable).

---

**last_price_usd** `number`

The last traded price of the sync token in USD.

---

**mkt_cap_usd** `number`

The current market capitalization of the sync in USD.

---

**change_pct_24h** `number`

The percentage change in price over the last 24 hours.

---

**sol_reserves** `integer`

Current SOL reserves in the sync's liquidity mechanism.

---

**token_reserves** `integer`

Current token reserves in the sync's liquidity mechanism.

### Example Request

```bash
curl https://ivypowered.com/api/syncs/SyncPublicKey11111111111111111111111111111111
```
