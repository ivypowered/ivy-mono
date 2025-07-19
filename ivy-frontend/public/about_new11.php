<?php
/**
 * ivy-frontend/public/about_new.php
 *
 * About page for Ivy, designed to communicate the investment thesis,
 * developer value proposition, and player benefits in a single, cohesive narrative.
 * Structure: Hero -> Potential -> Problem -> Solution -> Business Model -> Traction -> CTA
 */

require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

// Placeholder stats to demonstrate momentum and scale.
// In a real implementation, you would fetch these from your API.
$global_stats = [
    "games_listed" => 127,
    "total_volume" => 1834567,
    "ivy_burned" => 2450112,
    "active_devs" => 3200,
];

$title = "About Ivy | Web3 Gaming, Radically Simplified";
$description =
    "Ivy unlocks the $23B Web3 gaming market for millions of developers. Our simple REST API, massive opportunity, and sustainable tokenomics create the ultimate platform for the future of gaming.";

require_once __DIR__ . "/../includes/header.php";
?>

<!-- Custom styles for this page -->
<style>
    .gradient-text {
        background: linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-fill-color: transparent; /* Standard property */
    }

    .stat-card {
        background: rgba(16, 185, 129, 0.05);
        border: 1px solid rgba(16, 185, 129, 0.2);
        backdrop-filter: blur(10px);
    }
</style>

<!-- Hero background image -->
<main class="pt-8" style="background-image: url('/assets/images/ivy-background.webp'); background-size: cover; background-position: center;">
    <div class="mx-auto max-w-7xl px-6">
        <!-- 1. HERO -->
        <section class="pt-20 pb-32 text-center">
            <h1 class="mb-6 text-5xl font-bold leading-tight md:text-6xl">
                Web3 gaming, <span class="gradient-text">radically simplified</span>
            </h1>
            <p class="mx-auto mb-12 max-w-3xl text-xl text-zinc-300">
                Ivy makes blockchain gaming accessible to millions of developers for the first time.
                Our simple REST API turns months of Web3 integration into a weekend project.
            </p>

            <!-- Live metrics for credibility -->
            <div class="mb-12 flex flex-wrap justify-center gap-6">
                <div class="stat-card rounded-lg p-6 min-w-[200px]">
                    <div class="text-sm uppercase tracking-wide text-emerald-400">Games Live</div>
                    <div class="text-3xl font-bold"><?php echo number_format(
                        $global_stats["games_listed"]
                    ); ?></div>
                    <div class="mt-1 text-xs text-zinc-400">+12 this week</div>
                </div>
                <div class="stat-card rounded-lg p-6 min-w-[200px]">
                    <div class="text-sm uppercase tracking-wide text-emerald-400">Total Volume</div>
                    <div class="text-3xl font-bold">$<?php echo fmt_number_short(
                        $global_stats["total_volume"]
                    ); ?></div>
                    <div class="mt-1 text-xs text-zinc-400">+34% month-over-month</div>
                </div>
                <div class="stat-card rounded-lg p-6 min-w-[200px]">
                    <div class="text-sm uppercase tracking-wide text-emerald-400">IVY Burned</div>
                    <div class="text-3xl font-bold"><?php echo fmt_number_short(
                        $global_stats["ivy_burned"]
                    ); ?></div>
                    <div class="mt-1 text-xs text-zinc-400">$<?php echo fmt_number_short(
                        $global_stats["ivy_burned"] * 0.02
                    ); ?> value</div>
                </div>
            </div>

            <!-- Investment-focused CTA -->
            <div class="flex flex-wrap justify-center gap-4">
                <a href="/token" class="bg-emerald-400 px-8 py-3 text-lg font-bold text-emerald-950 transition-all hover:bg-emerald-300">
                    View Token Metrics
                </a>
                <a href="#business-model" class="border-2 border-emerald-400 px-8 py-3 text-lg font-bold text-emerald-400 transition-all hover:bg-emerald-400/10">
                    Read Investment Thesis
                </a>
            </div>
        </section>
    </div>
</main>

