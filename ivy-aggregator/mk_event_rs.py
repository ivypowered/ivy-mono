import json
import sys

# Pump.fun events info (discriminators will be imported from pf.rs)
PUMP_FUN_EVENTS = [
    {
        "name": "PfTradeEvent",
        "variant": "PfTrade",
        "display_name": "pfTradeEvent",
        "discriminator_const": "PF_TRADE_EVENT_TAG"
    },
    {
        "name": "PfMigrationEvent",
        "variant": "PfMigration",
        "display_name": "pfMigrationEvent",
        "discriminator_const": "PF_MIGRATE_EVENT_TAG"
    },
    {
        "name": "PaBuyEvent",
        "variant": "PaBuy",
        "display_name": "paBuyEvent",
        "discriminator_const": "PA_BUY_EVENT_TAG"
    },
    {
        "name": "PaSellEvent",
        "variant": "PaSell",
        "display_name": "paSellEvent",
        "discriminator_const": "PA_SELL_EVENT_TAG"
    }
]

def map_type(type_info):
    """Map IDL types to Rust types"""
    if isinstance(type_info, str):
        if type_info == "pubkey":
            return "Public"
        elif type_info == "string":
            return "String"
        elif type_info == "bool":
            return "bool"
        elif type_info == "u8":
            return "u8"
        elif type_info == "u32":
            return "u32"
        elif type_info == "u64":
            return "u64"
        else:
            return type_info
    elif isinstance(type_info, dict):
        if "array" in type_info:
            arr = type_info["array"]
            element_type = map_type(arr[0])
            size = arr[1]
            return f"[{element_type}; {size}]"
        elif "option" in type_info:
            inner_type = map_type(type_info["option"])
            return f"Option<{inner_type}>"
    return str(type_info)

def to_camel_case(snake_str):
    s = "".join(x.capitalize() for x in snake_str.lower().split("_"))
    if len(s) > 0:
        return s[0].lower() + s[1:]
    return s

def get_variant_name(event_name):
    """Get the enum variant name from event name"""
    if event_name.endswith("Event"):
        return event_name[:-5]
    return event_name

def discriminator_to_u64(discriminator):
    """Convert discriminator byte array to u64 little-endian"""
    if len(discriminator) != 8:
        raise ValueError(f"Discriminator must be 8 bytes, got {len(discriminator)}")
    return hex(int.from_bytes(bytes(discriminator), byteorder='little'))

def generate_rust_event(event_name, type_def):
    """Generate Rust struct for an event"""
    rust_code = f"#[derive(BorshDeserialize, Debug, Clone, Serialize, Deserialize)]\n"
    rust_code += f"pub struct {event_name} {{\n"

    for field in type_def["fields"]:
        field_name = field["name"]
        field_type = map_type(field["type"])

        # Convert snake_case to JavaScript for JS field names
        js_field_name = to_camel_case(field_name)

        # Add serde rename if needed
        if js_field_name != field_name:
            rust_code += f"    #[serde(rename = \"{js_field_name}\")]\n"

        # Add custom serialization for u64 fields
        if field_type == "u64":
            rust_code += f"    #[serde(serialize_with = \"serialize_u64_as_string\")]\n"
            rust_code += f"    #[serde(deserialize_with = \"deserialize_u64_from_string\")]\n"

        rust_code += f"    pub {field_name}: {field_type},\n"

    rust_code += "}\n"

    # Add impl_event_type!
    variant_name = get_variant_name(event_name)
    # Convert event name from PascalCase to camelCase for the name string
    event_name_str = event_name[0].lower() + event_name[1:]
    rust_code += f"impl_event_type!({event_name}, \"{event_name_str}\", {variant_name});\n"

    return rust_code

