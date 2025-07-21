<?php
/**
 * ivy-frontend/public/docs.php
 *
 * Displays documentation HTML files.
 */

// Get the requested path
$request_uri = $_SERVER["REQUEST_URI"];

// Remove the '/docs/' prefix to get the page name
$page = preg_replace("#^/docs/?#", "", $request_uri);

// Default to index if no page is specified or if it's just /docs/
if (empty($page)) {
    $page = "index";
}

// Remove any query parameters
if (($pos = strpos($page, "?")) !== false) {
    $page = substr($page, 0, $pos);
}

// Take only last component of path
$page = basename($page);

// Get name of page
$name = str_replace("-", " ", $page);
$name = str_replace("_", " ", $name);
$name = ucfirst($name);

// Ensure we're using just the filename
$page = $page . ".html";

// Create absolute path to the docs_build directory
$file_path = __DIR__ . "/../docs_build/" . $page;
if (file_exists($file_path)) {
    // Read the file content instead of including it
    $content = file_get_contents($file_path);
} else {
    print "can't find " . $file_path;
    require_once __DIR__ . "/404.php";
    return;
}

$extra_head = <<<HTML
<link id="hljs-dark" rel="stylesheet" href="/assets/css/highlight.css">
<script src="/assets/js/highlight.min.js"></script>
<script>hljs.highlightAll();</script>
HTML;
$title = "ivy | docs: $name";
$description = "View the $name page on the documentation for Ivy: web3 gaming, radically simplified";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8 mx-auto max-w-6xl px-6">
    <?php echo $content; ?>
</main>

<?php require_once __DIR__ . "/../includes/footer.php";
?>
