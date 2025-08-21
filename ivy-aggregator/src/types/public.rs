use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Public(pub [u8; 32]);

impl borsh::BorshDeserialize for Public {
    fn deserialize_reader<R: std::io::Read>(reader: &mut R) -> std::io::Result<Self> {
        let mut b = [0u8; 32];
        reader.read_exact(&mut b)?;
        Ok(Public(b))
    }
}

impl FromStr for Public {
    type Err = bs58::decode::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut bytes = [0u8; 32];
        let decoded_len = bs58::decode(s).onto(&mut bytes)?;

        if decoded_len != 32 {
            return Err(bs58::decode::Error::BufferTooSmall);
        }

        Ok(Self(bytes))
    }
}

impl std::fmt::Display for Public {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", bs58::encode(&self.0).into_string())
    }
}

// Implement Serialize for Public - zero-copy for binary formats
impl Serialize for Public {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        if serializer.is_human_readable() {
            // For JSON and other human-readable formats, use base58
            let encoded = bs58::encode(&self.0).into_string();
            serializer.serialize_str(&encoded)
        } else {
            // For binary formats, serialize raw bytes (zero-copy)
            serializer.serialize_bytes(&self.0)
        }
    }
}

// Implement Deserialize for Public - zero-copy for binary formats
impl<'de> Deserialize<'de> for Public {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        if deserializer.is_human_readable() {
            // For JSON and other human-readable formats, expect base58 string
            deserializer.deserialize_str(PublicVisitor)
        } else {
            // For binary formats, deserialize raw bytes (zero-copy when possible)
            deserializer.deserialize_bytes(PublicVisitor)
        }
    }
}

// Visitor for zero-copy deserialization
struct PublicVisitor;

impl<'de> serde::de::Visitor<'de> for PublicVisitor {
    type Value = Public;

    fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
        formatter.write_str("a 32-byte public key as base58 string or raw bytes")
    }

    // Handle base58 string
    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Public::from_str(v).map_err(|e| E::custom(format!("Invalid public key: {}", e)))
    }

    // Handle borrowed string (zero-copy for the string itself)
    fn visit_borrowed_str<E>(self, v: &'de str) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        self.visit_str(v)
    }

    // Handle owned bytes
    fn visit_bytes<E>(self, v: &[u8]) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        if v.len() != 32 {
            return Err(E::custom(format!(
                "Invalid public key length: expected 32, got {}",
                v.len()
            )));
        }
        let mut bytes = [0u8; 32];
        bytes.copy_from_slice(v);
        Ok(Public(bytes))
    }

    // Handle borrowed bytes (zero-copy for the slice)
    fn visit_borrowed_bytes<E>(self, v: &'de [u8]) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        self.visit_bytes(v)
    }

    // Handle byte arrays directly
    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: serde::de::SeqAccess<'de>,
    {
        let mut bytes = [0u8; 32];
        for (i, byte) in bytes.iter_mut().enumerate() {
            *byte = seq
                .next_element()?
                .ok_or_else(|| serde::de::Error::invalid_length(i, &"32 bytes"))?;
        }
        Ok(Public(bytes))
    }
}

impl Public {
    pub const fn zero() -> Public {
        Public([0u8; 32])
    }
}
