<?php
/**
 * ivy-frontend/public/index.php
 *
 * Main landing page, displays lists of games/assets fetched from the aggregator API.
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
$games_per_page = 60; // Number of games to show per page

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
$full_endpoint = "/assets?$query_params"; // Changed from /games to /assets

// Use the aggregator helper function to fetch asset list
$fetched_games_data = call_aggregator($full_endpoint);

// Check if fetching failed
if ($fetched_games_data === null) {
    $games = [];
    $api_error = true;
    error_log(
        "Failed to fetch asset data from aggregator API for tab: $active_tab",
    );
} else {
    // Ensure the response is an array (even if empty)
    $games = is_array($fetched_games_data) ? $fetched_games_data : [];
}

// For pagination we need to know the total count of games
// Simple heuristic: if we get fewer games than requested, assume last page
$has_next_page = count($games) == $games_per_page;
$has_prev_page = $current_page > 1;

// For React (hot/new tab tasks), we can expose a minimal list if needed later
$games_for_js = [];
if (!$api_error && !empty($games)) {
    $games_for_js = array_map(function ($g) {
        return [
            "address" => $g["address"] ?? "",
            "name" => $g["name"] ?? "Unknown",
            "symbol" => $g["symbol"] ?? "???",
            "icon_url" => $g["icon_url"] ?? "",
            "mkt_cap_usd" => $g["mkt_cap_usd"] ?? 0,
        ];
    }, $games);
}

$title = "ivy | explore";
$description = "Explore the latest on Ivy: the gamecoin launchpad";
require_once __DIR__ . "/../includes/header.php";
?>

<style>
/* --- Simple Trade Ticker with Flash --- */
:root {
  --ivy-green: 52, 211, 153;   /* rgb */
  --ivy-dark: 6, 78, 59;
  --zinc-700: 63, 63, 70;
  --zinc-800: 39, 39, 42;
}

.trade-ticker {
  position: relative;
  color: #34d399;
}

.trade-ticker:hover {
    color: #022c22 !important;
    background-color: #34d399 !important;
    border-color: #34d399 !important;
}

/* Active state - flashing emerald backgrounds */
.trade-ticker.active {
  animation: emerald-flash 600ms ease-out;
  color: rgb(var(--zinc-800));
}

@keyframes emerald-flash {
  0%   {
    background: #10b981; /* emerald-500 */
    border-color: #10b981; /* emerald-500 */
  }
  14%  {
    background: #34d399; /* emerald-400 */
    border-color: #34d399; /* emerald-400 */
  }
  28%  {
    background: #6ee7b7; /* emerald-300 */
    border-color: #6ee7b7; /* emerald-300 */
  }
  42%  {
    background: #059669; /* emerald-600 */
    border-color: #059669; /* emerald-600 */
  }
  56%  {
    background: #34d399; /* emerald-400 */
    border-color: #34d399; /* emerald-400 */
  }
  70%  {
    background: #10b981; /* emerald-500 */
    border-color: #10b981; /* emerald-500 */
  }
  85%  {
    background: #6ee7b7; /* emerald-300 */
    border-color: #6ee7b7; /* emerald-300 */
  }
  100% {
    background: rgb(var(--zinc-800));
    border-color: #34d399; /* back to emerald-400 */
  }
}

@keyframes emerald-fade {
  0%   {
    background: #6ee7b7; /* emerald-300 */
  }
  14%  {
    background: #34d399; /* emerald-400 */
  }
  28%  {
    background: #10b981; /* emerald-500 */
  }
  42%  {
    background: #6ee7b7; /* emerald-300 */
  }
  56%  {
    background: #34d399; /* emerald-400 */
  }
  70%  {
    background: #10b981; /* emerald-500 */
  }
  85%  {
    background: #059669; /* emerald-600 */
  }
  100% {
    background: rgb(var(--zinc-800));
  }
}

/* Game card bubble animation: apply to the inner card shell (.border-2) */
.game-card-bubble {
  animation: emerald-fade 600ms ease-out;
}

/* Dark text during bubble animation for readability */
.game-card-bubble .text-emerald-400,
.game-card-bubble .text-zinc-400 {
  color: rgb(6, 78, 59) !important; /* emerald-950 */
}

/* Reduced motion: simple fade */
@media (prefers-reduced-motion: reduce) {
  .trade-ticker.active {
    animation: simple-flash 300ms ease-out;
  }

  .game-card-bubble {
    animation: simple-flash 300ms ease-out;
  }

  @keyframes simple-flash {
    0%   {
      background: rgb(52, 211, 153);
      border-color: rgb(52, 211, 153);
    }
    100% {
      background: rgb(var(--zinc-800));
      border-color: rgb(52, 211, 153); /* back to emerald-400 */
    }
  }
}
</style>

<main class="py-8">
  <div class="mx-auto max-w-7xl px-6">
    <!-- Header with Navigation Pills and Trade Ticker -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
      <!-- Navigation Pills -->
      <div class="flex gap-4 overflow-x-auto">
        <a href="?tab=hot" class="rounded-none <?php echo $active_tab === "hot"
            ? "bg-emerald-400 text-emerald-950"
            : "border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950"; ?> px-6 py-2 font-bold whitespace-nowrap">Hot</a>
        <a href="?tab=new" class="rounded-none <?php echo $active_tab === "new"
            ? "bg-emerald-400 text-emerald-950"
            : "border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950"; ?> px-6 py-2 font-bold whitespace-nowrap">New</a>
        <a href="?tab=top" class="rounded-none <?php echo $active_tab === "top"
            ? "bg-emerald-400 text-emerald-950"
            : "border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950"; ?> px-6 py-2 font-bold whitespace-nowrap">Top</a>
      </div>

      <!-- Trade Ticker shell -->
      <div id="trade-ticker"
           class="trade-ticker px-3 py-2 text-sm border-emerald-400 border-2 bg-zinc-900 hidden"
           role="status" aria-live="polite">
      </div>
    </div>

    <!-- Display API Error Message -->
    <?php if ($api_error): ?>
      <div class="border-2 border-red-400 bg-red-950/50 p-4 mb-8 text-center">
        <p class="text-red-400 font-bold">Could not load asset data. Please try again later.</p>
      </div>
    <?php endif; ?>

    <!-- Games Grid shell (server-rendered list + React will enhance it) -->
    <div id="games-grid" class="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
      <?php if (!$api_error && empty($games)): ?>
        <p class="text-zinc-400 col-span-full text-center">No assets found for this category.</p>
      <?php elseif (!empty($games)): ?>
        <?php foreach ($games as $game): ?>
          <?php game_render($game); ?>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>

    <!-- Pagination -->
    <?php
    $base_url = "?tab=$active_tab";
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

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