def generate_sol_price_event():
    """Generate the SolPriceEvent struct"""
    rust_code = "// Custom event for SOL price updates (not from blockchain)\n"
    rust_code += "#[derive(Debug, Clone, Serialize, Deserialize)]\n"
    rust_code += "pub struct SolPriceEvent {\n"
    rust_code += "    pub price: f64,\n"
    rust_code += "}\n"
    rust_code += "impl_event_type!(SolPriceEvent, \"solPriceEvent\", SolPrice);\n"
    return rust_code

def generate_initialize_event():
    """Generate the InitializeEvent struct"""
    rust_code = "#[derive(BorshDeserialize, Debug, Clone, Serialize, Deserialize)]\n"
    rust_code += "pub struct InitializeEvent {}\n"
    rust_code += "impl_event_type!(InitializeEvent, \"initializeEvent\", Initialize);\n"
    return rust_code

def generate_hydrate_event():
    """Generate the HydrateEvent struct"""
    rust_code = "#[derive(BorshDeserialize, Debug, Clone, Serialize, Deserialize)]\n"
    rust_code += "pub struct HydrateEvent {\n"
    rust_code += "    pub asset: Public,\n"
    rust_code += "    #[serde(rename = \"metadataUrl\")]\n"
    rust_code += "    pub metadata_url: String,\n"
    rust_code += "    pub description: String,\n"
    rust_code += "    #[serde(rename = \"iconUrl\")]\n"
    rust_code += "    pub icon_url: String,\n"
    rust_code += "}\n"
    rust_code += "impl_event_type!(HydrateEvent, \"hydrateEvent\", Hydrate);\n"
    return rust_code

def generate_event_enum_with_from_bytes(event_info, include_pump_fun=True):
    """Generate the EventData enum with from_bytes implementation"""
    rust_code = "#[derive(Debug, Clone)]\n"
    rust_code += "pub enum EventData {\n"

    # Add enum variants from IDL
    for event_name, _, _ in event_info:
        variant_name = get_variant_name(event_name)
        rust_code += f"    {variant_name}({event_name}),\n"

    # Add Pump.fun variants
    if include_pump_fun:
        for pf_event in PUMP_FUN_EVENTS:
            rust_code += f"    {pf_event['variant']}(pf::{pf_event['name']}),\n"

    # Add SolPriceEvent variant
    rust_code += "    SolPrice(SolPriceEvent),\n"
    # Add new variants
    rust_code += "    Initialize(InitializeEvent),\n"
    rust_code += "    Hydrate(HydrateEvent),\n"

    rust_code += "}\n\n"

    # Add from_bytes implementation
    rust_code += "impl EventData {\n"
    rust_code += "    pub fn from_bytes(data: &[u8]) -> Result<Option<Self>, String> {\n"
    rust_code += "        if data.len() < 8 {\n"
    rust_code += "            return Err(\"Data too short for discriminator\".to_string());\n"
    rust_code += "        }\n\n"
    rust_code += "        let discriminator_bytes = &data[0..8];\n"
    rust_code += "        let discriminator = u64::from_le_bytes(\n"
    rust_code += "            discriminator_bytes.try_into()\n"
    rust_code += "                .map_err(|_| \"Failed to convert discriminator bytes to array\")?\n"
    rust_code += "        );\n"
    rust_code += "        let mut event_data = &data[8..];\n\n"

    rust_code += "        match discriminator {\n"

    # Add match arms for each discriminator
    for event_name, discriminator, _ in event_info:
        variant_name = get_variant_name(event_name)
        # Convert discriminator bytes to u64 little-endian
        disc_u64 = discriminator_to_u64(discriminator)
        rust_code += f"            {disc_u64} => {{\n"
        rust_code += f"                let event = {event_name}::deserialize_reader(&mut event_data)\n"
        rust_code += f"                    .map_err(|e| format!(\"Failed to deserialize {event_name}: {{}}\", e))?;\n"
        rust_code += f"                Ok(Some(EventData::{variant_name}(event)))\n"
        rust_code += f"            }}\n"

    # Add match arms for Pump.fun events using imported constants
    if include_pump_fun:
        for pf_event in PUMP_FUN_EVENTS:
            rust_code += f"            pf::{pf_event['discriminator_const']} => {{\n"
            rust_code += f"                let event = pf::{pf_event['name']}::deserialize_reader(&mut event_data)\n"
            rust_code += f"                    .map_err(|e| format!(\"Failed to deserialize {pf_event['name']}: {{}}\", e))?;\n"
            rust_code += f"                return Ok(Some(EventData::{pf_event['variant']}(event)));\n"
            rust_code += f"            }}\n"

    rust_code += "            _ => {\n"
    rust_code += "                return Ok(None);\n"
    rust_code += "            }\n"
    rust_code += "        }\n"
    rust_code += "    }\n\n"

    # Add get_source implementation
    rust_code += "    pub fn get_source(&self) -> Source {\n"
    rust_code += "        match self {\n"

    # Add match arms for Ivy events (IDL events)
    for event_name, _, _ in event_info:
        variant_name = get_variant_name(event_name)
        rust_code += f"            EventData::{variant_name}(_) => Source::Ivy,\n"

    # Add match arms for Pump.fun events
    if include_pump_fun:
        for pf_event in PUMP_FUN_EVENTS:
            if pf_event['variant'] in ['PfTrade', 'PfMigration']:
                rust_code += f"            EventData::{pf_event['variant']}(..) => Source::Pf,\n"
            elif pf_event['variant'] in ['PaBuy', 'PaSell']:
                rust_code += f"            EventData::{pf_event['variant']}(..) => Source::Pa,\n"

    # Add match arm for SolPriceEvent
    rust_code += "            EventData::SolPrice(_) => Source::Fx,\n"
    rust_code += "            EventData::Initialize(_) => Source::Misc,\n"
    rust_code += "            EventData::Hydrate(_) => Source::Misc,\n"

    rust_code += "        }\n"
    rust_code += "    }\n"
    rust_code += "}\n"

    return rust_code

