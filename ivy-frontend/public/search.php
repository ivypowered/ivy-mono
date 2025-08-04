<?php
/**
 * ivy-frontend/public/search.php
 *
 * Displays search results for games based on a query parameter.
 * Redirects if the query is a valid game address.
 */

require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/game.php";
require_once __DIR__ . "/../includes/icon.php";
require_once __DIR__ . "/../includes/pagination.php";

// --- Input Handling ---
$search_query_raw = isset($_GET["q"]) ? trim($_GET["q"]) : "";
$search_query_safe = htmlspecialchars($search_query_raw); // For display
$sort = isset($_GET["sort"]) && $_GET["sort"] === "new" ? "new" : "top"; // Default to "top" if not specified or invalid

// --- Address Check ---
if (!empty($search_query_raw)) {
    $address_check_result = call_aggregator(
        "/validate/address/" . urlencode($search_query_raw),
        "GET",
    );

    if ($address_check_result === true) {
        header("Location: /game?address=" . urlencode($search_query_raw));
        exit();
    }
}

// --- Pagination Handling ---
$results_per_page = 20;
$current_page = max(1, isset($_GET["page"]) ? (int) $_GET["page"] : 1);
$skip = ($current_page - 1) * $results_per_page;

// --- Data Fetching ---
$games = [];
$ivy_price = 0;
$api_error = false;

// Fetch IVY price
$ivy_price_data = call_aggregator("/ivy/price", "GET");
if ($ivy_price_data !== null && is_numeric($ivy_price_data)) {
    $ivy_price = $ivy_price_data;
} else {
    error_log("Failed to fetch IVY price for search page.");
}

// Fetch Search Results if query is not empty
if (!empty($search_query_raw)) {
    $search_params = http_build_query([
        "q" => $search_query_raw,
        "count" => $results_per_page,
        "skip" => $skip,
        "sort" => $sort,
    ]);

    $fetched_games_data = call_aggregator("/games?" . $search_params, "GET");

    if ($fetched_games_data === null) {
        $api_error = true;
        error_log(
            "Failed to fetch search results for query: " . $search_query_raw,
        );
    } else {
        $games = is_array($fetched_games_data) ? $fetched_games_data : [];
    }
}

// --- Page Rendering ---
$title = "ivy | search: $search_query_raw";
$description = "View search results on Ivy: the gamecoin launchpad";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-7xl px-6">
        <!-- Search Results Header -->
        <div class="mb-8">
            <?php if (!empty($search_query_safe)): ?>
                <h1 class="text-3xl font-bold mb-1 text-white">Search Results</h1>
                <p class="text-xl text-zinc-300 mb-6">
                    Showing results for <span class="font-bold text-emerald-400">"<?php echo $search_query_safe; ?>"</span>
                </p>

                <div class="flex flex-wrap items-center gap-2 mb-6">
                    <span class="text-md font-bold text-zinc-400 mr-1">Sort by:</span>
                    <a href="?q=<?php echo urlencode(
                        $search_query_raw,
                    ); ?>&sort=top"
                       class="rounded-none inline-flex gap-2 px-4 py-1 font-mono text-sm font-bold whitespace-nowrap
                              <?php echo $sort === "top" || empty($sort)
                                  ? "bg-emerald-400 text-emerald-950 border-2 border-emerald-400"
                                  : "border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950"; ?>">
                        <?php echo icon("list-filter", "h-4 w-4 mt-[1px]"); ?>
                        <span>Market Cap</span>
                    </a>
                    <a href="?q=<?php echo urlencode(
                        $search_query_raw,
                    ); ?>&sort=new"
                       class="rounded-none inline-flex gap-2 px-4 py-1 font-mono text-sm font-bold whitespace-nowrap
                              <?php echo $sort === "new"
                                  ? "bg-emerald-400 text-emerald-950 border-2 border-emerald-400"
                                  : "border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950"; ?>">
                        <?php echo icon("clock", "h-4 w-4 mt-[1px]"); ?>
                        <span>Recency</span>
                    </a>
                </div>

                <div class="border-b-2 border-emerald-400 mb-6"></div>

            <?php else: ?>
                <h1 class="text-2xl font-bold mb-4 text-emerald-400">Search Games</h1>
                <p class="text-zinc-400 mb-6 text-lg">Please enter a term in the search bar above to find games.</p>
                <div class="border-b-2 border-emerald-400 mb-6"></div>
            <?php endif; ?>
        </div>

        <!-- Display API Error Message -->
        <?php if ($api_error): ?>
            <div class="border-2 border-red-400 bg-red-950/50 p-4 mb-8 text-center">
                <p class="text-red-400 font-bold">Could not load search results. Please try again later.</p>
            </div>
        <?php endif; ?>

        <!-- Games Grid -->
        <div class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <?php if (
                !$api_error &&
                empty($games) &&
                !empty($search_query_raw)
            ): ?>
                <p class="text-zinc-400 col-span-full text-center">No games found matching your search.</p>
            <?php elseif (!empty($games)): ?>
                <?php foreach ($games as $game): ?>
                    <?php game_render($game, $ivy_price); ?>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Pagination -->
        <?php
        $show_prev = $current_page > 1;
        $show_next = count($games) == $results_per_page;
        $prev_page = $current_page - 1;
        $next_page = $current_page + 1;

        // Build base URL for pagination
        $base_url = "?q=" . urlencode($search_query_raw) . "&sort=" . $sort;

        // Render pagination component
        render_pagination($current_page, $show_prev, $show_next, $base_url);
        ?>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
