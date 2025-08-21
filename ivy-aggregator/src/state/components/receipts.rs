use std::collections::HashMap;

use crate::types::event::{Event, EventData, GameBurnEvent, GameDepositEvent, GameWithdrawEvent};
use crate::types::public::Public;

use crate::state::types::{BurnInfo, DepositInfo, WithdrawInfo};
use crate::types::signature::Signature;

#[derive(Hash, Clone, Copy, PartialEq, Eq)]
struct BurnKey {
    game: Public,
    id: [u8; 32],
}

#[derive(Hash, Clone, Copy, PartialEq, Eq)]
struct DepositKey {
    game: Public,
    id: [u8; 32],
}

#[derive(Hash, Clone, Copy, PartialEq, Eq)]
struct WithdrawKey {
    game: Public,
    id: [u8; 32],
}

pub struct ReceiptsComponent {
    burns: HashMap<BurnKey, BurnInfo>,
    deposits: HashMap<DepositKey, DepositInfo>,
    withdraws: HashMap<WithdrawKey, WithdrawInfo>,
}

impl ReceiptsComponent {
    pub fn new() -> Self {
        Self {
            burns: HashMap::new(),
            deposits: HashMap::new(),
            withdraws: HashMap::new(),
        }
    }

    pub fn on_event(&mut self, event: &Event) -> bool {
        match &event.data {
            EventData::GameBurn(data) => {
                self.process_game_burn(event.timestamp, &event.signature, data)
            }
            EventData::GameDeposit(data) => {
                self.process_game_deposit(event.timestamp, &event.signature, data)
            }
            EventData::GameWithdraw(data) => {
                self.process_game_withdraw(event.timestamp, &event.signature, data)
            }
            EventData::VaultDeposit(_) | EventData::VaultWithdraw(_) => {
                // Nothing yet, but let's keep them around in case
                // we want to do something in the future with them
            }
            _ => return false,
        }
        true
    }

    fn process_game_burn(&mut self, timestamp: u64, signature: &Signature, burn: &GameBurnEvent) {
        self.burns
            .entry(BurnKey {
                game: burn.game,
                id: burn.id,
            })
            .or_insert(BurnInfo {
                signature: signature.clone(),
                timestamp,
            });
    }

    fn process_game_deposit(
        &mut self,
        timestamp: u64,
        signature: &Signature,
        deposit: &GameDepositEvent,
    ) {
        self.deposits
            .entry(DepositKey {
                game: deposit.game,
                id: deposit.id,
            })
            .or_insert(DepositInfo {
                signature: signature.clone(),
                timestamp,
            });
    }

    fn process_game_withdraw(
        &mut self,
        timestamp: u64,
        signature: &Signature,
        withdraw: &GameWithdrawEvent,
    ) {
        self.withdraws
            .entry(WithdrawKey {
                game: withdraw.game,
                id: withdraw.id,
            })
            .or_insert(WithdrawInfo {
                signature: signature.clone(),
                timestamp,
                withdraw_authority: withdraw.withdraw_authority,
            });
    }

    pub fn get_burn_info(&self, game: Public, id: [u8; 32]) -> Option<BurnInfo> {
        self.burns.get(&BurnKey { game, id }).copied()
    }

    pub fn get_deposit_info(&self, game: Public, id: [u8; 32]) -> Option<DepositInfo> {
        self.deposits.get(&DepositKey { game, id }).copied()
    }

    pub fn get_withdraw_info(&self, game: Public, id: [u8; 32]) -> Option<WithdrawInfo> {
        self.withdraws.get(&WithdrawKey { game, id }).copied()
    }
}