def generate_serialize_impl(event_info, include_pump_fun=True):
    """Generate Serialize implementation for Event"""
    rust_code = "impl Serialize for Event {\n"
    rust_code += "    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>\n"
    rust_code += "    where\n"
    rust_code += "        S: Serializer,\n"
    rust_code += "    {\n"
    rust_code += "        let (name, data) = match &self.data {\n"

    for event_name, _, _ in event_info:
        variant_name = get_variant_name(event_name)
        rust_code += f"            EventData::{variant_name}(e) => ({event_name}::NAME, serde_json::to_value(e)),\n"

    # Add Pump.fun events
    if include_pump_fun:
        for pf_event in PUMP_FUN_EVENTS:
            rust_code += f"            EventData::{pf_event['variant']}(e) => (\"{pf_event['display_name']}\", serde_json::to_value(e)),\n"

    # Add SolPriceEvent
    rust_code += f"            EventData::SolPrice(e) => (SolPriceEvent::NAME, serde_json::to_value(e)),\n"
    # Add new events
    rust_code += f"            EventData::Initialize(e) => (InitializeEvent::NAME, serde_json::to_value(e)),\n"
    rust_code += f"            EventData::Hydrate(e) => (HydrateEvent::NAME, serde_json::to_value(e)),\n"

    rust_code += "        };\n\n"
    rust_code += "        let data = data.map_err(serde::ser::Error::custom)?;\n\n"
    rust_code += "        let mut event = serializer.serialize_struct(\"Event\", 4)?;\n"
    rust_code += "        event.serialize_field(\"name\", &name)?;\n"
    rust_code += "        event.serialize_field(\"data\", &data)?;\n"
    rust_code += "        event.serialize_field(\"signature\", &self.signature)?;\n"
    rust_code += "        event.serialize_field(\"timestamp\", &self.timestamp.to_string())?;\n"
    rust_code += "        event.end()\n"
    rust_code += "    }\n"
    rust_code += "}\n"

    return rust_code

