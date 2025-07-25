# Identifiers

When accepting deposits or issuing withdrawals with Ivy, you'll create an ID to uniquely identify each deposit or withdraw. This ID allows for deposits and withdrawals to be easily referenced, and also enforces idempotence, preventing users from accidentally paying you twice or collecting your withdrawals more than once.

Each ID is 32 bytes and both uniquely identifies each deposit or withdraw and carries the amount information. The ID should consist of 24 random bytes followed by the raw amount encoded as a little-endian 64-bit integer, for a total of 32 bytes. The final ID should be encoded as a hexadecimal string when used in API calls.

It's very important that the 24 random bytes generated are cryptographically random. If not, a duplicate ID could be generated, which could lead to the being incorrectly marked as complete even though the user hasn't paid yet.

## Using the REST API

The REST API provides a route to generate a random ID given a raw amount:

<small class="route-tag">POST</small> `/api/id?amountRaw={amountRaw}` Get a cryptographically random 32-byte unique identifier for deposits and withdrawals given a raw amount.

## Using the JS SDK

The JS SDK provides a function to generate an ID:

```ts
import { generateId } from "ivy-sdk";

const amountRaw: string = "10000000000"; // 10 units
const id: Uint8Array = generateId(amountRaw);
```

## Other Languages

In Python, you can generate an ID like this:

```py
import os
import struct
import binascii

# Your amount in raw
amount_raw = 10_000_000_000 # 10 units

# Generate 24 random bytes
random_bytes = os.urandom(24)

# Convert the amount to a little-endian 64-bit integer
amount_bytes = struct.pack("<Q", amount_raw)

# Combine to create the 32-byte ID
id = random_bytes + amount_bytes

# Convert to hexadecimal string for API usage
id_hex = binascii.hexlify(id).decode('utf-8')
```

In Rust, you can generate an ID like this:

```rs
use rand::Rng;

// Your amount in raw
let amount_raw: u64 = 10_000_000_000; // 10 units

// Define a buffer to hold the ID
let mut id = [0u8; 32];

// Fill the first 24 bytes with random data
rand::thread_rng().fill(&mut id[0..24]);

// Convert the amount to a little-endian 64-bit integer in the last 8 bytes
id[24..32].copy_from_slice(&amount_raw.to_le_bytes());

// Convert to hexadecimal string for API usage
let id_hex = id.iter()
    .map(|b| format!("{:02x}", b))
    .collect::<String>();
```

In Go, you can use this function:

```go
// Generate a 32-byte unique deposit/withdraw ID
func GenerateID(amountRaw uint64) [32]byte {
	var id [32]byte
	_, err := io.ReadFull(rand.Reader, id[:24])
	if err != nil {
		panic(err)
	}
	binary.LittleEndian.PutUint64(id[24:], amountRaw)
	return id
}
```
