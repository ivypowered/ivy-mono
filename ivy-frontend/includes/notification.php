<?php
/**
 * ivy-frontend/includes/notification.php
 *
 * Reusable component for displaying a game launch notification popup globally
 */

/**
 * Render the game launch notification
 *
 * @param array $game The game data to render
 * @return void Outputs HTML directly
 */
function notification_render($game) {
    // Extract and sanitize game data with fallback values to avoid errors
    $game_name = htmlspecialchars($game['name'] ?? 'Untitled Game');
    $image_url = !empty($game['icon_url']) 
        ? htmlspecialchars($game['icon_url']) 
        : '/assets/images/placeholder.png';
    $game_link = '/game/' . htmlspecialchars($game['address'] ?? '#');

    // Output the notification HTML
    ?>
    <div class="popup-container">
        <div class="new-game-popup">
            <img src="<?php echo $image_url; ?>" alt="<?php echo $game_name; ?>" class="new-game-popup-image" />
            <span><?php echo $game_name; ?> launched. <a href="<?php echo $game_link; ?>" class="text-emerald-950 hover:underline">Play</a></span>
        </div>
    </div>
    <script>
        // Remove popup after animation completes (3s total: 0.5s slideIn + 2s shaking + 0.5s fadeOut)
        setTimeout(() => {
            const popup = document.querySelector('.new-game-popup');
            if (popup) popup.remove();
        }, 3000);
    </script>
    <?php
}
?>
