<?php
/**
 * ivy-frontend/public/about_new.php
 * The new about page for Ivy, inspired by modern Web3 marketing sites.
 */

// Include API and formatters
require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

// Placeholder stats - you would fetch these from your API
$games_listed = 124;
$total_volume = 1250345.67;
$developer_payout = 6251.72;

// Include header
$title = "About Ivy | Web3 Gaming, Radically Simplified";
$description =
    "Ivy makes Web3 game development radically simple. With our language-agnostic REST API, you can launch a blockchain-powered game in hours, not months.";
require_once __DIR__ . "/../includes/header.php";
?>

<!-- Hero Section -->
<main class="relative overflow-hidden bg-zinc-900">
    <div class="absolute inset-0 bg-grid-zinc-800 [mask-image:linear-gradient(to_bottom,white_10%,transparent_100%)]"></div>
    <div class="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:flex lg:items-center lg:gap-x-10 lg:px-8 lg:py-40">
        <div class="mx-auto max-w-2xl lg:mx-0 lg:flex-auto">
            <div class="flex">
                <div class="relative flex items-center gap-x-4 rounded-full px-4 py-1 text-sm leading-6 text-zinc-300 ring-1 ring-zinc-700 hover:ring-zinc-500">
                    <span class="font-semibold text-emerald-400">Ivy</span>
                    <span class="h-4 w-px bg-zinc-600" aria-hidden="true"></span>
                    <span>The future of indie Web3 gaming is here.</span>
                </div>
            </div>
            <h1 class="mt-10 max-w-lg text-4xl font-bold tracking-tight text-white sm:text-6xl">
                Web3 Gaming, Radically Simplified
            </h1>
            <p class="mt-6 text-lg leading-8 text-zinc-300">
                Stop wrestling with complex SDKs and smart contracts. Ivy's simple REST API provides the core building blocks for Web3 games—deposits, withdrawals, and auth. Build in any engine, launch in a weekend.
            </p>
            <div class="mt-10 flex items-center gap-x-6">
                <a href="/docs" class="rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500">Start Building</a>
                <a href="/#games" class="text-sm font-semibold leading-6 text-white">Explore Games <span aria-hidden="true">→</span></a>
            </div>
        </div>
        <div class="mt-16 sm:mt-24 lg:mt-0 lg:flex-shrink-0 lg:flex-grow">
            <!-- Placeholder for a cool graphic or video -->
            <div class="aspect-[3/2] rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                 <?php echo icon("box", "h-24 w-24 text-zinc-600"); ?>
                 <span class="sr-only">Ivy platform diagram</span>
            </div>
        </div>
    </div>
</main>

<!-- Logo Cloud / Social Proof Section -->
<div class="bg-zinc-900 py-12 sm:py-16">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 class="text-center text-lg font-semibold leading-8 text-white">
            Build with the tools you already love. No lock-in.
        </h2>
        <div class="mx-auto mt-10 grid max-w-lg grid-cols-4 items-center gap-x-8 gap-y-10 sm:max-w-xl sm:grid-cols-6 sm:gap-x-10 lg:mx-0 lg:max-w-none lg:grid-cols-5">
            <img class="col-span-2 max-h-12 w-full object-contain lg:col-span-1" src="https://tailwindui.com/img/logos/158x48/transistor-logo-white.svg" alt="Transistor" width="158" height="48">
            <img class="col-span-2 max-h-12 w-full object-contain lg:col-span-1" src="https://tailwindui.com/img/logos/158x48/reform-logo-white.svg" alt="Reform" width="158" height="48">
            <img class="col-span-2 max-h-12 w-full object-contain lg:col-span-1" src="https://tailwindui.com/img/logos/158x48/tuple-logo-white.svg" alt="Tuple" width="158" height="48">
            <img class="col-span-2 max-h-12 w-full object-contain sm:col-start-2 lg:col-span-1" src="https://tailwindui.com/img/logos/158x48/savvycal-logo-white.svg" alt="SavvyCal" width="158" height="48">
            <img class="col-span-2 col-start-2 max-h-12 w-full object-contain sm:col-start-auto lg:col-span-1" src="https://tailwindui.com/img/logos/158x48/statamic-logo-white.svg" alt="Statamic" width="158" height="48">
            <!-- Use logos of engines/languages like Unity, Godot, Rust, Python, etc. -->
        </div>
    </div>
