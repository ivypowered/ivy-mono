<?php
/**
 * ivy-frontend/public/index.php
 *
 * Main landing page, displays lists of games fetched from the aggregator API.
 */

require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/game.php";
require_once __DIR__ . "/../includes/pagination.php";

// Determine which list to display based on query parameter
$active_tab = $_GET["tab"] ?? "hot";
$games = [];
$api_error = false; // Flag to track API errors

// Get the current page from the URL, default to 1 if not set
$current_page =
    isset($_GET["page"]) && is_numeric($_GET["page"]) ? (int) $_GET["page"] : 1;
$current_page = max(1, $current_page); // Ensure page is at least 1
$games_per_page = 20; // Number of games to show per page

// Define API endpoint based on the active tab
$sort = "";
switch ($active_tab) {
    case "new":
    case "top":
    case "hot":
        $sort = $active_tab;
        break;
    default:
        $sort = "hot";
        break;
}

// Calculate skip value for pagination
$skip = ($current_page - 1) * $games_per_page;

// Construct the API endpoint with query parameters
$query_params = http_build_query([
    "count" => $games_per_page, // Fetch games per page
    "skip" => $skip, // Skip based on current page
    "sort" => $sort,
]);
$full_endpoint = "/games?$query_params";

// Use the aggregator helper function to fetch game list
$fetched_games_data = call_aggregator($full_endpoint);

// Check if fetching failed
if ($fetched_games_data === null) {
    $games = [];
    $api_error = true;
    // Helper function logs details, maybe show a user message
    error_log(
        "Failed to fetch game data from aggregator API for tab: $active_tab",
    );
} else {
    // Ensure the response is an array (even if empty)
    $games = is_array($fetched_games_data) ? $fetched_games_data : [];
}

// For pagination we need to know the total count of games
// Ideally, the API would return total count information
// For now, we'll use a simple approach - if we get fewer games than requested,
// assume we're on the last page
$has_next_page = count($games) == $games_per_page;
$has_prev_page = $current_page > 1;

$title = "ivy | explore";
$description = "Explore the latest on Ivy: the gamecoin launchpad";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-7xl px-6">
        <!-- Navigation Pills -->
        <div class="flex gap-4 mt-8 mb-8 overflow-x-auto">
            <a href="?tab=hot" class="rounded-none <?php echo $active_tab ===
            "hot"
                ? "bg-emerald-400 text-emerald-950"
                : "border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950"; ?> px-6 py-2 font-bold whitespace-nowrap">Hot</a>
            <a href="?tab=new" class="rounded-none <?php echo $active_tab ===
            "new"
                ? "bg-emerald-400 text-emerald-950"
                : "border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950"; ?> px-6 py-2 font-bold whitespace-nowrap">New</a>
            <a href="?tab=top" class="rounded-none <?php echo $active_tab ===
            "top"
                ? "bg-emerald-400 text-emerald-950"
                : "border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950"; ?> px-6 py-2 font-bold whitespace-nowrap">Top</a>
        </div>

        <!-- Display API Error Message -->
        <?php if ($api_error): ?>
            <div class="border-2 border-red-400 bg-red-950/50 p-4 mb-8 text-center">
                <p class="text-red-400 font-bold">Could not load game data. Please try again later.</p>
            </div>
        <?php endif; ?>

        <!-- Games Grid -->
        <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <?php if (!$api_error && empty($games)): ?>
                <p class="text-zinc-400 col-span-full text-center">No games found for this category.</p>
            <?php elseif (!empty($games)): ?>
                <?php foreach ($games as $game): ?>
                    <?php game_render($game); ?>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Pagination -->
        <?php
        // Base URL for pagination, preserving the active tab
        $base_url = "?tab=" . $active_tab;

        // Only render pagination if we have data and no API errors
        if (!$api_error && !empty($games)) {
            render_pagination(
                $current_page,
                $has_prev_page,
                $has_next_page,
                $base_url,
            );
        }
        ?>
    </div>
</main>

<?php // Include footer

require_once __DIR__ . "/../includes/footer.php";
?>
