<?php
/**
 * ivy-frontend/public/about.php
 * Provides an about page for the service
 */

// Include API
require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

// Get global info from aggregator
$global_info = call_aggregator("/global-info");

// Game data for carousel
$featured_games = $global_info["featured_games"];

// Include header
$title = "ivy | about us";
$description =
    "Ivy is the single destination to play, build, and trade the next generation of games.";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="pb-16">
    <!-- Hero -->
    <section class="pt-8" style="background-image: url('/assets/images/ivy-background.webp');">
        <div class="mx-auto max-w-6xl px-6 pt-20 pb-16 xxs:pb-36 md:pb-40 text-center"">
            <h1 class="mb-6 text-5xl xs:text-6xl mx-auto leading-tight font-extrabold">
                Web3 gaming,<br>
                <span class="bg-emerald-400 text-emerald-950 px-3">radically simplified.</span>
            </h1>
            <p class="mx-auto mb-10 max-w-2xl text-xl text-white">
                Ivy is the single destination to play, build, and trade the next generation of games.
            </p>
            <div class="mb-12 flex flex-col sm:flex-row justify-center gap-6">
                <div class="border-2 border-emerald-400 p-6 min-w-[200px] backdrop-blur-sm bg-zinc-900/50">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">games live</div>
                    <div class="text-3xl font-bold" title="<?= number_format(
                        $global_info["games_listed"],
                    ) ?>">
                        <?= number_format($global_info["games_listed"]) ?>
                    </div>
                </div>
                <div class="border-2 border-emerald-400 p-6 min-w-[200px] backdrop-blur-sm bg-zinc-900/50">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">total value locked</div>
                    <div class="text-3xl font-bold" title="$<?= number_format(
                        $global_info["tvl"],
                    ) ?>">
                        $<?= fmt_number_short($global_info["tvl"]) ?>
                    </div>
                </div>
                <div class="border-2 border-emerald-400 p-6 min-w-[200px] backdrop-blur-sm bg-zinc-900/50">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">24h volume</div>
                    <div class="text-3xl font-bold" title="$<?= number_format(
                        $global_info["volume_24h"],
                    ) ?>">
                        $<?= fmt_number_short($global_info["volume_24h"]) ?>
                    </div>
                </div>
            </div>
        </div>
    </section>
    <!-- Player Experience -->
    <section class="w-full py-32">
        <div class="grid gap-12 lg:grid-cols-2 items-center max-w-6xl px-6 mx-auto">
            <!-- Text Content -->
            <div class="order-2 lg:order-1">
                <h2 class="text-4xl font-extrabold mb-6">Discover, play, and earn</h2>
                <p class="text-lg text-zinc-300 leading-normal">
                    Explore Ivy's vibrant ecosystem of games, where each game has its own digital token.
                    Earn tokens by playing, trade them on the open market, and cash out instantly
                    for real money.
                </p>
            </div>

            <!-- Game Carousel -->
            <div class="order-1 lg:order-2 relative w-full max-w-full overflow-hidden">
                <div class="game-carousel relative overflow-hidden">
                    <div class="flex" id="carousel-track">
                        <?php foreach ($featured_games as $index => $game): ?>
                        <div class="carousel-item w-full flex-shrink-0 px-2 box-border" data-index="<?= $index ?>">
                            <div class="block border-2 border-emerald-400 bg-zinc-900">
                                <!-- LINKED IMAGE AND TITLE -->
                                <a
                                    href="/game?address=<?= htmlspecialchars(
                                        $game["address"],
                                    ) ?>"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="game-link block group"
                                >
                                    <!-- IMAGE -->
                                    <div class="w-full h-48 bg-zinc-800 flex items-center justify-center overflow-hidden">
                                        <?php if (
                                            !empty($game["cover_image"])
                                        ): ?>
                                            <img src="<?= htmlspecialchars(
                                                $game["cover_image"],
                                            ) ?>"
                                                 alt="<?= htmlspecialchars(
                                                     $game["title"],
                                                 ) ?>"
                                                 class="object-cover w-full h-full" />
                                        <?php else: ?>
                                            <!-- fallback gradient if no image -->
                                            <div class="w-full h-full bg-gradient-to-br from-emerald-400/20 to-emerald-900/40"></div>
                                        <?php endif; ?>
                                    </div>
                                    <!-- TITLE -->
                                    <h3 class="text-xl sm:text-2xl font-bold text-white px-4 sm:px-6 pt-4 sm:pt-6 pb-2 truncate group-hover:underline"><?= htmlspecialchars(
                                        $game["title"],
                                    ) ?></h3>
                                </a>

                                <!-- NON-LINKED CONTENT -->
                                <div class="px-4 sm:px-6 pb-4 sm:pb-6">
                                    <div class="flex items-center justify-between gap-2">
                                        <div class="min-w-0">
                                            <div class="text-emerald-400 font-semibold text-base sm:text-lg truncate"><?= htmlspecialchars(
                                                $game["symbol"],
                                            ) ?></div>
                                            <div class="text-white text-xs sm:text-sm">$<?= $game[
                                                "price"
                                            ] >= 0.0001
                                                ? number_format(
                                                    $game["price"],
                                                    4,
                                                )
                                                : number_format(
                                                    $game["price"],
                                                    8,
                                                ) ?></div>
                                        </div>
                                        <div class="text-right min-w-0">
                                            <div class="text-zinc-400 text-xs uppercase tracking-wide">Market Cap</div>
                                            <div class="text-white font-semibold text-sm sm:text-base">$<?= fmt_number_short(
                                                $game["market_cap"],
                                            ) ?></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>

                    <!-- Indicators (still overlayed at bottom of carousel) -->
                    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                        <?php foreach ($featured_games as $index => $game): ?>
                        <button
                            class="carousel-indicator w-2 h-2 rounded-none <?= $index ===
                            0
                                ? "bg-emerald-400 w-6"
                                : "bg-zinc-600" ?>"
                            data-index="<?= $index ?>"
                            aria-label="Go to game <?= $index + 1 ?>"
                        ></button>
                        <?php endforeach; ?>
                    </div>
                </div>

                <!-- NAVIGATION BUTTONS BELOW CAROUSEL -->
                <div class="flex justify-center items-center gap-4 mt-4">
                    <button
                        id="carousel-prev"
                        class="bg-zinc-900/80 border border-emerald-400 text-emerald-400 p-2 hover:bg-emerald-400 hover:text-emerald-950"
                        aria-label="Previous game"
                    >
                        <?php echo icon(
                            "chevron-left",
                            "h-5 w-5 sm:h-6 sm:w-6",
                        ); ?>
                    </button>
                    <button
                        id="carousel-next"
                        class="bg-zinc-900/80 border border-emerald-400 text-emerald-400 p-2 hover:bg-emerald-400 hover:text-emerald-950"
                        aria-label="Next game"
                    >
                        <?php echo icon(
                            "chevron-right",
                            "h-5 w-5 sm:h-6 sm:w-6",
                        ); ?>
                    </button>
                </div>

                <!-- Fallback for missing images and mobile fixes -->
                <style>
                    .carousel-item > div {
                        background-color: #18181b;
                    }

                    /* Ensure carousel items respect container width */
                    .carousel-item {
                        min-width: 100%;
                    }

                    /* Prevent horizontal scroll on mobile */
                    @media (max-width: 640px) {
                        .game-carousel {
                            max-width: 100vw;
                        }
                    }
                </style>
            </div>
        </div>
    </section>
    <!-- Developer Experience -->
    <section class="w-full py-20 bg-zinc-800">
        <div class="grid gap-12 lg:grid-cols-2 items-center max-w-6xl px-6 mx-auto">
            <!-- API Visualization -->
            <div class="bg-zinc-900/50 border border-zinc-800 p-8">
                <div class="space-y-8">
                    <!-- Deposits -->
                    <div>
                        <div class="flex items-center mb-3">
                            <div class="bg-emerald-400/20 p-2 mr-3">
                                <?php echo icon(
                                    "book-plus",
                                    "h-6 w-6 text-emerald-400",
                                ); ?>
                            </div>
                            <h3 class="text-emerald-400 font-semibold text-lg uppercase tracking-wide">Deposits</h3>
                        </div>
                        <div class="bg-zinc-800/50 p-4 text-sm tracking-wide">
                            <span class="text-emerald-400">GET</span>
                            <span class="text-zinc-300 ml-3">/api/games/{game}/deposits/{id}</span>
                        </div>
                        <p class="text-zinc-500 text-sm mt-2">Check if a player has paid</p>
                    </div>

                    <!-- Withdrawals -->
                    <div>
                        <div class="flex items-center mb-3">
                            <div class="bg-emerald-400/20 p-2 mr-3">
                                <?php echo icon(
                                    "send",
                                    "h-6 w-6 text-emerald-400",
                                ); ?>
                            </div>
                            <h3 class="text-emerald-400 font-semibold text-lg uppercase tracking-wide">Withdrawals</h3>
                        </div>
                        <div class="bg-zinc-800/50 p-4 text-sm tracking-wide">
                            <span class="text-emerald-400">POST</span>
                            <span class="text-zinc-300 ml-2">/api/games/{game}/withdrawals/{id}</span>
                        </div>
                        <p class="text-zinc-500 text-sm mt-2">Send rewards to players</p>
                    </div>

                    <!-- Authentication -->
                    <div>
                        <div class="flex items-center mb-3">
                            <div class="bg-emerald-400/20 p-2 mr-3">
                                <?php echo icon(
                                    "shield-check",
                                    "h-6 w-6 text-emerald-400",
                                ); ?>
                            </div>
                            <h3 class="text-emerald-400 font-semibold text-lg uppercase tracking-wide">Authentication</h3>
                        </div>
                        <div class="bg-zinc-800/50 p-4 text-sm tracking-wide">
                            <span class="text-emerald-400">POST</span>
                            <span class="text-zinc-300 ml-2">/api/games/{game}/authenticate</span>
                        </div>
                        <p class="text-zinc-500 text-sm mt-2">Verify player identity</p>
                    </div>
                </div>
            </div>

            <!-- Text Content (unchanged) -->
            <div>
                <h2 class="text-4xl font-extrabold mb-6">The best developer experience of any web3 platform</h2>
                <p class="text-lg text-zinc-300 mb-8 leading-normal">
                    Forget complex SDKs, smart contracts, and vendor lock-in. With Ivy's simple REST API,
                    use any framework, any language to build your game.
                </p>
                <ul class="space-y-4 text-lg text-zinc-300">
                    <li class="flex items-start">
                        <div class="mr-3 mt-1 bg-emerald-400 p-1">
                            <?php echo icon(
                                "check",
                                "h-3 w-3 text-emerald-950",
                            ); ?>
                        </div>
                        Integrate web3 with just HTTP, no blockchain knowledge required.
                    </li>
                    <li class="flex items-start">
                        <div class="mr-3 mt-1 bg-emerald-400 p-1">
                            <?php echo icon(
                                "check",
                                "h-3 w-3 text-emerald-950",
                            ); ?>
                        </div>
                        Zero platform fees for API services: what your users pay is what you get.
                    </li>
                    <li class="flex items-start">
                        <div class="mr-3 mt-1 bg-emerald-400 p-1">
                            <?php echo icon(
                                "check",
                                "h-3 w-3 text-emerald-950",
                            ); ?>
                        </div>
                        Fully open-source, built to be improved by anyone.
                    </li>
                </ul>
            </div>
        </div>
    </section>
    <!-- Revenue Share -->
    <section class="w-full py-20">
        <div class="grid gap-12 lg:grid-cols-2 items-center max-w-6xl px-6 mx-auto">
            <!-- Text Content -->
            <div class="order-2 lg:order-1">
                <h2 class="text-4xl font-extrabold mb-6">Earn the highest revenue share of any launch platform</h2>
                <p class="text-lg text-zinc-300 leading-normal">
                    Each game launched on Ivy has its own token. When users trade your token, a 1% trading fee
                    is collected. Of that fee, 50% is awarded directly to you,
                    available for instant withdrawal. Our 50% revenue share is higher than any other launch platform.
                </p>
            </div>

            <div class="order-1 lg:order-2 bg-zinc-900/50 border border-zinc-800 p-8">
                <h3 class="text-center text-lg font-semibold mb-6 text-zinc-300">Distribution of 1% Trading Fee</h3>
                <!-- Changed to flex-col to stack the chart and legend vertically -->
                <div class="flex flex-col items-center justify-center gap-6">
                    <!-- Pie Chart Container -->
                    <div class="relative w-64 h-64 flex-shrink-0">
                        <!-- SVG updated for a solid pie chart with a left/right split -->
                        <svg
                            class="w-full h-full"
                            viewBox="0 0 232 232"
                            aria-hidden="false"
                            aria-label="Interactive chart"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <g
                                data-z-index="3"
                                aria-hidden="false"
                                style="stroke-width: 4; stroke-dasharray: none"
                            >
                                <g
                                    data-z-index=".1"
                                    aria-hidden="false"
                                    style="stroke-width: 4; stroke-dasharray: none"
                                    stroke="#fff"
                                    stroke-linejoin="round"
                                >
                                    <path
                                        fill="#1a3e33"
                                        d="M314.977 36a114 114 0 0 1 .114 228L315 150z"
                                        tabindex="-1"
                                        aria-label="Item 1, 50."
                                        style="
                                            fill-opacity: 0;
                                            stroke-width: 4;
                                            stroke-dasharray: none;
                                        "
                                        transform="translate(-199 -34)"
                                    />
                                    <path
                                        fill="#34d399"
                                        d="M314.977 264a114 114 0 0 1-.135-228L315 150z"
                                        tabindex="-1"
                                        aria-label="Item 3, 50."
                                        style="
                                            fill-opacity: 1;
                                            stroke-width: 4;
                                            stroke-dasharray: none;
                                        "
                                        transform="translate(-199 -34)"
                                    />
                                </g>
                            </g>
                        </svg>
                    </div>

                    <!-- Legend -->
                    <div class="space-y-3 w-full">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <div class="w-4 h-4 bg-emerald-400 mr-3"></div>
                                <span class="text-zinc-300">Developer rewards</span>
                            </div>
                            <span class="font-bold text-zinc-300">50%</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <div class="w-4 h-4 border-2 border-white box-border mr-3"></div>
                                <span class="text-zinc-300">Protocol burn</span>
                            </div>
                            <span class="font-bold text-zinc-300">50%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
    <!-- Tokenomics -->
    <section class="w-full py-40 bg-zinc-800">
        <div class="grid gap-12 lg:grid-cols-2 items-center max-w-6xl px-6 mx-auto">
            <!-- Visualization -->
            <div class="bg-zinc-900/50 border border-zinc-800 p-8">
                <div class="space-y-6 max-w-sm mx-auto">
                    <!-- Step 1 -->
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 bg-zinc-800 border-2 border-emerald-400 flex items-center justify-center flex-shrink-0">
                            <span class="text-2xl font-bold text-emerald-400">1%</span>
                        </div>
                        <p class="text-zinc-300">fee on every trade made on Ivy</p>
                    </div>

                    <!-- Arrow -->
                    <div class="pl-8">
                        <div class="w-0.5 h-8 bg-emerald-400"></div>
                    </div>

                    <!-- Step 2 -->
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 bg-zinc-800 border-2 border-emerald-400 flex items-center justify-center flex-shrink-0 tracking-tighter">
                            <span class="text-2xl font-bold text-emerald-400">1/2</span>
                        </div>
                        <p class="text-zinc-300">of fee used to buy back IVY</p>
                    </div>

                    <!-- Arrow -->
                    <div class="pl-8">
                        <div class="w-0.5 h-8 bg-emerald-400"></div>
                    </div>

                    <!-- Step 3 -->
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 bg-zinc-800 border-2 border-emerald-400 flex items-center justify-center flex-shrink-0">
                            <?php echo icon(
                                "flame",
                                "h-8 w-8 text-emerald-400",
                            ); ?>
                        </div>
                        <p class="text-zinc-300">Purchased IVY burned forever</p>
                    </div>
                </div>
            </div>

            <!-- Text Content -->
            <div>
                <h2 class="text-4xl font-extrabold mb-6">Sustainable, simple tokenomics</h2>
                <p class="text-lg text-zinc-300 leading-normal">
                    The IVY token is the utility token of the Ivy protocol. It has a fixed total supply -
                    no more IVY will ever be minted. A 1% fee is applied to every trade made
                    on Ivy. Of that fee, half is distributed to the game developer, and the other half
                    is used to purchase IVY off the open market and permanently remove it from circulation.
                    In this way, every trade made on Ivy increases the scarcity of the IVY token,
                    providing value to token holders.
                </p>
            </div>
        </div>
    </section>
    <!-- Call-to-Action -->
    <section class="w-full py-20 bg-zinc-900 text-center">
        <div class="max-w-6xl mx-auto px-6">
            <div class="mb-8">
                <img src="/assets/images/ivy_token_wc.webp" alt="IVY Token" class="mx-auto w-80 h-auto" />
            </div>

            <h2 class="text-4xl font-extrabold mb-6">Enter the future of gaming</h2>
            <p class="mx-auto mb-10 max-w-2xl text-lg text-zinc-300">
                Join other creators, players, and token holders in the Ivy ecosystem today.
            </p>

            <div class="flex flex-col sm:flex-row justify-center gap-4 mt-8">
              <a href="/docs" class="flex items-center gap-2 border-2 border-emerald-400 text-emerald-400 font-bold text-lg py-4 px-8 hover:bg-zinc-800 justify-center">
                <?php echo icon("book", "h-5 w-5 mr-2"); ?>
                Read the Docs
              </a>
              <a href="/" class="flex items-center gap-2 border-2 border-emerald-400 text-emerald-400 font-bold text-lg py-4 px-8 hover:bg-zinc-800 justify-center">
                <?php echo icon("compass", "h-5 w-5 mr-2"); ?>
                Explore Games
              </a>
              <a href="/token" class="flex items-center gap-2 border-2 border-emerald-400 text-emerald-400 font-bold text-lg py-4 px-8 hover:bg-zinc-800 justify-center">
                <?php echo icon("token", "h-5 w-5 mr-2"); ?>
                Buy IVY
              </a>
            </div>

        </div>
    </section>
