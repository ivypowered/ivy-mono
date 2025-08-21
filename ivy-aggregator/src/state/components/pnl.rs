use std::collections::HashMap;

use crate::state::components::prices::PricesComponent;
use crate::state::components::world::WorldComponent;
use crate::state::types::{PnlEntry, PnlResponse};
use crate::types::event::{Event, EventData, GameSwapEvent, SyncSwapEvent};
use crate::types::public::Public;
use crate::util::{from_game_amount, from_ivy_amount, from_sol_amount, mil_to_usd, usd_to_mil};

pub struct Pnl {
    pub in_mil: u64,
    pub out_mil: u64,
    pub position_raw: u64,
}

pub struct PnlComponent {
    pub(crate) address_to_pnl_map: HashMap<Public, HashMap<Public, Pnl>>,
}

impl PnlComponent {
    pub fn new() -> Self {
        Self {
            address_to_pnl_map: HashMap::new(),
        }
    }

    pub fn on_event(
        &mut self,
        event: &Event,
        world: &WorldComponent,
        prices: &PricesComponent,
    ) -> bool {
        match &event.data {
            EventData::GameSwap(swap) => self.handle_game_swap(swap, world),
            EventData::SyncSwap(swap) => self.handle_sync_swap(swap, prices),
            _ => return false,
        }
        true
    }

    fn handle_game_swap(&mut self, swap_data: &GameSwapEvent, world: &WorldComponent) {
        let user = swap_data.user;
        if user == Public::zero() {
            return;
        }
        let ivy_amount = from_ivy_amount(swap_data.ivy_amount);
        let ivy_price = world.price();
        let usdc_value = ivy_amount * ivy_price;
        let usdc_value_mil = usd_to_mil(usdc_value);

        let pnl = self
            .address_to_pnl_map
            .entry(swap_data.game)
            .or_insert_with(HashMap::new)
            .entry(user)
            .or_insert(Pnl {
                in_mil: 0,
                out_mil: 0,
                position_raw: 0,
            });

        if swap_data.is_buy {
            pnl.in_mil = pnl.in_mil.saturating_add(usdc_value_mil);
            pnl.position_raw = pnl.position_raw.saturating_add(swap_data.game_amount);
        } else {
            pnl.out_mil = pnl.out_mil.saturating_add(usdc_value_mil);
            pnl.position_raw = pnl.position_raw.saturating_sub(swap_data.game_amount);
        }
    }

    fn handle_sync_swap(&mut self, swap_data: &SyncSwapEvent, prices: &PricesComponent) {
        let user = swap_data.user;
        if user == Public::zero() {
            return;
        }
        let usdc_value = from_sol_amount(swap_data.sol_amount) * prices.sol();
        let usdc_value_mil = usd_to_mil(usdc_value);

        let pnl = self
            .address_to_pnl_map
            .entry(swap_data.sync)
            .or_insert_with(HashMap::new)
            .entry(user)
            .or_insert(Pnl {
                in_mil: 0,
                out_mil: 0,
                position_raw: 0,
            });

        if swap_data.is_buy {
            pnl.in_mil = pnl.in_mil.saturating_add(usdc_value_mil);
            pnl.position_raw = pnl.position_raw.saturating_add(swap_data.token_amount);
        } else {
            pnl.out_mil = pnl.out_mil.saturating_add(usdc_value_mil);
            pnl.position_raw = pnl.position_raw.saturating_sub(swap_data.token_amount);
        }
    }

    pub fn query_pnl_lb(
        &self,
        game: Public,
        price: f32,
        count: usize,
        skip: usize,
        realized: bool,
    ) -> Vec<PnlEntry> {
        let pnl_map = match self.address_to_pnl_map.get(&game) {
            Some(v) => v,
            None => return Vec::new(),
        };

        let mut entries: Vec<PnlEntry> = pnl_map
            .iter()
            .map(|(&user, p)| PnlEntry {
                user,
                in_usd: mil_to_usd(p.in_mil),
                out_usd: mil_to_usd(p.out_mil),
                position: from_game_amount(p.position_raw),
            })
            .collect();

        if realized {
            entries.sort_by(|a, b| {
                let ratio_a = if a.in_usd > 0.0 {
                    a.out_usd / a.in_usd
                } else {
                    0.0
                };
                let ratio_b = if b.in_usd > 0.0 {
                    b.out_usd / b.in_usd
                } else {
                    0.0
                };
                ratio_b.total_cmp(&ratio_a)
            });
        } else {
            entries.sort_by(|a, b| {
                let out_a = a.out_usd + a.position * price;
                let out_b = b.out_usd + b.position * price;
                let ratio_a = if a.in_usd > 0.0 {
                    out_a / a.in_usd
                } else {
                    0.0
                };
                let ratio_b = if b.in_usd > 0.0 {
                    out_b / b.in_usd
                } else {
                    0.0
                };
                ratio_b.total_cmp(&ratio_a)
            });
        }

        if skip == 0 {
            entries.truncate(count);
            return entries;
        }
        if count == 0 || skip >= entries.len() {
            return Vec::new();
        }
        let left = skip;
        let right = (skip + count).min(entries.len());
        entries[left..right].to_vec()
    }

    pub fn get_pnl(&self, game: Public, user: Public, price: f32) -> PnlResponse {
        match self
            .address_to_pnl_map
            .get(&game)
            .and_then(|m| m.get(&user))
        {
            Some(p) => PnlResponse {
                in_usd: mil_to_usd(p.in_mil),
                out_usd: mil_to_usd(p.out_mil),
                position: from_game_amount(p.position_raw),
                price,
            },
            None => PnlResponse {
                in_usd: 0.0,
                out_usd: 0.0,
                position: 0.0,
                price,
            },
        }
    }
}
