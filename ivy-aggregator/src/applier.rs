use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc::Receiver;
use std::sync::Arc;

use serde::{de::DeserializeOwned, Serialize};

use crate::state::State;
use crate::types::event::{Event, EventData, SolPriceEvent};
use crate::types::jsonl::{JsonReader, JsonWriter};
use crate::types::signature::Signature;
use crate::types::source::Source;

// Generic Cursor struct to handle file operations for any serializable type T
pub struct Cursor<T> {
    file: File,
    _phantom: std::marker::PhantomData<T>,
}

impl<T> Cursor<T>
where
    T: Serialize + DeserializeOwned,
{
    pub fn new(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let path = Path::new(path);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(path)?;

        Ok(Cursor {
            file,
            _phantom: std::marker::PhantomData,
        })
    }

    pub fn read(&mut self) -> Result<Option<T>, Box<dyn std::error::Error>> {
        self.file.seek(SeekFrom::Start(0))?;
        let mut contents = String::new();
        self.file.read_to_string(&mut contents)?;

        if contents.trim().is_empty() {
            return Ok(None);
        }

        match serde_json::from_str(contents.trim()) {
            Ok(data) => Ok(Some(data)),
            Err(e) => Err(Box::new(e)),
        }
    }

    pub fn write(&mut self, data: &T) -> Result<(), Box<dyn std::error::Error>> {
        let json = serde_json::to_string(data)?;
        self.file.seek(SeekFrom::Start(0))?;
        self.file.set_len(0)?;
        self.file.write_all(json.as_bytes())?;
        self.file.flush()?;
        Ok(())
    }
}

pub struct Applier {
    state: Arc<State>,
    rx: Receiver<Vec<Event>>,
    writer: JsonWriter<Event>,

    // cursor objects
    ivy_cursor: Cursor<Signature>,
    pf_cursor: Cursor<Signature>,
    pa_cursor: Cursor<Signature>,
    fx_cursor: Cursor<(f64, u64)>,

    // SOL price caching and dedupe
    last_fx_price: Option<(f64, u64)>, // cached from FX feed (price, ts)

    // For fetching by others
    ivy_last_signature: Option<Signature>,
    pf_last_signature: Option<Signature>,
    pa_last_signature: Option<Signature>,
}

impl Applier {
    pub fn new(
        state: Arc<State>,
        rx: Receiver<Vec<Event>>,
        events_path: &str,
        ivy_cursor_path: &str,
        pf_cursor_path: &str,
        pa_cursor_path: &str,
        fx_last_price_path: &str,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let events_path = PathBuf::from(events_path);
        if let Some(parent) = events_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let writer = JsonWriter::new(&events_path)?;

        // Create or load cursor files
        let mut ivy_cursor = Cursor::new(ivy_cursor_path)?;
        let mut pf_cursor = Cursor::new(pf_cursor_path)?;
        let mut pa_cursor = Cursor::new(pa_cursor_path)?;
        let mut fx_cursor = Cursor::new(fx_last_price_path)?;

        // Read last signatures (could be None if file is empty)
        let ivy_last_signature = ivy_cursor.read()?;
        let pf_last_signature = pf_cursor.read()?;
        let pa_last_signature = pa_cursor.read()?;
        let last_fx_price = fx_cursor.read()?;

        // Load existing events and apply them to the state
        let mut reader = JsonReader::<Event>::new(&events_path)?;
        let mut sg = state.write().unwrap();
        while let Some(event) = reader.read()? {
            sg.on_event(&event);
        }
        // Update hot game list
        let hl = sg.assets.calculate_hot_list(&sg.games, &sg.syncs);
        sg.assets.update_hot_list(hl);
        drop(sg); // Release the lock

        Ok(Self {
            state,
            rx,
            writer,
            ivy_cursor,
            pf_cursor,
            pa_cursor,
            fx_cursor,
            last_fx_price,
            ivy_last_signature,
            pf_last_signature,
            pa_last_signature,
        })
    }

    pub fn get_ivy_last_signature(&self) -> Option<&Signature> {
        self.ivy_last_signature.as_ref()
    }

    pub fn get_pf_last_signature(&self) -> Option<&Signature> {
        self.pf_last_signature.as_ref()
    }

    pub fn get_pa_last_signature(&self) -> Option<&Signature> {
        self.pa_last_signature.as_ref()
    }

    pub fn run(mut self) {
        while let Ok(events) = self.rx.recv() {
            if let Err(e) = self.process_batch(events) {
                eprintln!("Error processing batch: {}", e);
            }
        }
    }

    fn process_batch(&mut self, events: Vec<Event>) -> Result<(), Box<dyn std::error::Error>> {
        let mut write_queue = Vec::with_capacity(events.len());
        let mut state = self.state.write().unwrap();

        for event in events {
            if let EventData::SolPrice(SolPriceEvent { price, .. }) = event.data {
                self.last_fx_price = Some((price, event.timestamp));
                continue;
            }

            if let Some((price, ts)) = self.last_fx_price {
                let fx_event = Event {
                    data: EventData::SolPrice(SolPriceEvent { price }),
                    signature: Signature::zero(),
                    timestamp: ts,
                };
                state.on_event(&fx_event);
                write_queue.push(fx_event);
                self.last_fx_price = None;
            }

            let source = event.data.get_source();
            let signature = event.signature;

            if state.on_event(&event) {
                write_queue.push(event);
            }

            match source {
                Source::Ivy => self.ivy_last_signature = Some(signature),
                Source::Pa => self.pa_last_signature = Some(signature),
                Source::Pf => self.pf_last_signature = Some(signature),
                _ => {}
            }
        }

        if !write_queue.is_empty() {
            self.writer.write_multiple(&write_queue)?;
        }

        if let Some(sig) = &self.ivy_last_signature {
            self.ivy_cursor.write(sig)?;
        }
        if let Some(sig) = &self.pa_last_signature {
            self.pa_cursor.write(sig)?;
        }
        if let Some(sig) = &self.pf_last_signature {
            self.pf_cursor.write(sig)?;
        }
        if let Some(val) = self.last_fx_price {
            self.fx_cursor.write(&val)?;
        }

        Ok(())
    }
}
