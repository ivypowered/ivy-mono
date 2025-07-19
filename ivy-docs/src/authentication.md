# Authentication

If your game needs to remember user-specific information like balances, inventory, or other persistent state, you'll want to have an authentication mechanism to uniquely identify your users. You're free to implement traditional methods like username/password authentication. However, some users might find it more convenient to sign in using their wallet's public key. This guide details how to integrate Ivy's wallet-based authentication into your game.

## Design

In Ivy's wallet authentication, the user creates an ed25519 signature of a specific message with their private key. Your game backend is then responsible for verifying this signature. The message has the following structure:

```md
Authenticate user [user public key] to game [game public key] on ivypowered.com, valid from [start unix timestamp] to [end unix timestamp]
```

In the current frontend, the start timestamp of the validity period is set to 60 seconds before the user's current time, and the end timestamp is set to 24 hours after the user's current time, though these parameters may be subject to change in future. Your game should reject the authentication signature if the current timestamp is not within the interval of validity.

## Obtaining the Signature

Your game, which runs inside an `<iframe>`, communicates with the Ivy frontend using the web [postMessage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).

Here's how to get started:

### 1. Retrieve Parent Origin

The `postMessage` API allows any window to send any message to any other window. To filter for messages sent by Ivy, we'll retrieve the Ivy website's origin, which is passed to our `<iframe>` through the `parentOrigin` query parameter. Insert this somewhere in your game's client-side JavaScript:

```js
const parentOrigin = new URLSearchParams(document.location.search).get(
    "parentOrigin",
);
```

### 2. Subscribe to State Updates

Next, you'll want to subscribe to the Ivy state from within your game's client-side JavaScript:

```js
parent.postMessage({ action: "subscribe" }, parentOrigin);
```

After subscribing, the Ivy frontend will immediately send a message containing the current state to your `<iframe>`, and will send a new message with the updated state whenever the authentication state changes.

### 3. Listen for State Updates

Next, in your game's client-side JavaScript, you'll want to create an event listener to capture state updates from the Ivy frontend:

```js
window.addEventListener("message", function (event) {
    // Ensure origin is the parent document
    if (event.origin !== parentOrigin) return;

    // Log current Ivy state
    console.log("Received Ivy state", event.data);
});
```

The `event.data` will be an object describing the current authentication status. It has the following structure:

```tsx
interface State {
    user: string | null; // The user's base58 encoded 32-byte public key
    message: string | null; // The authentication message for this game
    signature: string | null; // The hex-encoded 64-byte signature for the authentication message
}
```

You'll receive:

- `{ user: null, signature: null }`, when the user has loaded the page but has not connected their wallet, you'll receive `.
- `{ user: "(base58 public key)", message: null, signature: null }`, when the user has connected their wallet but not signed an authentication signature for your game
- `{ user: "(base58 public key)", message: "(auth message string)", signature: "(hex signature)" }`, when the user has connected their wallet and signed an authentication message for your game

The authentication message and signature for your game are persisted in local storage, so users won't have to sign in twice within a 24-hour period if they're using the same device.

If an authentication message or signature expire on the frontend, they'll be automatically cleared, and `message` and `signature` will be set to `null` so that your application can request the user to sign a new message.

If you ever want to allow the user to "log out", or clear the authentication message and signature from local storage, you can do so with:

```js
parent.postMessage({ action: "logout" }, parentOrigin);
```

This will have no effect if the user is not logged in to your game already.

### 4. Prompt User if Necessary

If `user` is null, you'll want to show the "Connect Wallet" dialog. To do this, write:

```js
parent.postMessage({ action: "connect_wallet" }, parentOrigin);
```

This will have no effect if the user has already connected their wallet.

If `user` is a public key but `msg` and `signature` are null, you'll want to show the "Sign Message" dialog. To do this, write:

```js
parent.postMessage({ action: "sign_message" }, parentOrigin);
```

The user will be prompted to sign the game authentication message. This will have no effect if the user has not connected a wallet yet.

