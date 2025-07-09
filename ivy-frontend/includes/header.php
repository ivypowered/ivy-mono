<?php
/**
 * ivy-frontend/includes/header.php
 * The global site header.
 */

require_once __DIR__ . "/icon.php";

/**
 * Generate navigation link with appropriate styling
 */
function nav_link($url, $text, $iconName, $isMobile = false)
{
    $path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
    $isActive =
        $url === "/"
            ? $path === "/"
            : $path === $url || strpos($path, "$url/") === 0;

    if ($isMobile) {
        // Mobile version - retro button style
        $class =
            "flex items-center justify-center gap-3 py-3 px-4 w-full " .
            ($isActive
                ? "bg-emerald-400 text-emerald-950"
                : "bg-zinc-800 text-white hover:bg-zinc-700") .
            " rounded-none border-2 border-emerald-400 font-bold text-sm box-border";

        $iconHtml = icon($iconName, "inline-flex h-5 w-5");
    } else {
        // Desktop version
        $class =
            "flex items-center gap-2 relative " .
            ($isActive ? "text-emerald-400" : "hover:text-emerald-400");
        $iconHtml = icon($iconName, "inline-flex h-4 w-4");
        $underline =
            "<span class=\"absolute -bottom-1 left-0 right-0 h-0.5 bg-emerald-400 " .
            ($isActive ? "scale-x-100" : "scale-x-0 hover:scale-x-100") .
            " transition-transform duration-200\"></span>";
    }

    return "<a href=\"$url\" class=\"$class\">
                <span>{$iconHtml}</span>
                <span>{$text}</span>
                " .
        (!$isMobile ? $underline : "") .
        "
            </a>";
}

header("Content-Type: text/html; charset=UTF-8");
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?></title>
    <meta name="description" content="<?= htmlspecialchars($description) ?>">
    <link rel="icon" href="/assets/images/ivy-icon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/css/styles.css">
    <script src="/assets/js/ivy-react.js" type="text/javascript" async></script>

    <style>
        input[type="search"]::-webkit-search-cancel-button { -webkit-appearance: none; }
        #mobile-menu.hidden { display: none; }
        #mobile-menu { transform: translateY(-1px); }
        #menu-toggle { cursor: pointer; }

        /* Add box-sizing to elements with borders */
        .border-2, .border-b-4, input[type="search"], #menu-toggle,
        button, a.rounded-none, #mobile-menu, header {
            box-sizing: border-box;
        }
    </style>

    <?php if (isset($extra_head)) {
        echo $extra_head;
    } ?>
