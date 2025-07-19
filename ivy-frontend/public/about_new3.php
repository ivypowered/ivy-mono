<?php
/**
 * ivy-frontend/public/about_new.php
 *
 * A fresh “About” page that explains Ivy’s mission and value proposition
 * to PLAYERS, DEVELOPERS, and INVESTORS in one place.
 *
 * It re-uses your global stats array; replace the mock values with a real
 * aggregator call when ready.
 */

// ---------------------------------------------------------------------
// 1.  Data & helpers
// ---------------------------------------------------------------------
require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

/*
// Example aggregator call (uncomment when available)
$global_info = call_aggregator("/global-info");
*/
$global_info = [
    "games_listed" => 0,
    "tvl" => 0,
    "volume_24h" => 0,
];

// ---------------------------------------------------------------------
// 2.  Meta tags
// ---------------------------------------------------------------------
$title = "ivy | about";
$description =
    "Web3 game dev, radically simplified. Learn why players, developers, and investors choose Ivy.";
require_once __DIR__ . "/../includes/header.php";
?>

<!-- ------------------------------------------------------------------
     HERO
------------------------------------------------------------------- -->
<main class="pt-16" style="background-image:url('/assets/images/ivy-background.webp')">
    <div class="mx-auto max-w-7xl px-6">
        <section class="pt-24 pb-36 text-center">
            <h1 class="mb-6 text-6xl font-black leading-tight">
                <span class="bg-emerald-400 text-emerald-950 px-4">ivy</span>
                is&nbsp;where&nbsp;web3&nbsp;games come alive
            </h1>
            <p class="mx-auto mb-12 max-w-3xl text-xl text-zinc-300">
                We turn blockchain complexity into three simple endpoints—<strong>deposit</strong>,
                <strong>withdraw</strong>, and <strong>authenticate</strong>. Build a Web3 game in a weekend,
                launch in a click, and share revenue from day one.
            </p>

            <!-- Global Numbers -->
            <div class="flex flex-wrap justify-center gap-8">
                <?php
                $stats = [
                    [
                        "label" => "games listed",
                        "value" => number_format($global_info["games_listed"]),
                    ],
                    [
                        "label" => "total value locked",
                        "value" => "$" . fmt_number_short($global_info["tvl"]),
                    ],
                    [
                        "label" => "24h volume",
                        "value" =>
                            "$" . fmt_number_short($global_info["volume_24h"]),
                    ],
                ];
                foreach ($stats as $s): ?>
                    <div class="min-w-[220px] border-2 border-emerald-400 p-6">
                        <div class="text-sm text-emerald-400 uppercase tracking-wide"><?= $s[
                            "label"
                        ] ?></div>
                        <div class="text-3xl font-bold"><?= $s["value"] ?></div>
                    </div>
                <?php endforeach;
                ?>
            </div>
        </section>
    </div>
</main>

<!-- ------------------------------------------------------------------
     THREE AUDIENCES