</div>


<!-- "Why Ivy?" Features Section -->
<div class="bg-zinc-900 py-24 sm:py-32">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="mx-auto max-w-2xl lg:text-center">
            <h2 class="text-base font-semibold leading-7 text-emerald-400">The Ivy Difference</h2>
            <p class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything you need, nothing you don't.</p>
            <p class="mt-6 text-lg leading-8 text-zinc-300">We challenged the idea that Web3 has to be complicated. Ivy focuses on a minimal, powerful core so you can focus on creativity and speed.</p>
        </div>
        <div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                <div class="flex flex-col">
                    <dt class="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                        <?php echo icon(
                            "zap",
                            "h-5 w-5 flex-none text-emerald-400"
                        ); ?>
                        Launch in Hours, Not Months
                    </dt>
                    <dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-zinc-300">
                        <p class="flex-auto">Our simple, language-agnostic REST API handles all the blockchain complexity. Integrate deposits, withdrawals, and auth with a few HTTP calls. No need to write or audit your own smart contracts.</p>
                    </dd>
                </div>
                <div class="flex flex-col">
                    <dt class="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                        <?php echo icon(
                            "unlock",
                            "h-5 w-5 flex-none text-emerald-400"
                        ); ?>
                        Freedom to Build Your Way
                    </dt>
                    <dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-zinc-300">
                        <p class="flex-auto">The Unix philosophy of "worse is better" applied to Web3. By providing a minimal interface, we give you maximum flexibility. Use any game engine, any programming language, and any backend. No platform lock-in.</p>
                    </dd>
                </div>
                <div class="flex flex-col">
                    <dt class="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                        <?php echo icon(
                            "dollar-sign",
                            "h-5 w-5 flex-none text-emerald-400"
                        ); ?>
                        The Most Favorable Economics
                    </dt>
                    <dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-zinc-300">
                        <p class="flex-auto">Launch your game's token on the Ivy Marketplace. A 1% fee is levied on trades: 0.5% goes directly to you, the developer, and 0.5% is burned to support the ecosystem. The highest developer revenue share, period.</p>
                    </dd>
                </div>
            </dl>
        </div>
    </div>
</div>