If you ever need to force a reload of the wallet balance shown to the user on the Ivy frontend, you can do so with:

```js
parent.postMessage({ action: "reload_balance" }, parentOrigin);
```

## Verifying the User

Once you've obtained the user's signature for the authentication message, you can treat the `(message, signature)` pair as an authentication token, and append them to all requests to your game's backend. On the backend, you'll want to verify this data before performing sensitive operations. You can do this in several ways:

### Using the REST API

The REST API contains an endpoint to verify authentication details:

<small class="route-tag">POST</small> `/api/games/{game}/authenticate` Verify that the given `message` is valid for the game `game`, correctly signed with `signature`, and is valid at the current timestamp.

With the request body:

```json
{
    "message": "(User authentication message as a string)",
    "signature": "(The base58-encoded signature)"
}
```

Where:

- `game`: The base58-encoded public key of your game
- `message`: The authentication message that was signed
- `signature`: The base58-encoded signature of the message

Example response:

```json
{
    "status": "ok",
    "data": "2eo1opvtmFoTaTpuSNF32rcEAztkVykLiCw1yzpj1CVx"
}
```

The `data` field contains the base58-encoded public key of the authenticated user. If the signature is invalid, the server will return an error:

```json
{
    "status": "err",
    "data": "Unauthorized: Invalid message format"
}
```

### Using the JS SDK

The JS SDK provides a function to verify a message with a given signature:

```js
import { Auth } from "ivy-sdk";

// Example parameters
const game = new PublicKey("8EE4ggc5MMrXW3HyFVHErMMaGPjwEtnHcZ7Xb84ASXPw");
const msg =
    "Authenticate user 2eo1opvtmFoTaTpuSNF32rcEAztkVykLiCw1yzpj1CVx to game 8EE4ggc5MMrXW3HyFVHErMMaGPjwEtnHcZ7Xb84ASXPw on ivypowered.com, valid from 1746776050 to 1746862522";
const signature = Buffer.from(
    "2de54326317fcd1ab769752aa234cd6854c46577d2afb2539abea078e36bbb65bb1c4c767f0f051335066fb84e2d46e2526ddbf0eb6c95a4ae4fb26927a14305",
    "hex",
);

// Verify message, and extract user that signed it
const user = Auth.verifyMessage(game, msg, signature);
```

### In Python

If your backend's in Python, you can use the following implementation:

```python
import re
import time
import base58
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError

def verify_message(game_address: str, message: str, signature: str) -> str:
    """
    Verify an authentication message and return the authenticated user.

    Args:
        game_address: The base58-encoded game public key
        message: The authentication message
        signature: The hex-encoded signature (64 bytes represented as 128 hex characters)

    Returns:
        The base58-encoded user public key

    Raises:
        ValueError: If the message is invalid or signature verification fails
    """
    # Check message length
    if len(message) > 256:
        raise ValueError("Unauthorized: Message too long")

    # Parse the message
    pattern = r"^Authenticate user ([1-9A-Za-z]+) to game ([1-9A-Za-z]+) on ivypowered\.com, valid from ([0-9]+) to ([0-9]+)$"
    match = re.match(pattern, message)
    if not match:
        raise ValueError("Unauthorized: Incorrect message format")

    user_b58, game_provided_b58, start_str, end_str = match.groups()

    # Verify game address
    if game_provided_b58 != game_address:
        raise ValueError(f"Unauthorized: Expected message to have game {game_address}, but got {game_provided_b58}")

    # Verify timestamps
    start = int(start_str)
    end = int(end_str)
    current_time = int(time.time())
    if current_time < start or current_time > end:
        raise ValueError(f"Unauthorized: Message is only valid within the interval [{start}, {end}], but the current time is {current_time}")

    try:
        # Convert hex signature to bytes
        try:
            signature_bytes = bytes.fromhex(signature)
        except ValueError:
            raise ValueError("Unauthorized: Invalid hex-encoded signature")

        # Decode base58 user public key
        user_pubkey_bytes = base58.b58decode(user_b58)

        # Create verify key from user's public key
        verify_key = VerifyKey(user_pubkey_bytes)

        # Verify the signature
        verify_key.verify(message.encode(), signature_bytes)

        # Return the authenticated user
        return user_b58
    except BadSignatureError:
        raise ValueError("Unauthorized: Message signature is invalid")
    except Exception as e:
        raise ValueError(f"Unauthorized: {str(e)}")
```