------------------------------------------------------------------- -->
<main class="pb-10">
    <div class="mx-auto max-w-7xl px-6">

        <!-- PLAYERS ---------------------------------------------------------------->
        <section class="mb-28">
            <div class="md:grid md:grid-cols-2 md:gap-12 items-center">
                <div class="mb-10 md:mb-0">
                    <h2 class="text-4xl font-bold mb-4 text-emerald-400">for players</h2>
                    <p class="text-zinc-300 mb-6">
                        Own your progress. Every Ivy game issues its own on-chain token—earn it in-game,
                        trade it in the Ivy Marketplace, or cash out instantly.
                    </p>
                    <ul class="space-y-4 text-zinc-200">
                        <li><?= icon(
                            "check",
                            "inline-block h-5 w-5 text-emerald-400 mr-2"
                        ) ?>True asset ownership</li>
                        <li><?= icon(
                            "check",
                            "inline-block h-5 w-5 text-emerald-400 mr-2"
                        ) ?>Low fees, instant swaps</li>
                        <li><?= icon(
                            "check",
                            "inline-block h-5 w-5 text-emerald-400 mr-2"
                        ) ?>No wallets required up-front—guest mode supported</li>
                    </ul>
                </div>
                <img src="/assets/images/about_players.webp" alt="Players enjoying games" class="rounded-none border-2 border-emerald-400">
            </div>
        </section>

        <!-- DEVELOPERS ------------------------------------------------------------->
        <section class="mb-28">
            <div class="md:grid md:grid-cols-2 md:gap-12 items-center">
                <img src="/assets/images/about_devs.webp" alt="Developers coding" class="rounded-none border-2 border-emerald-400 mb-10 md:mb-0">
                <div>
                    <h2 class="text-4xl font-bold mb-4 text-emerald-400">for developers</h2>
                    <p class="text-zinc-300 mb-6">
                        Ship faster with the world’s simplest Web3 toolkit:
                        a language-agnostic REST API and three endpoints.
                    </p>
                    <ul class="space-y-4 text-zinc-200">
                        <li><?= icon(
                            "terminal",
                            "inline-block h-5 w-5 text-emerald-400 mr-2"
                        ) ?>No contract audits, no engine lock-in</li>
                        <li><?= icon(
                            "code-2",
                            "inline-block h-5 w-5 text-emerald-400 mr-2"
                        ) ?>Drop-in auth, deposits & withdrawals</li>
                        <li><?= icon(
                            "coins",
                            "inline-block h-5 w-5 text-emerald-400 mr-2"
                        ) ?>Earn <strong>50%</strong> of every marketplace trade</li>
                    </ul>
                    <div class="mt-8 flex flex-wrap gap-4">
                        <a href="/docs"   class="bg-emerald-400 text-emerald-950 font-bold px-8 py-3 hover:bg-emerald-300">read the docs</a>
                        <a href="/upload" class="border-2 border-emerald-400 text-emerald-400 font-bold px-8 py-3 hover:bg-emerald-400 hover:text-emerald-950">upload a game</a>
                    </div>
                </div>
            </div>
        </section>

        <!-- INVESTORS -------------------------------------------------------------->
        <section class="mb-40">
            <div class="md:grid md:grid-cols-2 md:gap-12 items-center">
                <div class="mb-10 md:mb-0">
                    <h2 class="text-4xl font-bold mb-4 text-emerald-400">for investors</h2>
                    <p class="text-zinc-300 mb-6">
                        Ivy is positioned to unlock the long-tail of indie game
                        creators—an addressable market of <em>millions</em> of titles
                        that traditional Web3 stacks can’t reach.
                    </p>
                    <ul class="space-y-4 text-zinc-200">
                        <li><?= icon(
                            "chart-bar",
                            "inline-block h-5 w-5 text-emerald-400 mr-2"
                        ) ?>1% fee on every trade, auto-split &nbsp;(<strong>developer + protocol</strong>)</li>
                        <li><?= icon(
                            "fire",
                            "inline-block h-5 w-5 text-emerald-400 mr-2"
                        ) ?>50% of fees buy & burn <strong>IVY</strong>, driving scarcity</li>
                        <li><?= icon(
                            "globe",
                            "inline-block h-5 w-5 text-emerald-400 mr-2"
                        ) ?>REST-first design scales beyond niche gaming engines</li>
                    </ul>
                </div>
                <img src="/assets/images/about_investors.webp" alt="Investor chart" class="rounded-none border-2 border-emerald-400">
            </div>
        </section>

        <!-- CALL TO ACTION --------------------------------------------------------->
        <section class="mb-20">
            <div class="border-4 border-emerald-400 p-14 text-center">
                <h2 class="text-4xl font-bold mb-4">build. play. own.</h2>
                <p class="mx-auto mb-10 max-w-2xl text-zinc-300">
                    Join the creators who are redefining gaming economies with Ivy.
                </p>
                <div class="flex flex-wrap justify-center gap-4">
                    <a href="/upload" class="bg-emerald-400 text-emerald-950 font-bold px-10 py-3 hover:bg-emerald-300">launch a game</a>
                    <a href="/" class="border-2 border-emerald-400 text-emerald-400 font-bold px-10 py-3 hover:bg-emerald-400 hover:text-emerald-950">start playing</a>
                    <a href="/pitch-deck.pdf" target="_blank" class="border-2 border-emerald-400 text-emerald-400 font-bold px-10 py-3 hover:bg-emerald-400 hover:text-emerald-950">view pitch&nbsp;deck</a>
                </div>
            </div>
        </section>

    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
