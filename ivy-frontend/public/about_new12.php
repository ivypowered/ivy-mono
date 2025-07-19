<?php
/**
 * ivy-frontend/public/about_new.php
 * A new about page capturing Ivy's investment thesis and value proposition for developers, players, and investors.
 */

// Include API & helpers
require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

// Placeholder data to reflect a growing platform
$global_info = [
    "games_launched" => 137,
    "tvl" => 1_250_000,
    "volume_24h" => 85_600,
];

// Page metadata
$title = "Ivy | Web3 Gaming, Radically Simplified";
$description =
    "Ivy makes it possible for any developer, using any engine, to launch a Web3 game in a weekend. Discover our investment thesis and why we're the future of on-chain gaming.";
require_once __DIR__ . "/../includes/header.php";
?>

<!-- Section 1: Hero -->
<main class="pt-8" style="background-image: url('/assets/images/ivy-background.webp'); background-position: top; background-size: cover;">
    <div class="mx-auto max-w-7xl px-6">
        <section class="py-20 text-center">
            <h1 class="mb-6 text-5xl md:text-6xl font-bold leading-tight">
                Web3 Gaming,<br>
                <span class="bg-emerald-400 text-emerald-950 px-4 py-1">Radically Simplified.</span>
            </h1>
            <p class="mx-auto mb-10 max-w-2xl text-xl text-zinc-300">
                A simple REST API to build blockchain-powered games. No smart contracts, no complex SDKs, no limits.
            </p>
            <div class="mb-12 flex flex-wrap justify-center gap-6">
                <div class="border-2 border-emerald-400 p-6 min-w-[200px]">
                    <div class="text-sm text-emerald-400">GAMES LAUNCHED</div>
                    <div class="text-3xl font-bold"><?php echo number_format(
                        $global_info["games_launched"]
                    ); ?></div>
                </div>
                <div class="border-2 border-emerald-400 p-6 min-w-[200px]">
                    <div class="text-sm text-emerald-400">TOTAL VALUE LOCKED</div>
                    <div class="text-3xl font-bold">$<?php echo fmt_number_short(
                        $global_info["tvl"]
                    ); ?></div>
                </div>
                <div class="border-2 border-emerald-400 p-6 min-w-[200px]">
                    <div class="text-sm text-emerald-400">24H VOLUME</div>
                    <div class="text-3xl font-bold">$<?php echo fmt_number_short(
                        $global_info["volume_24h"]
                    ); ?></div>
                </div>
            </div>
            <div class="flex flex-wrap justify-center gap-4">
                <a href="/token" class="rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-8 py-3 text-lg w-full sm:w-auto">
                    View Tokenomics
                </a>
                <a href="#solution" class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold px-8 py-3 text-lg w-full sm:w-auto">
                    How It Works
                </a>
            </div>
        </section>
    </div>
</main>

