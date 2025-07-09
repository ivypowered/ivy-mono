use crate::public::Public;
use crate::signature::Signature;
use serde::ser::SerializeStruct;
use serde::{de, Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;
use std::str::FromStr;

//
// === Helpers ===
//

fn deserialize_u64_from_string<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    struct StringOrNumber;

    impl<'de> de::Visitor<'de> for StringOrNumber {
        type Value = u64;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("a string or unsigned integer")
        }

        fn visit_str<E: de::Error>(self, value: &str) -> Result<u64, E> {
            u64::from_str(value).map_err(de::Error::custom)
        }

        fn visit_string<E: de::Error>(self, value: String) -> Result<u64, E> {
            u64::from_str(&value).map_err(de::Error::custom)
        }

        fn visit_u64<E: de::Error>(self, value: u64) -> Result<u64, E> {
            Ok(value)
        }

        fn visit_i64<E: de::Error>(self, value: i64) -> Result<u64, E> {
            if value >= 0 {
                Ok(value as u64)
            } else {
                Err(E::custom(format!(
                    "expected non-negative number, got {}",
                    value
                )))
            }
        }
    }

    deserializer.deserialize_any(StringOrNumber)
}

fn serialize_u64_as_string<S>(value: &u64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

//
// === Trait + Mapping Macro ===
//

trait EventType: Sized + Serialize + for<'de> Deserialize<'de> {
    const NAME: &'static str;
    fn into_event_data(self) -> EventData;
}

macro_rules! impl_event_type {
    ($type:ty, $name:literal, $variant:ident) => {
        impl EventType for $type {
            const NAME: &'static str = $name;
            fn into_event_data(self) -> EventData {
                EventData::$variant(self)
            }
        }
    };
}

//
// === Enum for EventData ===
//

#[derive(Debug, Clone)]
pub enum EventData {
    GameCreate(GameCreateEvent),
    GameEdit(GameEditEvent),
    GameSwap(GameSwapEvent),
    GameBurn(GameBurnEvent),
    GameDeposit(GameDepositEvent),
    GameWithdraw(GameWithdrawEvent),
    WorldCreate(WorldCreateEvent),
    WorldSwap(WorldSwapEvent),
    WorldUpdate(WorldUpdateEvent),
    WorldVesting(WorldVestingEvent),
    CommentEvent(CommentEvent),
    Unknown(String),
}

//
// === Event Struct ===
//

#[derive(Debug, Clone)]
pub struct Event {
    pub data: EventData,
    pub signature: Signature,
    pub timestamp: u64,
}

//
// === Event Structs ===
//

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
impl_event_type!(GameCreateEvent, "gameCreateEvent", GameCreate);

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
impl_event_type!(GameEditEvent, "gameEditEvent", GameEdit);

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
impl_event_type!(GameSwapEvent, "gameSwapEvent", GameSwap);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameBurnEvent {
    pub game: Public,
    pub id: [u8; 32],
}
impl_event_type!(GameBurnEvent, "gameBurnEvent", GameBurn);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameDepositEvent {
    pub game: Public,
    pub id: [u8; 32],
}
impl_event_type!(GameDepositEvent, "gameDepositEvent", GameDeposit);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameWithdrawEvent {
    pub game: Public,
    pub id: [u8; 32],
    #[serde(rename = "withdrawAuthority")]
    pub withdraw_authority: Public,
}
impl_event_type!(GameWithdrawEvent, "gameWithdrawEvent", GameWithdraw);

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
impl_event_type!(WorldCreateEvent, "worldCreateEvent", WorldCreate);

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
impl_event_type!(WorldSwapEvent, "worldSwapEvent", WorldSwap);

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
impl_event_type!(WorldUpdateEvent, "worldUpdateEvent", WorldUpdate);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldVestingEvent {
    #[serde(rename = "ivyAmount")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub ivy_amount: u64,
    #[serde(rename = "ivyVested")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub ivy_vested: u64,
}
impl_event_type!(WorldVestingEvent, "worldVestingEvent", WorldVesting);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentEvent {
    pub game: Public,
    pub user: Public,
    #[serde(rename = "commentIndex")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub comment_index: u64,
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub timestamp: u64,
    #[serde(rename = "bufIndex")]
    #[serde(serialize_with = "serialize_u64_as_string")]
    #[serde(deserialize_with = "deserialize_u64_from_string")]
    pub buf_index: u64,
    pub text: String,
}
impl_event_type!(CommentEvent, "commentEvent", CommentEvent);

//
// === Event impl Serialize/Deserialize ===
//

impl Serialize for Event {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let (name, data) = match &self.data {
            EventData::GameCreate(e) => (GameCreateEvent::NAME, serde_json::to_value(e)),
            EventData::GameEdit(e) => (GameEditEvent::NAME, serde_json::to_value(e)),
            EventData::GameSwap(e) => (GameSwapEvent::NAME, serde_json::to_value(e)),
            EventData::GameBurn(e) => (GameBurnEvent::NAME, serde_json::to_value(e)),
            EventData::GameDeposit(e) => (GameDepositEvent::NAME, serde_json::to_value(e)),
            EventData::GameWithdraw(e) => (GameWithdrawEvent::NAME, serde_json::to_value(e)),
            EventData::WorldCreate(e) => (WorldCreateEvent::NAME, serde_json::to_value(e)),
            EventData::WorldSwap(e) => (WorldSwapEvent::NAME, serde_json::to_value(e)),
            EventData::WorldUpdate(e) => (WorldUpdateEvent::NAME, serde_json::to_value(e)),
            EventData::WorldVesting(e) => (WorldVestingEvent::NAME, serde_json::to_value(e)),
            EventData::CommentEvent(e) => (CommentEvent::NAME, serde_json::to_value(e)),
            EventData::Unknown(name) => (name.as_str(), Ok(serde_json::Value::Null)),
        };

        let data = data.map_err(serde::ser::Error::custom)?;

        let mut event = serializer.serialize_struct("Event", 4)?;
        event.serialize_field("name", &name)?;
        event.serialize_field("data", &data)?;
        event.serialize_field("signature", &self.signature)?;
        event.serialize_field("timestamp", &self.timestamp.to_string())?;
        event.end()
    }
}

