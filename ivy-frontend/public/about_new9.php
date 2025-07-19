<?php
require_once __DIR__ . "/../includes/header.php";

$title = "About | Ivy";
$description =
    "Web3 gaming, radically simplified. Build and play games in hours, not months.";
?>

<main class="bg-zinc-950 text-white">
    <!-- HERO -->
    <section class="relative overflow-hidden py-24 lg:py-40">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.1),_transparent_50%)]"></div>
        <div class="relative mx-auto max-w-5xl px-6 text-center">
            <h1 class="text-5xl md:text-6xl font-bold tracking-tight mb-6">
                Web3 Gaming<br>
                <span class="bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent">
                    Radically Simplified
                </span>
            </h1>
            <p class="text-xl text-zinc-300 max-w-3xl mx-auto mb-8">
                Build blockchain games in a weekend. No smart contracts, no complex SDKs, no engine lock-in.
                Our three-endpoint REST API handles all Web3 complexity. Focus on fun, not blockchain.
            </p>
            <div class="flex flex-wrap justify-center gap-4">
                <a href="/docs" class="bg-emerald-500 text-black px-8 py-3 font-bold rounded-lg hover:bg-emerald-400 transition">
                    Build in 10 Minutes
                </a>
                <a href="/" class="border border-zinc-600 px-8 py-3 font-bold rounded-lg hover:bg-zinc-800 transition">
                    Browse Games
                </a>
            </div>
        </div>
    </section>

    <!-- TAB SWITCHER SECTION -->
    <section class="py-20">
        <div class="mx-auto max-w-6xl px-6">
            <div class="text-center mb-12">
                <h2 class="text-3xl font-bold mb-4">Ivy for Everyone</h2>
                <p class="text-zinc-400">One platform, three perspectives</p>
            </div>

            <div class="grid md:grid-cols-3 gap-8">
                <!-- Developers -->
                <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
                    <div class="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-6">
                        <?php echo icon("code", "h-6 w-6 text-emerald-400"); ?>
                    </div>
                    <h3 class="text-2xl font-bold mb-3">For Developers</h3>
                    <p class="text-zinc-300 mb-4">
                        REST API so minimal we're mocked for it. Use Unity, Godot, or your custom engine—no lock-in.
                    </p>
                    <ul class="space-y-2 text-zinc-400">
                        <li>✓ Weekend project → Web3 launch</li>
                        <li>✓ 50% revenue share from day one</li>
                        <li>✓ Zero smart contract glue</li>
                    </ul>
                    <a href="/upload" class="block mt-6 text-emerald-400 hover:text-emerald-300 font-bold">
                        Start Building →
                    </a>
                </div>

                <!-- Players -->
                <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
                    <div class="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-6">
                        <?php echo icon(
                            "gamepad-2",
                            "h-6 w-6 text-purple-400"
                        ); ?>
                    </div>
                    <h3 class="text-2xl font-bold mb-3">For Players</h3>
                    <p class="text-zinc-300 mb-4">
                        Instant wallet onboarding, tokenized rewards you can trade, and assets that follow you.
                    </p>
                    <ul class="space-y-2 text-zinc-400">
                        <li>✓ One click to start earning</li>
                        <li>✓ Trade in-game items for cash</li>
                        <li>✓ Coordinated launches & events</li>
                    </ul>
                    <a href="/" class="block mt-6 text-purple-400 hover:text-purple-300 font-bold">
                        Discover Games →
                    </a>
                </div>

                <!-- Investors -->
                <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
                    <div class="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-6">
                        <?php echo icon(
                            "trending-up",
                            "h-6 w-6 text-blue-400"
                        ); ?>
                    </div>
                    <h3 class="text-2xl font-bold mb-3">For Ecosystem</h3>
                    <p class="text-zinc-300 mb-4">
                        Capture the long-tail of indie Web3 games—$10B market with zero-barrier tooling.
                    </p>
                    <ul class="space-y-2 text-zinc-400">
                        <li>✓ 0.5% fees burned <strong>every trade</strong></li>
                        <li>✓ Developer-focused liquidity curves</li>
                        <li>✓ Network effects from shared infra</li>
                    </ul>
                </div>
            </div>
        </div>
    </section>

    <!-- HOW-IT-WORKS -->
    <section class="py-20 bg-zinc-900">
        <div class="mx-auto max-w-4xl px-6">
            <h2 class="text-3xl font-bold text-center mb-12">Build & Launch in 4 Steps</h2>
            <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <?php
                $steps = [
                    ["Upload Game", "HTML5, Unity, or Godot—you name it"],
                    ["Add Web3", "3 REST endpoints → done"],
                    ["Set Token", "Direct bonding curve, no launchpad"],
                    ["Go Live", "Players trade, you earn immediately"],
                ];
                foreach ($steps as $i => $step): ?>
                    <div class="text-center">
                        <div class="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-black font-bold text-xl mb-4 mx-auto">
                            <?= $i + 1 ?>
                        </div>
                        <h3 class="font-bold text-lg"><?= $step[0] ?></h3>
                        <p class="text-zinc-400 text-sm"><?= $step[1] ?></p>
                    </div>
                <?php endforeach;
                ?>
            </div>
        </div>
    </section>

    <!-- TRUST TORCH -->
    <section class="py-16">
        <div class="mx-auto max-w-4xl px-6 text-center">
            <h2 class="text-2xl font-bold mb-4">Minimal Interface → Maximum Flexibility</h2>
            <p class="text-zinc-300 mb-8">
                We built Ivy after watching developers burn months on complex SDKs. Our "worse is better" approach—
                a tiny REST API with no lock-in—unlocks the entire indie gaming pipeline that existing platforms ignore.
            </p>
            <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-6 font-mono text-zinc-300">
                <strong class="text-emerald-400">Ivy violates.

</strong><br>
                <span class="text-sm">That's the point.</span>
            </div>
        </div>
    </section>

    <!-- FINAL CTA -->
    <section class="py-20 bg-zinc-900">
        <div class="mx-auto max-w-6xl px-6 text-center">
            <h2 class="text-3xl font-bold mb-6">Ready to Hit "Save & Deploy"?</h2>
            <p class="text-zinc-400 mb-8">
                Whether you're shipping your first game or investing in the indie revolution, Ivy levels the playing field.
            </p>
            <div class="flex flex-wrap justify-center gap-4">
                <a href="/docs" class="bg-emerald-500 text-black font-bold px-8 py-3 rounded-lg hover:bg-emerald-400 transition">
                    Read the 10-minute Guide
                </a>
                <a href="https://discord.gg/ge7WyB8tjG" class="border border-zinc-600 px-8 py-3 font-bold rounded-lg hover:bg-zinc-800 transition">
                    Join Discord
                </a>
            </div>
        </div>
    </section>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
