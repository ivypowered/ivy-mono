use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Signature(pub [u8; 64]);

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
        write!(f, "{}", bs58::encode(&self.0).into_string())
    }
}

// Implement Serialize for Signature
impl Serialize for Signature {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let encoded = bs58::encode(&self.0).into_string();
        serializer.serialize_str(&encoded)
    }
}

// Implement Deserialize for Signature
impl<'de> Deserialize<'de> for Signature {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        use serde::de::Error;
        let s = String::deserialize(deserializer)?;
        Signature::from_str(&s).map_err(|e| Error::custom(format!("Invalid signature: {}", e)))
    }
}