def generate_deserialize_impl(event_info):
    """Generate Deserialize implementation for Event"""
    rust_code = "impl<'de> Deserialize<'de> for Event {\n"
    rust_code += "    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>\n"
    rust_code += "    where\n"
    rust_code += "        D: Deserializer<'de>,\n"
    rust_code += "    {\n"
    rust_code += "        #[derive(Deserialize)]\n"
    rust_code += "        struct RawEvent {\n"
    rust_code += "            name: String,\n"
    rust_code += "            data: serde_json::Value,\n"
    rust_code += "            signature: Signature,\n"
    rust_code += "            #[serde(deserialize_with = \"deserialize_u64_from_string\")]\n"
    rust_code += "            timestamp: u64,\n"
    rust_code += "        }\n\n"
    rust_code += "        let raw_event = RawEvent::deserialize(deserializer)?;\n"
    rust_code += "        let data = deserialize_event_data(&raw_event.name, raw_event.data)?;\n\n"
    rust_code += "        Ok(Event {\n"
    rust_code += "            data,\n"
    rust_code += "            signature: raw_event.signature,\n"
    rust_code += "            timestamp: raw_event.timestamp,\n"
    rust_code += "        })\n"
    rust_code += "    }\n"
    rust_code += "}\n"

    return rust_code

def generate_deserialize_event_data(event_info, include_pump_fun=True):
    """Generate deserialize_event_data function"""
    rust_code = "fn deserialize_event_data<E: de::Error>(\n"
    rust_code += "    name: &str,\n"
    rust_code += "    data: serde_json::Value,\n"
    rust_code += ") -> Result<EventData, E> {\n"

    for event_name, _, _ in event_info:
        rust_code += f"    if name == {event_name}::NAME {{\n"
        rust_code += f"        return serde_json::from_value::<{event_name}>(data)\n"
        rust_code += f"            .map(|e| e.into_event_data())\n"
        rust_code += f"            .map_err(E::custom);\n"
        rust_code += f"    }}\n"

    # Add Pump.fun events
    if include_pump_fun:
        for pf_event in PUMP_FUN_EVENTS:
            rust_code += f"    if name == \"{pf_event['display_name']}\" {{\n"
            rust_code += f"        return serde_json::from_value::<pf::{pf_event['name']}>(data)\n"
            rust_code += f"            .map(|e| EventData::{pf_event['variant']}(e))\n"
            rust_code += f"            .map_err(E::custom);\n"
            rust_code += f"    }}\n"

    # Add SolPriceEvent
    rust_code += f"    if name == SolPriceEvent::NAME {{\n"
    rust_code += f"        return serde_json::from_value::<SolPriceEvent>(data)\n"
    rust_code += f"            .map(|e| e.into_event_data())\n"
    rust_code += f"            .map_err(E::custom);\n"
    rust_code += f"    }}\n"

    # Add new events
    rust_code += f"    if name == InitializeEvent::NAME {{\n"
    rust_code += f"        return serde_json::from_value::<InitializeEvent>(data)\n"
    rust_code += f"            .map(|e| e.into_event_data())\n"
    rust_code += f"            .map_err(E::custom);\n"
    rust_code += f"    }}\n"

    rust_code += f"    if name == HydrateEvent::NAME {{\n"
    rust_code += f"        return serde_json::from_value::<HydrateEvent>(data)\n"
    rust_code += f"            .map(|e| e.into_event_data())\n"
    rust_code += f"            .map_err(E::custom);\n"
    rust_code += f"    }}\n"

    rust_code += "\n    Err(E::custom(format!(\"Unknown event type: {}\", name)))\n"
    rust_code += "}\n"

    return rust_code