<!-- Featured Games Section -->
<div class="bg-zinc-900 py-24 sm:py-32">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="mx-auto max-w-2xl lg:mx-0">
            <h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">Powered by Ivy</h2>
            <p class="mt-6 text-lg leading-8 text-zinc-300">From weekend projects to indie hits, a new generation of games is being built on Ivy.</p>
        </div>
        <div class="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            <!-- Example Game 1 -->
            <article class="flex flex-col items-start justify-between">
                <div class="relative w-full">
                    <img src="https://placehold.co/600x400/18181b/34d399?text=Game+Screenshot" alt="" class="aspect-[16/9] w-full rounded-2xl bg-zinc-800 object-cover sm:aspect-[2/1] lg:aspect-[3/2]">
                    <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-zinc-800"></div>
                </div>
                <div class="max-w-xl">
                    <div class="mt-8 flex items-center gap-x-4 text-xs">
                        <time datetime="2023-10-26" class="text-zinc-400">Oct 26, 2023</time>
                        <a href="#" class="relative z-10 rounded-full bg-zinc-800 px-3 py-1.5 font-medium text-zinc-300 hover:bg-zinc-700">Strategy</a>
                    </div>
                    <div class="group relative">
                        <h3 class="mt-3 text-lg font-semibold leading-6 text-white group-hover:text-emerald-400">
                            <a href="#"><span class="absolute inset-0"></span>Pixel Raiders</a>
                        </h3>
                        <p class="mt-5 line-clamp-3 text-sm leading-6 text-zinc-300">An 8-bit conquest game where every castle and soldier is an ownable asset, built by a solo developer in just two weeks.</p>
                    </div>
                </div>
            </article>

            <!-- Example Game 2 -->
            <article class="flex flex-col items-start justify-between">
                <div class="relative w-full">
                    <img src="https://placehold.co/600x400/18181b/4f46e5?text=Game+Screenshot" alt="" class="aspect-[16/9] w-full rounded-2xl bg-zinc-800 object-cover sm:aspect-[2/1] lg:aspect-[3/2]">
                    <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-zinc-800"></div>
                </div>
                <div class="max-w-xl">
                    <div class="mt-8 flex items-center gap-x-4 text-xs">
                        <time datetime="2023-09-15" class="text-zinc-400">Sep 15, 2023</time>
                        <a href="#" class="relative z-10 rounded-full bg-zinc-800 px-3 py-1.5 font-medium text-zinc-300 hover:bg-zinc-700">Action RPG</a>
                    </div>
                    <div class="group relative">
                        <h3 class="mt-3 text-lg font-semibold leading-6 text-white group-hover:text-emerald-400">
                            <a href="#"><span class="absolute inset-0"></span>Starfall Arena</a>
                        </h3>
                        <p class="mt-5 line-clamp-3 text-sm leading-6 text-zinc-300">A fast-paced multiplayer brawler where players earn tokens by winning matches and trade them for unique character skins.</p>
                    </div>
                </div>
            </article>

            <!-- Example Game 3 (You can add more) -->
            <article class="flex flex-col items-start justify-between">
                <div class="relative w-full">
                    <img src="https://placehold.co/600x400/18181b/be185d?text=Game+Screenshot" alt="" class="aspect-[16/9] w-full rounded-2xl bg-zinc-800 object-cover sm:aspect-[2/1] lg:aspect-[3/2]">
                    <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-zinc-800"></div>
                </div>
                <div class="max-w-xl">
                    <div class="mt-8 flex items-center gap-x-4 text-xs">
                        <time datetime="2023-08-01" class="text-zinc-400">Aug 1, 2023</time>
                        <a href="#" class="relative z-10 rounded-full bg-zinc-800 px-3 py-1.5 font-medium text-zinc-300 hover:bg-zinc-700">Puzzle</a>
                    </div>
                    <div class="group relative">
                        <h3 class="mt-3 text-lg font-semibold leading-6 text-white group-hover:text-emerald-400">
                            <a href="#"><span class="absolute inset-0"></span>Circuit Breakers</a>
                        </h3>
                        <p class="mt-5 line-clamp-3 text-sm leading-6 text-zinc-300">A competitive puzzle game where players spend tokens to enter tournaments and win prizes from a shared pool.</p>
                    </div>
                </div>
            </article>
        </div>
    </div>
</div>

<!-- CTA Section -->
<div class="relative bg-zinc-900">
  <div class="relative h-80 overflow-hidden bg-emerald-600 md:absolute md:left-0 md:h-full md:w-1/3 lg:w-1/2">
    <img class="h-full w-full object-cover" src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2830&q=80&sat=-100" alt="Developers collaborating">
    <div class="absolute inset-0 bg-emerald-700 mix-blend-multiply"></div>
  </div>
  <div class="relative mx-auto max-w-7xl py-24 sm:py-32 lg:px-8 lg:py-40">
    <div class="pl-6 pr-6 md:ml-auto md:w-2/3 md:pl-16 lg:w-1/2 lg:pl-24 lg:pr-0 xl:pl-32">
      <h2 class="text-base font-semibold leading-7 text-emerald-400">For Developers</h2>
      <p class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to build?</p>
      <p class="mt-6 text-base leading-7 text-zinc-300">Dive into our documentation and see how easy it is to integrate Ivy's REST API into your project. Join our developer community on Discord to get help and share what you're building.</p>
      <div class="mt-8">
        <a href="/docs" class="inline-flex rounded-md bg-white/10 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Read the Docs</a>
      </div>
    </div>
  </div>
</div>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