</head>
<body class="min-h-screen bg-zinc-900 text-white font-['JetBrains_Mono',monospace]">
    <header class="border-b-4 border-emerald-400 px-6 py-4 relative">
        <div class="mx-auto flex max-w-7xl items-center justify-between">
            <a href="/" class="flex items-center gap-2 text-2xl font-bold flex-shrink-0">
                <img src="/assets/images/ivy-symbol.svg" alt="Ivy Symbol" class="h-8 text-emerald-400">
                <span class="bg-emerald-400 text-emerald-950 px-2">ivy</span>
            </a>

            <!-- Mobile Actions (Right Side) -->
            <div class="flex items-center gap-3 lg:hidden">
                <!-- Wallet Button (Now visible on mobile) -->
                <div id="wallet-mobile-button">
                    <button class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 p-2">
                        <?= icon("link", "h-6 w-6") ?>
                    </button>
                </div>

                <!-- Hamburger Menu Button (Mobile/Tablet Only) -->
                <button id="menu-toggle" class="lg:hidden p-2 text-emerald-400 hover:text-emerald-300 focus:outline-none border-2 border-emerald-400" aria-controls="mobile-menu" aria-expanded="false">
                    <span class="sr-only">Open main menu</span>
                    <span id="menu-icon"><?= icon("menu", "h-6 w-6") ?></span>
                    <span id="close-icon" class="hidden"><?= icon(
                        "x",
                        "h-6 w-6"
                    ) ?></span>
                </button>
            </div>

            <!-- Desktop Navigation -->
            <nav class="hidden lg:block">
                <ul class="flex items-center gap-8 font-bold text-sm">
                    <?php foreach (
                        [
                            ["/" => ["explore", "compass"]],
                            ["/about" => ["about", "info"]],
                            ["/docs" => ["docs", "book"]],
                            ["/token" => ["token", "token"]],
                        ]
                        as $link
                    ) {
                        $url = key($link);
                        $data = current($link);
                        echo nav_link($url, $data[0], $data[1]);
                    } ?>
                </ul>
            </nav>

            <!-- Desktop Actions -->
            <div class="hidden lg:flex items-center gap-4">
                <div class="relative">
                    <?= icon(
                        "search",
                        "absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-950 pointer-events-none"
                    ) ?>
                    <form action="/search" method="GET" class="m-0 p-0">
                        <input type="search" name="q" placeholder="search games..." class="h-10 w-64 rounded-none border-2 border-emerald-400 bg-emerald-50 pl-8 text-sm font-bold text-emerald-950 placeholder:text-emerald-900/70 focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none">
                    </form>
                </div>
                <div id="wallet-button">
                    <button class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 p-2 h-10 w-10">
                        <?= icon("link", "h-5 w-5") ?>
                    </button>
                </div>
                <a href="/upload" class="rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-4 py-2 flex items-center gap-2 text-sm h-10">
                    <?= icon("upload", "h-4 w-4") ?>
                    <span>upload game</span>
                </a>
            </div>

            <!-- Mobile Menu - Retro Style -->
            <div id="mobile-menu" class="hidden lg:hidden absolute top-full left-0 right-0 bg-zinc-900 border-b-4 border-b-emerald-400 p-6 z-20">
                <nav class="mb-6">
                    <ul class="flex flex-col items-center gap-3 w-full mx-auto">
                        <?php foreach (
                            [
                                ["/" => ["explore", "compass"]],
                                ["/about" => ["about", "info"]],
                                ["/docs" => ["docs", "book"]],
                                ["/token" => ["token", "token"]],
                            ]
                            as $link
                        ) {
                            $url = key($link);
                            $data = current($link);
                            echo "<li class=\"w-full\">" .
                                nav_link($url, $data[0], $data[1], true) .
                                "</li>";
                        } ?>
                    </ul>
                </nav>
                <div class="flex flex-col gap-4 w-full mx-auto">
                    <div class="relative w-full">
                        <?= icon(
                            "search",
                            "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-950 pointer-events-none"
                        ) ?>
                        <form action="/search" method="GET" class="m-0 p-0">
                            <input type="search" name="q" placeholder="search games..." class="h-12 w-full rounded-none border-2 border-emerald-400 bg-emerald-50 pl-10 text-sm font-bold text-emerald-950 placeholder:text-emerald-900/70 focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none">
                        </form>
                    </div>
                    <a href="/upload" class="text-center rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-4 py-3 flex items-center justify-center gap-2 text-sm">
                        <?= icon("upload", "h-5 w-5") ?>
                        <span>upload game</span>
                    </a>
                </div>
            </div>
        </div>
    </header>

    <script>
        (function() {
            const menuToggle = document.getElementById("menu-toggle");
            const mobileMenu = document.getElementById("mobile-menu");
            const menuIcon = document.getElementById("menu-icon");
            const closeIcon = document.getElementById("close-icon");

            // Validate that all required elements exist
            if (!menuToggle) throw new Error("Menu toggle button not found");
            if (!mobileMenu) throw new Error("Mobile menu not found");
            if (!menuIcon) throw new Error("Menu icon not found");
            if (!closeIcon) throw new Error("Close icon not found");

            menuToggle.addEventListener("click", () => {
                const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";

                if (isExpanded) {
                    mobileMenu.classList.add("hidden");
                    menuIcon.classList.remove("hidden");
                    closeIcon.classList.add("hidden");
                } else {
                    mobileMenu.classList.remove("hidden");
                    menuIcon.classList.add("hidden");
                    closeIcon.classList.remove("hidden");
                }

                menuToggle.setAttribute("aria-expanded", !isExpanded);
            });

            // Close menu when clicking outside
            document.addEventListener("click", (event) => {
                if (
                    !mobileMenu.contains(event.target) &&
                    !menuToggle.contains(event.target) &&
                    !mobileMenu.classList.contains("hidden")
                ) {
                    mobileMenu.classList.add("hidden");
                    menuToggle.setAttribute("aria-expanded", "false");
                    menuIcon.classList.remove("hidden");
                    closeIcon.classList.add("hidden");
                }
            });

            // Close mobile menu if window resizes above the breakpoint
            window.addEventListener("resize", () => {
                if (window.innerWidth >= 1024 && !mobileMenu.classList.contains("hidden")) {
                    mobileMenu.classList.add("hidden");
                    menuToggle.setAttribute("aria-expanded", "false");
                    menuIcon.classList.remove("hidden");
                    closeIcon.classList.add("hidden");
                }
            });
        })();
    </script>
