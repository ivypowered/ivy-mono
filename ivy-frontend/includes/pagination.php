<?php
/**
 * ivy-frontend/includes/pagination.php
 *
 * Reusable pagination component for search results and listings
 *
 * @param int $current_page Current page number
 * @param bool $show_prev Whether to show previous page button
 * @param bool $show_next Whether to show next page button
 * @param string $base_url Base URL for pagination links (without page parameter)
 */

function render_pagination($current_page, $show_prev, $show_next, $base_url)
{
    if (!$show_prev && !$show_next) {
        return; // Don't render pagination if no navigation is needed
    }

    $prev_page = $current_page - 1;
    $next_page = $current_page + 1;
    require_once __DIR__ . "/icon.php";
    ?>
    <div class="mt-8 flex justify-center items-center gap-2">
        <?php if ($show_prev): ?>
            <a href="<?php echo $base_url; ?>&page=<?php echo $prev_page; ?>"
               class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 w-10 h-10 flex items-center justify-center"
               aria-label="Previous Page">
                <?php echo icon("chevron-left", "h-4 w-4"); ?>
            </a>
            <a href="<?php echo $base_url; ?>&page=<?php echo $prev_page; ?>"
               class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 w-10 h-10 flex items-center justify-center">
                <?php echo $prev_page; ?>
            </a>
        <?php endif; ?>

        <span class="rounded-none bg-emerald-400 text-emerald-950 w-10 h-10 flex items-center justify-center font-bold">
            <?php echo $current_page; ?>
        </span>

        <?php if ($show_next): ?>
            <a href="<?php echo $base_url; ?>&page=<?php echo $next_page; ?>"
               class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 w-10 h-10 flex items-center justify-center">
                <?php echo $next_page; ?>
            </a>
            <a href="<?php echo $base_url; ?>&page=<?php echo $next_page; ?>"
               class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 w-10 h-10 flex items-center justify-center"
               aria-label="Next Page">
                <?php echo icon("chevron-right", "h-4 w-4"); ?>
            </a>
        <?php endif; ?>
    </div>
<?php
}
?>