impl<'de> Deserialize<'de> for Event {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct RawEvent {
            name: String,
            data: serde_json::Value,
            signature: Signature,
            #[serde(deserialize_with = "deserialize_u64_from_string")]
            timestamp: u64,
        }

        let raw_event = RawEvent::deserialize(deserializer)?;
        let data = deserialize_event_data(&raw_event.name, raw_event.data)?;

        Ok(Event {
            data,
            signature: raw_event.signature,
            timestamp: raw_event.timestamp,
        })
    }
}

fn deserialize_event_data<E: de::Error>(
    name: &str,
    data: serde_json::Value,
) -> Result<EventData, E> {
    macro_rules! try_deserialize {
        ($type:ty) => {
            if name == <$type>::NAME {
                return serde_json::from_value::<$type>(data)
                    .map(|e| e.into_event_data())
                    .map_err(E::custom);
            }
        };
    }

    try_deserialize!(GameCreateEvent);
    try_deserialize!(GameEditEvent);
    try_deserialize!(GameSwapEvent);
    try_deserialize!(GameBurnEvent);
    try_deserialize!(GameDepositEvent);
    try_deserialize!(GameWithdrawEvent);
    try_deserialize!(WorldCreateEvent);
    try_deserialize!(WorldSwapEvent);
    try_deserialize!(WorldUpdateEvent);
    try_deserialize!(WorldVestingEvent);
    try_deserialize!(CommentEvent);

    Ok(EventData::Unknown(name.to_string()))
}
