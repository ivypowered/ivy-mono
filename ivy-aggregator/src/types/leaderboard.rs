use std::cmp::Reverse;
use std::collections::{BTreeSet, HashMap};
use std::hash::Hash;

#[derive(Debug)]
pub struct Leaderboard<K, V> {
    // Key -> Value mapping for O(1) lookups
    values: HashMap<K, V>,
    // (value, key) sorted set for O(log n) operations
    sorted: BTreeSet<(Reverse<V>, K)>,
}

impl<K, V> Leaderboard<K, V>
where
    K: Clone + Hash + Eq + Ord,
    V: Clone + Ord,
{
    pub fn new() -> Self {
        Self {
            values: HashMap::new(),
            sorted: BTreeSet::new(),
        }
    }

    pub fn update(&mut self, key: K, value: V) {
        // Remove old entry if it exists
        if let Some(old_value) = self.values.get(&key) {
            self.sorted
                .remove(&(Reverse(old_value.clone()), key.clone()));
        }

        // Insert new entries
        self.values.insert(key.clone(), value.clone());
        self.sorted.insert((Reverse(value), key));
    }

    pub fn get(&self, key: &K) -> Option<&V> {
        self.values.get(key)
    }

    pub fn range(&self, skip: usize, count: usize) -> impl Iterator<Item = (&K, &V)> {
        self.sorted
            .iter()
            .skip(skip)
            .take(count)
            .map(|(Reverse(value), key)| (key, value))
    }
}

// Optional: If you want to support incremental updates for numeric types
impl<K, V> Leaderboard<K, V>
where
    K: Clone + Hash + Eq + Ord,
    V: Clone + Ord + std::ops::Add<Output = V>,
{
    pub fn increment(&mut self, key: K, delta: V)
    where
        V: Default,
    {
        let current = self.get(&key).cloned().unwrap_or_default();
        self.update(key, current + delta);
    }
}
