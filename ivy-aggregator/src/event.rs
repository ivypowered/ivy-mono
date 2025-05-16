use crate::public::Public;
use crate::signature::Signature;
use serde::ser::SerializeStruct;
use serde::{de, Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;
use std::str::FromStr;

// Simplified Event structure
#[derive(Debug, Clone)]
pub struct Event {
    pub data: EventData,
    pub signature: Signature,
    pub timestamp: u64,
}

// Custom serialization for Event
impl Serialize for Event {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        // Determine event name and data based on EventData variant
        let (name, data) = match &self.data {
            EventData::GameCreate(event_data) => (
                "gameCreateEvent",
                serde_json::to_value(event_data).map_err(serde::ser::Error::custom)?,
            ),
            EventData::GameEdit(event_data) => (
                "gameEditEvent",
                serde_json::to_value(event_data).map_err(serde::ser::Error::custom)?,
            ),
            EventData::GameSwap(event_data) => (
                "gameSwapEvent",
                serde_json::to_value(event_data).map_err(serde::ser::Error::custom)?,
            ),
            EventData::GameDeposit(event_data) => (
                "gameDepositEvent",
                serde_json::to_value(event_data).map_err(serde::ser::Error::custom)?,
            ),
            EventData::GameWithdraw(event_data) => (
                "gameWithdrawEvent",
                serde_json::to_value(event_data).map_err(serde::ser::Error::custom)?,
            ),
            EventData::WorldCreate(event_data) => (
                "worldCreateEvent",
                serde_json::to_value(event_data).map_err(serde::ser::Error::custom)?,
            ),
            EventData::WorldSwap(event_data) => (
                "worldSwapEvent",
                serde_json::to_value(event_data).map_err(serde::ser::Error::custom)?,
            ),
            EventData::WorldUpdate(event_data) => (
                "worldUpdateEvent",
                serde_json::to_value(event_data).map_err(serde::ser::Error::custom)?,
            ),
            EventData::WorldVesting(event_data) => (
                "worldVestingEvent",
                serde_json::to_value(event_data).map_err(serde::ser::Error::custom)?,
            ),
            EventData::Unknown(name) => (name.as_str(), serde_json::Value::Null),
        };

        // Create a structure with the expected fields
        let mut event = serializer.serialize_struct("Event", 4)?;
        event.serialize_field("name", &name)?;
        event.serialize_field("data", &data)?;
        event.serialize_field("signature", &self.signature)?;
        // Serialize timestamp as a string
        event.serialize_field("timestamp", &self.timestamp.to_string())?;
        event.end()
    }
}

// Custom deserialization for Event
impl<'de> Deserialize<'de> for Event {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        // This matches the actual JSON structure
        #[derive(Deserialize)]
        struct RawEvent {
            name: String,
            data: serde_json::Value,
            signature: Signature,
            #[serde(deserialize_with = "deserialize_u64_from_string")]
            timestamp: u64,
        }

        let raw = RawEvent::deserialize(deserializer)?;

        // Convert to the appropriate EventData based on name
        let data = match raw.name.as_str() {
            "gameCreateEvent" => {
                let event_data = serde_json::from_value(raw.data).map_err(de::Error::custom)?;
                EventData::GameCreate(event_data)
            }
            "gameEditEvent" => {
                let event_data = serde_json::from_value(raw.data).map_err(de::Error::custom)?;
                EventData::GameEdit(event_data)
            }
            "gameSwapEvent" => {
                let event_data = serde_json::from_value(raw.data).map_err(de::Error::custom)?;
                EventData::GameSwap(event_data)
            }
            "gameDepositEvent" => {
                let event_data = serde_json::from_value(raw.data).map_err(de::Error::custom)?;
                EventData::GameDeposit(event_data)
            }
            "gameWithdrawEvent" => {
                let event_data = serde_json::from_value(raw.data).map_err(de::Error::custom)?;
                EventData::GameWithdraw(event_data)
            }
            "worldCreateEvent" => {
                let event_data = serde_json::from_value(raw.data).map_err(de::Error::custom)?;
                EventData::WorldCreate(event_data)
            }
            "worldSwapEvent" => {
                let event_data = serde_json::from_value(raw.data).map_err(de::Error::custom)?;
                EventData::WorldSwap(event_data)
            }
            "worldUpdateEvent" => {
                let event_data = serde_json::from_value(raw.data).map_err(de::Error::custom)?;
                EventData::WorldUpdate(event_data)
            }
            "worldVestingEvent" => {
                let event_data = serde_json::from_value(raw.data).map_err(de::Error::custom)?;
                EventData::WorldVesting(event_data)
            }
            _ => EventData::Unknown(raw.name),
        };