</main>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const track = document.getElementById('carousel-track');
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    const indicators = document.querySelectorAll('.carousel-indicator');
    const items = document.querySelectorAll('.carousel-item');

    let currentIndex = 0;
    const totalItems = items.length;

    function updateCarousel(index) {
        // Update track position
        track.style.transform = `translateX(-${index * 100}%)`;

        // Update indicators
        indicators.forEach((indicator, i) => {
            if (i === index) {
                indicator.classList.add('bg-emerald-400', 'w-6');
                indicator.classList.remove('bg-zinc-600');
            } else {
                indicator.classList.remove('bg-emerald-400', 'w-6');
                indicator.classList.add('bg-zinc-600');
            }
        });

        currentIndex = index;
    }

    function goToNext() {
        const nextIndex = (currentIndex + 1) % totalItems;
        updateCarousel(nextIndex);
    }

    function goToPrev() {
        const prevIndex = (currentIndex - 1 + totalItems) % totalItems;
        updateCarousel(prevIndex);
    }

    // Button event listeners
    nextBtn.addEventListener('click', goToNext);
    prevBtn.addEventListener('click', goToPrev);

    // Indicator event listeners
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => updateCarousel(index));
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') goToPrev();
        if (e.key === 'ArrowRight') goToNext();
    });
});

// Get all sections you want to navigate between
const sections = document.querySelectorAll('section'); // or use a class like '.scroll-section'

// Track current section index
let currentSectionIndex = 0;

// Function to scroll to a specific section
function scrollToSection(index) {
    if (index == 0) {
        document.querySelector("body").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
    }
  if (index >= 0 && index < sections.length) {
    sections[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    currentSectionIndex = index;
  }
}

// Function to find which section is currently in view
function getCurrentSectionIndex() {
  const scrollPosition = window.scrollY + window.innerHeight / 2;

  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i].offsetTop <= scrollPosition) {
      return i;
    }
  }
  return 0;
}

// Listen for keyboard events
document.addEventListener('keydown', (e) => {
  // Update current section based on scroll position
  currentSectionIndex = getCurrentSectionIndex();

  if (e.key === 'PageUp') {
    e.preventDefault();
    scrollToSection(currentSectionIndex - 1);
  } else if (e.key === 'PageDown') {
    e.preventDefault();
    scrollToSection(currentSectionIndex + 1);
  }
});

// Optional: Update current section on regular scrolling
let scrollTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    currentSectionIndex = getCurrentSectionIndex();
  }, 100);
});
</script>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
