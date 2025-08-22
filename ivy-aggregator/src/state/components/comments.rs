use std::collections::HashMap;

use tokio::sync::broadcast;

use crate::types::event::{CommentEvent, Event, EventData};
use crate::types::public::Public;

use crate::state::constants::{HIDDEN_GAMES, HIDDEN_SYNCS};
use crate::state::types::Comment;

// 16 updates before receiver is deemed lagged
const CHANNEL_BUFFER_SIZE: usize = 16;

struct Comments {
    comments: Vec<Comment>,
    update_tx: Option<broadcast::Sender<Comment>>,
}

impl Comments {
    fn new() -> Self {
        Self {
            comments: Vec::new(),
            update_tx: None,
        }
    }

    /// Subscribe to comment updates for this asset
    fn subscribe(&mut self) -> broadcast::Receiver<Comment> {
        match &self.update_tx {
            None => {
                let (tx, rx) = broadcast::channel(CHANNEL_BUFFER_SIZE);
                self.update_tx = Some(tx);
                rx
            }
            Some(tx) => tx.subscribe(),
        }
    }

    /// Broadcast a new comment, dropping the channel if there are no receivers
    fn broadcast_comment(&mut self, comment: Comment) {
        if let Some(tx) = &self.update_tx {
            if tx.send(comment).is_err() {
                // No receivers, drop the channel to save memory
                self.update_tx = None;
            }
        }
    }
}

pub struct CommentsComponent {
    // Map from asset address to its comments
    asset_comments: HashMap<Public, Comments>,
}

impl CommentsComponent {
    pub fn new() -> Self {
        Self {
            asset_comments: HashMap::new(),
        }
    }

    /// Subscribe to real-time comment updates for a specific asset.
    /// Returns a receiver that will receive new `Comment` entries as they are posted.
    pub fn subscribe(&mut self, asset: &Public) -> broadcast::Receiver<Comment> {
        self.asset_comments
            .entry(*asset)
            .or_insert_with(Comments::new)
            .subscribe()
    }

    pub fn on_event(&mut self, event: &Event) -> bool {
        match &event.data {
            EventData::Comment(data) => {
                self.process_comment_event(data);
                true
            }
            _ => false,
        }
    }

    fn process_comment_event(&mut self, comment_data: &CommentEvent) {
        // Check if this asset is hidden (could be either a game or sync)
        if HIDDEN_GAMES.contains(&comment_data.game) || HIDDEN_SYNCS.contains(&comment_data.game) {
            return;
        }

        let asset_comments = self
            .asset_comments
            .entry(comment_data.game)
            .or_insert_with(Comments::new);

        let comment = Comment {
            index: comment_data.comment_index,
            user: comment_data.user,
            timestamp: comment_data.timestamp,
            text: comment_data.text.clone(),
        };

        // Broadcast the new comment
        asset_comments.broadcast_comment(comment.clone());

        asset_comments.comments.push(comment);
    }

    /// Get comment information for an asset
    pub fn get_comment_info(
        &self,
        asset: Public,
        count: usize,
        skip: usize,
        reverse: bool,
    ) -> (usize, Vec<Comment>) {
        let comments = match self.asset_comments.get(&asset) {
            Some(v) => v,
            None => return (0, Vec::new()),
        };

        let c = if reverse {
            comments
                .comments
                .iter()
                .rev()
                .skip(skip)
                .take(count)
                .cloned()
                .collect()
        } else {
            comments
                .comments
                .iter()
                .skip(skip)
                .take(count)
                .cloned()
                .collect()
        };

        let total = comments.comments.len();
        (total, c)
    }
}