        Ok(Event {
            data,
            signature: raw.signature,
            timestamp: raw.timestamp,
        })
    }
}

// Helper function to deserialize u64 from string
fn deserialize_u64_from_string<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    struct StringOrNumber;

    impl<'de> de::Visitor<'de> for StringOrNumber {
        type Value = u64;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("string or number")
        }

        fn visit_str<E>(self, value: &str) -> Result<u64, E>
        where
            E: de::Error,
        {
            u64::from_str(value).map_err(de::Error::custom)
        }

        fn visit_string<E>(self, value: String) -> Result<u64, E>
        where
            E: de::Error,
        {
            u64::from_str(&value).map_err(de::Error::custom)
        }

        fn visit_u64<E>(self, value: u64) -> Result<u64, E>
        where
            E: de::Error,
        {
            Ok(value)
        }

        fn visit_i64<E>(self, value: i64) -> Result<u64, E>
        where
            E: de::Error,
        {
            if value >= 0 {
                Ok(value as u64)
            } else {
                Err(de::Error::custom(format!("negative integer: {}", value)))
            }
        }
    }

    deserializer.deserialize_any(StringOrNumber)
}

// Helper function to serialize u64 as string
fn serialize_u64_as_string<S>(value: &u64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

// Enum for different event data types
#[derive(Debug, Clone)]
pub enum EventData {
    GameCreate(GameCreateEvent),
    GameEdit(GameEditEvent),
    GameSwap(GameSwapEvent),
    GameDeposit(GameDepositEvent),
    GameWithdraw(GameWithdrawEvent),
    WorldCreate(WorldCreateEvent),
    WorldSwap(WorldSwapEvent),
    WorldUpdate(WorldUpdateEvent),
    WorldVesting(WorldVestingEvent),
    Unknown(String),
}

// Event data structures matching the IDL definitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameCreateEvent {
    pub game: Public,
    pub mint: Public,
    #[serde(rename = "swapAlt")]
    pub swap_alt: Public,
    pub name: String,
    pub symbol: String,
    #[serde(rename = "ivyBalance")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub ivy_balance: u64,
    #[serde(rename = "gameBalance")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub game_balance: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameEditEvent {
    pub game: Public,
    pub owner: Public,
    #[serde(rename = "withdrawAuthority")]
    pub withdraw_authority: Public,
    #[serde(rename = "gameUrl")]
    pub game_url: String,
    #[serde(rename = "coverUrl")]
    pub cover_url: String,
    #[serde(rename = "metadataUrl")]
    pub metadata_url: String,
    #[serde(rename = "shortDesc")]
    pub short_desc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSwapEvent {
    pub game: Public,
    #[serde(rename = "ivyBalance")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub ivy_balance: u64,

    #[serde(rename = "gameBalance")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub game_balance: u64,

    #[serde(rename = "ivyAmount")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub ivy_amount: u64,

    #[serde(rename = "gameAmount")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub game_amount: u64,

    #[serde(rename = "isBuy")]
    pub is_buy: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameDepositEvent {
    pub game: Public,
    pub id: [u8; 32],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameWithdrawEvent {
    pub game: Public,
    pub id: [u8; 32],
    #[serde(rename = "withdrawAuthority")]
    pub withdraw_authority: Public,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldCreateEvent {
    #[serde(rename = "ivyCurveMax")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub ivy_curve_max: u64,

    #[serde(rename = "curveInputScaleNum")]
    pub curve_input_scale_num: u32,

    #[serde(rename = "curveInputScaleDen")]
    pub curve_input_scale_den: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldSwapEvent {
    #[serde(rename = "usdcBalance")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub usdc_balance: u64,

    #[serde(rename = "ivySold")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub ivy_sold: u64,

    #[serde(rename = "usdcAmount")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub usdc_amount: u64,

    #[serde(rename = "ivyAmount")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub ivy_amount: u64,

    #[serde(rename = "isBuy")]
    pub is_buy: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldUpdateEvent {
    #[serde(rename = "ivyInitialLiquidity")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub ivy_initial_liquidity: u64,

    #[serde(rename = "gameInitialLiquidity")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub game_initial_liquidity: u64,

    #[serde(rename = "ivyFeeBps")]
    pub ivy_fee_bps: u8,

    #[serde(rename = "gameFeeBps")]
    pub game_fee_bps: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldVestingEvent {
    pub discriminator: u64,
    #[serde(rename = "ivyAmount")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub ivy_amount: u64,
    #[serde(rename = "ivyVested")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub ivy_vested: u64,
}
