# Profiles

Profiles represent a user's state within the Ivy ecosystem, potentially aggregated across multiple games or specific to a single game. They contain information about the user's game token balances, owned items, and earned achievements.

Profiles are tied to a user's Solana wallet address.

## Endpoints

<small class="route-tag">GET</small> [`/api/profiles/{user}`](#list-user-profiles)
Retrieve all game profiles associated with a specific user wallet.

<small class="route-tag">GET</small> [`/api/profiles/{user}/game/{game}`](#retrieve-user-profile-for-a-game)
Retrieve a user's profile for a specific game.

## The Profile object (Aggregated)

Represents a summary of a user's holdings and achievements within a specific game. Returned as an array when listing all profiles for a user.

### Attributes

---
**game** `PublicKey`

The Solana address of the game this profile pertains to.

---
**balance** `integer`

The user's balance of the game's specific token (GAME), in the token's smallest unit.

---
**items** `array of objects`

A list of items held by the user in this game.

---
**items.item** `PublicKey`

The Solana address of the item definition.

---
**items.amount** `integer`

The quantity of this item held by the user.

---
**achievements** `array of PublicKeys`

A list of Solana addresses for the achievement definitions the user has earned in this game.

### Example Aggregated Profile object

```json
{
  "game": "GamePublicKey11111111111111111111111111111111",
  "balance": 50000000000, // e.g., 50 GAME tokens
  "items": [
    {
      "item": "ItemPublicKey11111111111111111111111111111111", // Dragon Sword
      "amount": 1
    },
    {
      "item": "ItemPublicKey22222222222222222222222222222222", // Rusty Sword
      "amount": 3
    }
  ],
  "achievements": [
    "AchPublicKey11111111111111111111111111111111", // First Victory
    "AchPublicKey22222222222222222222222222222222" // Dragon Slayer
  ]
}
```

## The Profile object (Single Game)

Same structure as the Aggregated Profile object, returned directly when retrieving a profile for a specific game.

## List user profiles

<small class="route-tag">GET</small> `/api/profiles/{user}`

Retrieves a list of all game-specific profiles associated with a given user's Solana wallet address. This data is fetched directly from the blockchain via the backend service.

### Parameters

---
**user** `PublicKey` *Required*

The Solana wallet address of the user to query.

### Returns

Returns a JSON response with a `data` property containing an array of [Aggregated Profile objects](#the-profile-object-aggregated), one for each game the user has interacted with.

### Example Request

```bash
curl https://ivypowered.com/api/profiles/UserWalletAddress...
```

### Example Response

```json
{
  "status": "ok",
  "data": [
    {
      "game": "GamePublicKey11111111111111111111111111111111",
      "balance": 50000000000,
      "items": [
        { "item": "ItemPublicKey111...", "amount": 1 },
        { "item": "ItemPublicKey222...", "amount": 3 }
      ],
      "achievements": ["AchPublicKey111...", "AchPublicKey222..."]
    },
    {
      "game": "GamePublicKey33333333333333333333333333333333",
      "balance": 1200000000,
      "items": [],
      "achievements": ["AchPublicKey333..."]
    }
    // ... potentially more profiles for other games
  ]
}
```

## Retrieve user profile for a game

<small class="route-tag">GET</small> `/api/profiles/{user}/game/{game}`

Retrieves a specific user's profile details (balance, items, achievements) for a single game. This data is fetched directly from the blockchain via the backend service.

### Parameters

---
**user** `PublicKey` *Required*

The Solana wallet address of the user to query.

---
**game** `PublicKey` *Required*

The Solana address of the specific game to query.

### Returns

Returns a [Single Game Profile object](#the-profile-object-single-game). Returns an error if the user or game is not found, or if the user has no profile for that specific game.

### Example Request

```bash
curl https://ivypowered.com/api/profiles/UserWalletAddress.../game/GamePublicKey11111111111111111111111111111111
```

### Example Response

```json
{
  "status": "ok",
  "data": {
    "game": "GamePublicKey11111111111111111111111111111111",
    "balance": 50000000000,
    "items": [
      {
        "item": "ItemPublicKey11111111111111111111111111111111",
        "amount": 1
      },
      {
        "item": "ItemPublicKey22222222222222222222222222222222",
        "amount": 3
      }
    ],
    "achievements": [
      "AchPublicKey11111111111111111111111111111111",
      "AchPublicKey22222222222222222222222222222222"
    ]
  }
}
```