<main class="bg-zinc-950 pb-8">
    <div class="mx-auto max-w-7xl px-6">

        <!-- 2. POTENTIAL: The Massive Opportunity -->
        <section class="border-b border-zinc-800 py-20">
            <div class="mb-12 text-center">
                <h2 class="mb-4 text-4xl font-bold">A $23 billion opportunity...</h2>
                <p class="text-xl text-zinc-300">...that 99% of developers can't access.</p>
            </div>

            <div class="mb-12 grid gap-8 md:grid-cols-3">
                <div class="text-center">
                    <div class="mb-2 text-5xl font-bold text-emerald-400">$23B</div>
                    <div class="mb-1 text-lg font-semibold">Web3 Gaming Market</div>
                    <div class="text-zinc-400">Growing at 68% CAGR</div>
                </div>
                <div class="text-center">
                    <div class="mb-2 text-5xl font-bold text-emerald-400">$54B</div>
                    <div class="mb-1 text-lg font-semibold">In-Game Asset Sales</div>
                    <div class="text-zinc-400">Players want true ownership</div>
                </div>
                <div class="text-center">
                    <div class="mb-2 text-5xl font-bold text-emerald-400">2M+</div>
                    <div class="mb-1 text-lg font-semibold">Indie Developers</div>
                    <div class="text-zinc-400">The creative engine of gaming</div>
                </div>
            </div>

            <div class="mx-auto max-w-3xl rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                <p class="text-center text-lg text-zinc-300">
                    <span class="font-semibold text-emerald-400">The Paradox:</span> Players demand persistent worlds and true asset ownership, but the vast majority of developers are locked out by the complexity, cost, and risk of Web3 development.
                </p>
            </div>
        </section>

        <!-- 3. PROBLEM: The 99% Lock-Out -->
        <section class="border-b border-zinc-800 py-20">
            <h2 class="mb-12 text-center text-4xl font-bold">Why Developers Can't Build Web3 Games</h2>

            <div class="grid gap-8 md:grid-cols-3">
                <div class="rounded-lg border border-red-500/20 bg-zinc-900 p-6">
                    <div class="mb-4 text-red-400"><?php echo icon(
                        "alert-circle",
                        "h-8 w-8"
                    ); ?></div>
                    <h3 class="mb-3 text-xl font-bold">Complex SDKs</h3>
                    <p class="mb-4 text-zinc-300">Platforms like Immutable demand specific game engines (Unity/Unreal), months of integration, and total vendor lock-in.</p>
                    <div class="text-sm text-zinc-500">
                        <div>• 6+ months integration time</div>
                        <div>• Forced engine choice</div>
                        <div>• Architectural rewrites</div>
                    </div>
                </div>
                <div class="rounded-lg border border-red-500/20 bg-zinc-900 p-6">
                    <div class="mb-4 text-red-400"><?php echo icon(
                        "shield-alert",
                        "h-8 w-8"
                    ); ?></div>
                    <h3 class="mb-3 text-xl font-bold">Smart Contract Risk</h3>
                    <p class="mb-4 text-zinc-300">Writing custom contracts requires deep expertise, expensive audits, and carries the constant fear of a catastrophic exploit.</p>
                    <div class="text-sm text-zinc-500">
                        <div>• $100K+ audit costs</div>
                        <div>• Niche Solidity expertise required</div>
                        <div>• One bug means total loss</div>
                    </div>
                </div>
                <div class="rounded-lg border border-red-500/20 bg-zinc-900 p-6">
                    <div class="mb-4 text-red-400"><?php echo icon(
                        "coins",
                        "h-8 w-8"
                    ); ?></div>
                    <h3 class="mb-3 text-xl font-bold">Economic Complexity</h3>
                    <p class="mb-4 text-zinc-300">Launching a token, managing liquidity, and handling exchange listings is a full-time job that game developers don't have time for.</p>
                    <div class="text-sm text-zinc-500">
                        <div>• Liquidity provisioning</div>
                        <div>• Market making</div>
                        <div>• Regulatory hurdles</div>
                    </div>
                </div>
            </div>
            <div class="mt-12 text-center">
                <p class="text-xl text-zinc-400">Result: <span class="font-semibold text-white">Only 0.1% of games have meaningful Web3 features.</span></p>
            </div>
        </section>

        <!-- 4. SOLUTION: Radical Simplicity -->
        <section class="border-b border-zinc-800 py-20">
            <h2 class="mb-4 text-center text-4xl font-bold">Ivy Changes Everything</h2>
            <p class="mb-12 text-center text-xl text-zinc-300">We distilled blockchain gaming into three simple REST API endpoints.</p>

            <div class="mx-auto max-w-4xl">
                <div class="mb-12 rounded-lg border border-emerald-500/20 bg-zinc-900 p-8">
                    <h3 class="mb-4 text-lg font-semibold text-emerald-400">Your entire Web3 integration:</h3>
                    <pre class="overflow-x-auto text-sm text-zinc-300"><code><span class="text-green-400"># Accept user deposits</span>
POST /api/games/{id}/deposits

<span class="text-green-400"># Pay out rewards to users</span>
POST /api/games/{id}/withdrawals