<main class="py-20 bg-zinc-950">
    <div class="mx-auto max-w-7xl px-6 space-y-24">

        <!-- Section 2: The Potential -->
        <section class="text-center">
            <h2 class="text-3xl md:text-4xl font-bold mb-4">The Next Frontier of Gaming is Here</h2>
            <p class="text-zinc-400 mx-auto max-w-3xl mb-12">Players want to own their digital lives. The demand for on-chain assets and true ownership has created a market poised for exponential growth.</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div class="border border-zinc-800 p-6">
                    <div class="text-5xl font-bold text-emerald-400">$23B</div>
                    <div class="text-zinc-300">Web3 Gaming Market Size</div>
                </div>
                <div class="border border-zinc-800 p-6">
                    <div class="text-5xl font-bold text-emerald-400">68%</div>
                    <div class="text-zinc-300">Compound Annual Growth Rate</div>
                </div>
                <div class="border border-zinc-800 p-6">
                    <div class="text-5xl font-bold text-emerald-400">$54B</div>
                    <div class="text-zinc-300">Spent on In-Game Assets Annually</div>
                </div>
            </div>
            <p class="text-xl text-white font-semibold">But <span class="text-red-500">99% of developers</span> are locked out.</p>
        </section>

        <!-- Section 3: The Problem -->
        <section>
            <div class="text-center mb-12">
                <h2 class="text-3xl md:text-4xl font-bold mb-4">The Walled Garden of Web3</h2>
                <p class="text-zinc-400 mx-auto max-w-3xl">Until now, building a Web3 game meant facing insurmountable complexity, cost, and risk. Only the largest studios could even try.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <div class="border-2 border-red-500/50 p-6">
                    <h3 class="font-bold text-xl mb-4 text-red-400">The Old Way (Immutable, etc.)</h3>
                    <ul class="space-y-3 text-zinc-300">
                        <li class="flex items-center gap-3"><?php echo icon(
                            "x-circle",
                            "h-5 w-5 text-red-500"
                        ); ?> 6+ Month Integration Times</li>
                        <li class="flex items-center gap-3"><?php echo icon(
                            "x-circle",
                            "h-5 w-5 text-red-500"
                        ); ?> Complex, Engine-Specific SDKs</li>
                        <li class="flex items-center gap-3"><?php echo icon(
                            "x-circle",
                            "h-5 w-5 text-red-500"
                        ); ?> $100k+ Smart Contract Audits</li>
                        <li class="flex items-center gap-3"><?php echo icon(
                            "x-circle",
                            "h-5 w-5 text-red-500"
                        ); ?> High Risk of Vulnerable Code</li>
                        <li class="flex items-center gap-3"><?php echo icon(
                            "x-circle",
                            "h-5 w-5 text-red-500"
                        ); ?> Vendor Lock-In</li>
                    </ul>
                </div>
                <div class="border-2 border-emerald-500/50 p-6">
                    <h3 class="font-bold text-xl mb-4 text-emerald-400">The Ivy Way</h3>
                     <ul class="space-y-3 text-zinc-300">
                        <li class="flex items-center gap-3"><?php echo icon(
                            "check-circle-2",
                            "h-5 w-5 text-emerald-500"
                        ); ?> Weekend Integration</li>
                        <li class="flex items-center gap-3"><?php echo icon(
                            "check-circle-2",
                            "h-5 w-5 text-emerald-500"
                        ); ?> Simple REST API (Any Engine)</li>
                        <li class="flex items-center gap-3"><?php echo icon(
                            "check-circle-2",
                            "h-5 w-5 text-emerald-500"
                        ); ?> Zero Smart Contract Work</li>
                        <li class="flex items-center gap-3"><?php echo icon(
                            "check-circle-2",
                            "h-5 w-5 text-emerald-500"
                        ); ?> Secure by Design</li>
                        <li class="flex items-center gap-3"><?php echo icon(
                            "check-circle-2",
                            "h-5 w-5 text-emerald-500"
                        ); ?> Maximum Flexibility</li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- Section 4: The Solution -->
        <section id="solution">
            <div class="text-center mb-12">
                <h2 class="text-3xl md:text-4xl font-bold mb-4">Our Solution: Three API Endpoints</h2>
                <p class="text-zinc-400 mx-auto max-w-3xl">We've distilled all the complexity of Web3 into its essential components. If you can make an HTTP request, you can build an on-chain game.</p>
            </div>
            <div class="bg-zinc-900 border border-zinc-800 p-6 max-w-3xl mx-auto font-mono text-sm text-zinc-300">
                <div class="mb-4">
                    <span class="text-green-400">POST</span> /authenticate <span class="text-zinc-500"># Log a user in via their wallet</span>
                </div>
                <div class="mb-4">
                    <span class="text-green-400">GET</span> /deposits/{id} <span class="text-zinc-500"># Verify a player's payment</span>
                </div>
                <div>
                    <span class="text-green-400">POST</span> /withdrawals/{id} <span class="text-zinc-500"># Sign a reward payout to a user</span>
                </div>
            </div>
             <p class="text-center mt-6 text-zinc-400">Any Language. Any Engine. Launch in hours, not months.</p>
        </section>

        <!-- Section 5: Business Model -->
        <section>
            <div class="text-center mb-12">
                <h2 class="text-3xl md:text-4xl font-bold mb-4">A Self-Sustaining Flywheel</h2>
                <p class="text-zinc-400 mx-auto max-w-3xl">Our business model aligns incentives for everyone. Every game that succeeds makes the entire Ivy ecosystem more valuable.</p>
            </div>
            <div class="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-center max-w-5xl mx-auto">
                <div class="border border-zinc-800 p-6 flex-grow w-full md:w-auto">
                    <h4 class="text-lg font-bold">Player Trades Tokens</h4>
                    <p class="text-zinc-400 text-sm">A 1% fee is applied to every trade on the Ivy Marketplace.</p>
                </div>
                <?php echo icon(
                    "arrow-right",
                    "h-8 w-8 text-zinc-600 hidden md:block"
                ); ?>
                <?php echo icon(
                    "arrow-down",
                    "h-8 w-8 text-zinc-600 md:hidden"
                ); ?>
                <div class="border border-zinc-800 p-6 flex-grow w-full md:w-auto">
                    <h4 class="text-lg font-bold">50% to Developer</h4>
                    <p class="text-zinc-400 text-sm">Directly rewards developers for creating engaging games people want to play.</p>
                </div>
                <?php echo icon(
                    "arrow-right",
                    "h-8 w-8 text-zinc-600 hidden md:block"
                ); ?>
                <?php echo icon(
                    "arrow-down",
                    "h-8 w-8 text-zinc-600 md:hidden"
                ); ?>
                <div class="border-2 border-emerald-400 p-6 flex-grow w-full md:w-auto">
                    <h4 class="text-lg font-bold text-emerald-400">50% to Burn IVY</h4>
                    <p class="text-zinc-400 text-sm">Fee is used to buy IVY and permanently burn it, increasing token scarcity.</p>
                </div>
            </div>
        </section>

        <!-- Section 6: Final CTA -->
        <section>
            <div class="text-center mb-12">
                <h2 class="text-3xl md:text-4xl font-bold mb-4">Join the Revolution</h2>
                <p class="text-zinc-400 mx-auto max-w-3xl">Whether you're an investor, a developer, or a player, there's a place for you in the future of gaming.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="border-2 border-emerald-400/50 p-8 text-center flex flex-col">
                    <?php echo icon(
                        "trending-up",
                        "h-10 w-10 text-emerald-400 mx-auto mb-4"
                    ); ?>
                    <h3 class="text-2xl font-bold mb-2">For Investors</h3>
                    <p class="text-zinc-300 mb-6 flex-grow">Understand the tokenomics and the powerful value accrual mechanism that drives Ivy's growth.</p>
                    <a href="/token" class="mt-auto rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-8 py-3 w-full">View Tokenomics</a>
                </div>
                 <div class="border-2 border-emerald-400/50 p-8 text-center flex flex-col">
                    <?php echo icon(
                        "code",
                        "h-10 w-10 text-emerald-400 mx-auto mb-4"
                    ); ?>
                    <h3 class="text-2xl font-bold mb-2">For Developers</h3>
                    <p class="text-zinc-300 mb-6 flex-grow">Stop wrestling with complexity. Ship your first on-chain game this weekend and start earning.</p>
                    <a href="/docs" class="mt-auto rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-8 py-3 w-full">Start Building</a>
                </div>
                 <div class="border-2 border-emerald-400/50 p-8 text-center flex flex-col">
                    <?php echo icon(
                        "gamepad-2",
                        "h-10 w-10 text-emerald-400 mx-auto mb-4"
                    ); ?>
                    <h3 class="text-2xl font-bold mb-2">For Players</h3>
                    <p class="text-zinc-300 mb-6 flex-grow">Discover unique games with real, player-driven economies. Your time and progress finally have value.</p>
                    <a href="/" class="mt-auto rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-8 py-3 w-full">Explore Games</a>
                </div>
            </div>
        </section>

    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php";
?>
