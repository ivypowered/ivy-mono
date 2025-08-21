use core::str;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Signature(pub [u8; 64]);

impl Signature {
    pub const fn zero() -> Signature {
        Signature([0u8; 64])
    }
}

impl FromStr for Signature {
    type Err = bs58::decode::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut bytes = [0u8; 64];
        let decoded_len = bs58::decode(s).onto(&mut bytes)?;

        if decoded_len != 64 {
            return Err(bs58::decode::Error::BufferTooSmall);
        }

        Ok(Self(bytes))
    }
}

impl std::fmt::Display for Signature {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut b = [0u8; 88];
        let len = bs58::encode(&self.0).onto(b.as_mut_slice()).unwrap();
        f.write_str(unsafe { str::from_utf8_unchecked(&b[..len]) })
    }
}

// Implement Serialize for Signature
impl Serialize for Signature {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut b = [0u8; 88];
        let len = bs58::encode(&self.0).onto(b.as_mut_slice()).unwrap();
        serializer.serialize_str(unsafe { str::from_utf8_unchecked(&b[..len]) })
    }
}

// Implement Deserialize for Signature
impl<'de> Deserialize<'de> for Signature {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct SignatureVisitor;

        impl<'de> serde::de::Visitor<'de> for SignatureVisitor {
            type Value = Signature;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a base58-encoded 64-byte signature")
            }

            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Signature::from_str(value)
                    .map_err(|e| E::custom(format!("Invalid signature: {}", e)))
            }

            fn visit_borrowed_str<E>(self, value: &'de str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                // This is the zero-copy path - we're working directly with borrowed data
                Signature::from_str(value)
                    .map_err(|e| E::custom(format!("Invalid signature: {}", e)))
            }

            fn visit_string<E>(self, value: String) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Signature::from_str(&value)
                    .map_err(|e| E::custom(format!("Invalid signature: {}", e)))
            }
        }

        deserializer.deserialize_str(SignatureVisitor)
    }
}
