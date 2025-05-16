use std::{
    fs::{File, OpenOptions},
    io::{self, BufRead, BufReader, Write},
    marker::PhantomData,
    path::Path,
};

use serde::{de::DeserializeOwned, Serialize};

/// A reader for a file containing newline-separated JSON objects.
pub struct JsonReader<T: DeserializeOwned> {
    reader: BufReader<File>,
    _phantom: PhantomData<T>,
}

/// A writer for a file containing newline-separated JSON objects.
pub struct JsonWriter<T: Serialize> {
    writer: File,
    _phantom: PhantomData<T>,
}

impl<T: DeserializeOwned> JsonReader<T> {
    pub fn new<P: AsRef<Path>>(path: P) -> io::Result<JsonReader<T>> {
        Ok(JsonReader {
            reader: BufReader::new(File::open(path)?),
            _phantom: PhantomData,
        })
    }

    pub fn read(&mut self) -> Result<Option<T>, serde_json::Error> {
        let mut line = String::new();
        loop {
            let bytes_read = match self.reader.read_line(&mut line) {
                Ok(bytes) => bytes,
                Err(e) => return Err(serde_json::Error::io(e)),
            };

            if bytes_read == 0 {
                // EOF reached
                return Ok(None);
            }
            if line.trim().len() != 0 {
                // Found non-empty line!
                break;
            }
            line.clear();
        }

        let item: T = serde_json::from_str(&line)?;
        Ok(Some(item))
    }
}

impl<T: Serialize> JsonWriter<T> {
    pub fn new<P: AsRef<Path>>(path: P) -> io::Result<JsonWriter<T>> {
        Ok(JsonWriter {
            writer: OpenOptions::new().create(true).append(true).open(path)?,
            _phantom: PhantomData,
        })
    }

    pub fn write_multiple(&mut self, items: &[T]) -> Result<(), io::Error> {
        let mut dst = Vec::new();
        for item in items {
            serde_json::to_writer(&mut dst, item)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            dst.push(b'\n');
        }
        self.writer.write_all(&dst)?;
        self.writer.flush()?;
        Ok(())
    }
}