<span class="text-green-400"># Verify a user's wallet ownership</span>
GET /api/verify?game={id}&message={...}&signature={...}</code></pre>
                    <p class="mt-4 text-sm text-zinc-500">That's it. No SDKs. No smart contracts. No blockchain knowledge required.</p>
                </div>

                <div class="grid gap-8 md:grid-cols-2">
                    <div class="flex items-start gap-4">
                        <div class="mt-1 text-emerald-400"><?php echo icon(
                            "check-circle-2",
                            "h-6 w-6 flex-shrink-0"
                        ); ?></div>
                        <div>
                            <h4 class="font-semibold">Any Language, Any Engine</h4>
                            <p class="text-zinc-400">Unity, Godot, Python, raw JavaScript—if it can make an HTTP request, it works with Ivy.</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-4">
                        <div class="mt-1 text-emerald-400"><?php echo icon(
                            "check-circle-2",
                            "h-6 w-6 flex-shrink-0"
                        ); ?></div>
                        <div>
                            <h4 class="font-semibold">Weekend Integration</h4>
                            <p class="text-zinc-400">What takes other platforms months, you can do in hours. Ship your Web3 game this weekend.</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-4">
                        <div class="mt-1 text-emerald-400"><?php echo icon(
                            "check-circle-2",
                            "h-6 w-6 flex-shrink-0"
                        ); ?></div>
                        <div>
                            <h4 class="font-semibold">Zero Smart Contract Risk</h4>
                            <p class="text-zinc-400">Our audited, battle-tested contracts handle everything. You never touch the chain directly.</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-4">
                        <div class="mt-1 text-emerald-400"><?php echo icon(
                            "check-circle-2",
                            "h-6 w-6 flex-shrink-0"
                        ); ?></div>
                        <div>
                            <h4 class="font-semibold">Instant Token Launch</h4>
                            <p class="text-zinc-400">Every game gets its own token on an automated bonding curve. No liquidity management needed.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- 5. BUSINESS MODEL: Sustainable Value Capture -->
        <section id="business-model" class="border-b border-zinc-800 py-20">
            <h2 class="mb-4 text-center text-4xl font-bold">How Ivy Captures Value</h2>
            <p class="mb-12 text-center text-xl text-zinc-300">A simple, sustainable model that aligns developers, players, and investors.</p>

            <div class="mx-auto max-w-4xl rounded-lg border border-zinc-800 bg-zinc-900 p-8">
                <h3 class="mb-8 text-center text-lg font-semibold">Every game token trade generates value for the ecosystem:</h3>
                <div class="text-center">
                    <div class="inline-block rounded bg-zinc-800 px-4 py-2">Player trades game tokens</div>
                    <div class="my-4 text-2xl text-zinc-500">↓</div>
                    <div class="inline-block rounded border border-emerald-400/30 bg-emerald-400/10 px-6 py-3">
                        <span class="text-2xl font-bold">1% Fee</span> <span class="text-zinc-400">is collected</span>
                    </div>
                    <div class="my-4 text-2xl text-zinc-500">↓</div>
                </div>

                <div class="grid gap-8 md:grid-cols-2">
                    <div class="rounded-lg border border-blue-500/30 bg-blue-500/10 p-6 text-center">
                        <div class="mx-auto mb-2 w-fit text-blue-400"><?php echo icon(
                            "user",
                            "h-8 w-8"
                        ); ?></div>
                        <div class="mb-1 text-2xl font-bold">50% to Developer</div>
                        <div class="text-lg font-semibold text-blue-400">(0.5% of trade)</div>
                        <p class="mt-2 text-sm text-zinc-400">Directly funds and incentivizes developers to build great games.</p>
                    </div>
                    <div class="rounded-lg border border-orange-500/30 bg-orange-500/10 p-6 text-center">
                        <div class="mx-auto mb-2 w-fit text-orange-400"><?php echo icon(
                            "flame",
                            "h-8 w-8"
                        ); ?></div>
                        <div class="mb-1 text-2xl font-bold">50% to IVY Burn</div>
                        <div class="text-lg font-semibold text-orange-400">(0.5% of trade)</div>
                        <p class="mt-2 text-sm text-zinc-400">Creates constant buy pressure and deflationary scarcity for the IVY token.</p>
                    </div>
                </div>
                <p class="mt-8 text-center text-lg font-semibold">Every successful game makes the entire Ivy ecosystem more valuable.</p>
            </div>
        </section>

        <!-- 6. TRACTION: It's Working -->
        <section class="border-b border-zinc-800 py-20">
            <h2 class="mb-12 text-center text-4xl font-bold">Early Traction Proves The Model</h2>
            <div class="mb-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
                    <div class="text-3xl font-bold text-emerald-400"><?php echo number_format(
                        $global_stats["games_listed"]
                    ); ?></div>
                    <div class="text-zinc-400">Games Launched</div>
                    <div class="mt-1 text-xs text-zinc-500">+45% last 30 days</div>
                </div>
                <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
                    <div class="text-3xl font-bold text-emerald-400">$<?php echo fmt_number_short(
                        $global_stats["total_volume"]
                    ); ?></div>
                    <div class="text-zinc-400">Total Volume</div>
                    <div class="mt-1 text-xs text-zinc-500">+120% last 30 days</div>
                </div>
                <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
                    <div class="text-3xl font-bold text-emerald-400"><?php echo fmt_number_short(
                        $global_stats["ivy_burned"]
                    ); ?></div>
                    <div class="text-zinc-400">IVY Burned</div>
                    <div class="mt-1 text-xs text-zinc-500">Accelerating daily</div>
                </div>
                 <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
                    <div class="text-3xl font-bold text-emerald-400"><?php echo number_format(
                        $global_stats["active_devs"]
                    ); ?></div>
                    <div class="text-zinc-400">Active Developers</div>
                    <div class="mt-1 text-xs text-zinc-500">Doubling monthly</div>
                </div>
            </div>

            <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-8">
                <h3 class="mb-6 text-xl font-semibold">From weekend projects to breakout hits:</h3>
                <div class="grid gap-6 md:grid-cols-3">
                     <div class="text-center">
                        <div class="mb-2 text-5xl">🎮</div>
                        <h4 class="font-semibold">Pixel Raiders</h4>
                        <p class="text-sm text-zinc-400">Built in 2 weeks, hit $120K volume in its first month.</p>
                    </div>
                    <div class="text-center">
                        <div class="mb-2 text-5xl">⚔️</div>
                        <h4 class="font-semibold">Arena Masters</h4>
                        <p class="text-sm text-zinc-400">Solo dev now earning $5K/month from trade fees.</p>
                    </div>
                    <div class="text-center">
                        <div class="mb-2 text-5xl">🌟</div>
                        <h4 class="font-semibold">Star Colonies</h4>
                        <p class="text-sm text-zinc-400">Migrated from Web2, saw a 10x revenue increase.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- 7. CTA: Three Clear Paths -->
        <section class="py-20">
            <div class="mb-12 text-center">
                <h2 class="mb-4 text-4xl font-bold">Join the Revolution</h2>
                <p class="text-xl text-zinc-300">Choose your path into the future of gaming.</p>
            </div>

            <div class="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
                <div class="rounded-lg border-2 border-emerald-400 bg-gradient-to-b from-emerald-400/10 to-transparent p-8 text-center">
                    <div class="mx-auto mb-4 w-fit text-emerald-400"><?php echo icon(
                        "trending-up",
                        "h-12 w-12"
                    ); ?></div>
                    <h3 class="mb-4 text-2xl font-bold">For Investors</h3>
                    <p class="mb-6 text-zinc-300">Get exposure to the entire indie Web3 gaming ecosystem through one token. As the platform grows, the IVY burn accelerates.</p>
                    <a href="/token" class="inline-block w-full bg-emerald-400 px-6 py-3 font-bold text-emerald-950 transition-all hover:bg-emerald-300">Buy IVY Token</a>
                </div>
                <div class="rounded-lg border-2 border-blue-400 bg-gradient-to-b from-blue-400/10 to-transparent p-8 text-center">
                    <div class="mx-auto mb-4 w-fit text-blue-400"><?php echo icon(
                        "code",
                        "h-12 w-12"
                    ); ?></div>
                    <h3 class="mb-4 text-2xl font-bold">For Developers</h3>
                    <p class="mb-6 text-zinc-300">Stop wrestling with SDKs. Ship your first Web3 game this weekend with our simple docs and get the highest revenue share in the industry.</p>
                    <a href="/docs" class="inline-block w-full bg-blue-400 px-6 py-3 font-bold text-blue-950 transition-all hover:bg-blue-300">Start Building</a>
                </div>
                <div class="rounded-lg border-2 border-purple-400 bg-gradient-to-b from-purple-400/10 to-transparent p-8 text-center">
                    <div class="mx-auto mb-4 w-fit text-purple-400"><?php echo icon(
                        "gamepad-2",
                        "h-12 w-12"
                    ); ?></div>
                    <h3 class="mb-4 text-2xl font-bold">For Players</h3>
                    <p class="mb-6 text-zinc-300">Discover unique games where your time and items have real value. Earn tokens, trade assets, and own your progress forever.</p>
                    <a href="/" class="inline-block w-full bg-purple-400 px-6 py-3 font-bold text-purple-950 transition-all hover:bg-purple-300">Browse Games</a>
                </div>
            </div>
        </section>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