### In Rust

If you're using Rust, you can use the following implementation:

```rust
use std::time::{SystemTime, UNIX_EPOCH};
use std::fmt;
use std::error::Error;
use base58::{FromBase58, ToBase58};
use ed25519_dalek::{PublicKey, Signature, Verifier};
use regex::Regex;

// Simple error type
#[derive(Debug)]
pub enum AuthError {
    Unauthorized(String),
    Internal(String),
}

impl fmt::Display for AuthError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AuthError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            AuthError::Internal(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl Error for AuthError {}

pub fn verify_message(
    game_address: &str,
    message: &str,
    signature: &str,
) -> Result<String, AuthError> {
    // Check message length
    if message.len() > 256 {
        return Err(AuthError::Unauthorized("Message too long".to_string()));
    }

    // Parse the message using regex
    let re = Regex::new(r"^Authenticate user ([1-9A-Za-z]+) to game ([1-9A-Za-z]+) on ivypowered\.com, valid from ([0-9]+) to ([0-9]+)$")
        .map_err(|e| AuthError::Internal(format!("Regex error: {}", e)))?;

    let captures = re.captures(message)
        .ok_or_else(|| AuthError::Unauthorized("Incorrect message format".to_string()))?;

    let user_b58 = captures.get(1).unwrap().as_str();
    let game_provided_b58 = captures.get(2).unwrap().as_str();
    let start_str = captures.get(3).unwrap().as_str();
    let end_str = captures.get(4).unwrap().as_str();

    // Verify game address
    if game_provided_b58 != game_address {
        return Err(AuthError::Unauthorized(
            format!("Expected message to have game {}, but got {}", game_address, game_provided_b58)
        ));
    }

    // Verify timestamps
    let start = start_str.parse::<u64>()
        .map_err(|_| AuthError::Unauthorized("Message start time is not a natural number".to_string()))?;

    let end = end_str.parse::<u64>()
        .map_err(|_| AuthError::Unauthorized("Message end time is not a natural number".to_string()))?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| AuthError::Internal(format!("System time error: {}", e)))?
        .as_secs();

    if now < start || now > end {
        return Err(AuthError::Unauthorized(
            format!("Message is only valid within the interval [{}, {}], but the current time is {}",
                start, end, now)
        ));
    }

    // Convert hex signature to bytes
    let signature_bytes = hex::decode(signature)
        .map_err(|_| AuthError::Unauthorized("Invalid hex-encoded signature".to_string()))?;

    if signature_bytes.len() != 64 {
        return Err(AuthError::Unauthorized("Signature must be 64 bytes".to_string()));
    }

    // Decode base58 user public key
    let user_pubkey_bytes = user_b58.from_base58()
        .map_err(|_| AuthError::Unauthorized("Invalid base58-encoded public key".to_string()))?;

    // Verify signature
    let dalek_public_key = PublicKey::from_bytes(&user_pubkey_bytes)
        .map_err(|_| AuthError::Unauthorized("Invalid public key format".to_string()))?;

    let dalek_signature = Signature::from_bytes(&signature_bytes)
        .map_err(|_| AuthError::Unauthorized("Invalid signature format".to_string()))?;

    dalek_public_key.verify(message.as_bytes(), &dalek_signature)
        .map_err(|_| AuthError::Unauthorized("Message signature is invalid".to_string()))?;

    // Return the authenticated user
    Ok(user_b58.to_string())
}
```
