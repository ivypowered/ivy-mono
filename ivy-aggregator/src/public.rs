use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Public(pub [u8; 32]);

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

// Implement Serialize for Public
impl Serialize for Public {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let encoded = bs58::encode(&self.0).into_string();
        serializer.serialize_str(&encoded)
    }
}

// Implement Deserialize for Public
impl<'de> Deserialize<'de> for Public {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        use serde::de::Error;
        let s = String::deserialize(deserializer)?;
        Public::from_str(&s).map_err(|e| Error::custom(format!("Invalid public key: {}", e)))
    }
}

impl Public {
    pub const fn zero() -> Public {
        Public([0u8; 32])
    }
}