def main(script_name, input_file):
    # Read the IDL file
    with open(input_file, 'r') as f:
        idl = json.load(f)

    # Create a mapping of type names to their definitions
    type_map = {}
    for type_def in idl.get("types", []):
        type_map[type_def["name"]] = type_def["type"]

    # Track unique events with their discriminators and display names
    event_info = []  # List of (event_name, discriminator, display_name) tuples
    seen_events = set()

    # Start generating the full file
    rust_code = f"// Code generated by {script_name}\n"
    rust_code += "use borsh::BorshDeserialize;\n"
    rust_code += "use crate::pf;  // Import Pump.fun events and discriminators\n"
    rust_code += "use crate::types::public::Public;\n"
    rust_code += "use crate::types::source::Source;\n"
    rust_code += "use crate::types::signature::Signature;\n"
    rust_code += "use serde::ser::SerializeStruct;\n"
    rust_code += "use serde::{de, Deserialize, Deserializer, Serialize, Serializer};\n"
    rust_code += "use std::fmt;\n"
    rust_code += "use std::str::FromStr;\n\n"

    # Add helpers section
    rust_code += "//\n"
    rust_code += "// === Helpers ===\n"
    rust_code += "//\n\n"

    rust_code += """pub fn deserialize_u64_from_string<'de, D>(deserializer: D) -> Result<u64, D::Error>
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

pub fn serialize_u64_as_string<S>(value: &u64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

"""

    # Add trait and macro section
    rust_code += "//\n"
    rust_code += "// === Trait + Mapping Macro ===\n"
    rust_code += "//\n\n"

    rust_code += """trait EventType: Sized + Serialize + for<'de> Deserialize<'de> {
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

"""

    # Process each event and collect info
    for event in idl.get("events", []):
        event_name = event["name"]
        discriminator = event.get("discriminator", [])

        # Skip if we've already processed this event
        if event_name in seen_events:
            continue
        seen_events.add(event_name)

        # Find the corresponding type definition
        if event_name in type_map:
            type_def = type_map[event_name]
            if type_def["kind"] == "struct":
                # Convert event name from PascalCase to camelCase for display
                display_name = event_name[0].lower() + event_name[1:]
                event_info.append((event_name, discriminator, display_name))

    # Add enum section with from_bytes
    rust_code += "//\n"
    rust_code += "// === Enum for EventData ===\n"
    rust_code += "//\n\n"
    rust_code += generate_event_enum_with_from_bytes(event_info)
    rust_code += "\n"

    # Add Event struct section
    rust_code += "//\n"
    rust_code += "// === Event Struct ===\n"
    rust_code += "//\n\n"
    rust_code += """#[derive(Debug, Clone)]
pub struct Event {
    pub data: EventData,
    pub signature: Signature,
    pub timestamp: u64,
}

"""

    # Add event structs section
    rust_code += "//\n"
    rust_code += "// === Event Structs ===\n"
    rust_code += "//\n\n"

    # Add SolPriceEvent first
    rust_code += generate_sol_price_event()
    rust_code += "\n"
    # Add the new events
    rust_code += generate_initialize_event()
    rust_code += "\n"
    rust_code += generate_hydrate_event()
    rust_code += "\n"

    for event_name, _, _ in event_info:
        type_def = type_map[event_name]
        rust_code += generate_rust_event(event_name, type_def)
        rust_code += "\n"

    # Add Serialize/Deserialize impl section
    rust_code += "//\n"
    rust_code += "// === Event impl Serialize/Deserialize ===\n"
    rust_code += "//\n\n"

    rust_code += generate_serialize_impl(event_info)
    rust_code += "\n"
    rust_code += generate_deserialize_impl(event_info)
    rust_code += "\n"
    rust_code += generate_deserialize_event_data(event_info)

    print(rust_code)

if __name__ == "__main__":
    script_name = sys.argv[0].split("/")[-1].split("\\")[-1]
    if len(sys.argv) >= 2:
        input_file = sys.argv[1]
        main(script_name, input_file)
    else:
        print(f"usage: {script_name} <input>", file=sys.stderr)
        exit(1)
