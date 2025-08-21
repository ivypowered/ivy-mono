use std::collections::HashMap;

use crate::types::leaderboard::Leaderboard;
use crate::types::public::Public;
use crate::util::{from_ivy_amount, from_sol_amount, mil_to_usd, usd_to_mil};
use crate::volume::Volume;

use crate::state::types::VlbEntry;
use crate::types::event::{Event, EventData, GameSwapEvent, SyncSwapEvent};

use super::prices::PricesComponent;
use super::world::WorldComponent;

pub struct VolumeComponent {
    pub volume_map: HashMap<Public, u64>,
    pub address_to_volume_lb: HashMap<Public, Leaderboard<Public, u64>>,
    pub volume_24h: Volume,
}

impl VolumeComponent {
    pub fn new(minutes: usize) -> Self {
        Self {
            volume_map: HashMap::new(),
            address_to_volume_lb: HashMap::new(),
            volume_24h: Volume::new(minutes),
        }
    }

    pub fn on_event(
        &mut self,
        event: &Event,
        world: &WorldComponent,
        prices: &PricesComponent,
    ) -> bool {
        match &event.data {
            EventData::GameSwap(swap) => self.handle_game_swap(event.timestamp, swap, world),
            EventData::SyncSwap(swap) => self.handle_sync_swap(event.timestamp, swap, prices),
            _ => return false,
        }
        true
    }

    fn handle_game_swap(&mut self, timestamp: u64, swap: &GameSwapEvent, world: &WorldComponent) {
        let ivy_amount = from_ivy_amount(swap.ivy_amount);
        let usdc_value = ivy_amount * world.price();
        let usdc_value_mil = usd_to_mil(usdc_value);

        self.volume_24h.append(usdc_value_mil, timestamp);

        let user = swap.user;
        if user != Public::zero() {
            self.address_to_volume_lb
                .entry(swap.game)
                .or_insert_with(Leaderboard::new)
                .increment(user, usdc_value_mil);
            *self.volume_map.entry(user).or_default() += usdc_value_mil;
        }
    }

    fn handle_sync_swap(&mut self, timestamp: u64, swap: &SyncSwapEvent, prices: &PricesComponent) {
        let usdc_value = from_sol_amount(swap.sol_amount) * prices.sol();
        let usdc_value_mil = usd_to_mil(usdc_value);

        self.volume_24h.append(usdc_value_mil, timestamp);

        let user = swap.user;
        if user != Public::zero() {
            self.address_to_volume_lb
                .entry(swap.sync)
                .or_insert_with(Leaderboard::new)
                .increment(user, usdc_value_mil);
            *self.volume_map.entry(user).or_default() += usdc_value_mil;
        }
    }

    pub fn query_volume_lb(&self, game: Public, count: usize, skip: usize) -> Vec<VlbEntry> {
        match self.address_to_volume_lb.get(&game) {
            None => Vec::new(),
            Some(lb) => lb
                .range(skip, count)
                .map(|(&user, &mil)| VlbEntry {
                    user,
                    volume: mil_to_usd(mil),
                })
                .collect(),
        }
    }

    pub fn get_volume(&self, user: Public) -> f32 {
        self.volume_map
            .get(&user)
            .map(|&x| mil_to_usd(x))
            .unwrap_or_default()
    }

    pub fn get_volume_multiple(&self, users: &[Public]) -> Vec<f32> {
        users
            .iter()
            .map(|u| {
                self.volume_map
                    .get(u)
                    .map(|&x| mil_to_usd(x))
                    .unwrap_or_default()
            })
            .collect()
    }

    pub fn volume_24h_usd(&self) -> f32 {
        mil_to_usd(self.volume_24h.get())
    }
}
