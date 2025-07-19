<?php

// Allowed file extensions for static files
$allowed_static_extensions = [
    "html",
    "htm",
    "css",
    "js",
    "jpg",
    "jpeg",
    "png",
    "gif",
    "svg",
    "ico",
    "json",
    "woff",
    "woff2",
    "ttf",
    "eot",
    "otf",
    "pdf",
    "txt",
    "xml",
    "csv",
    "map",
    "md",
    "yaml",
    "yml",
    "mp3",
    "mp4",
    "webp",
    "webm",
    "zip",
    "rar",
];

$mime_types = [
    "html" => "text/html",
    "htm" => "text/html",
    "css" => "text/css",
    "js" => "application/javascript",
    "jpg" => "image/jpeg",
    "jpeg" => "image/jpeg",
    "png" => "image/png",
    "gif" => "image/gif",
    "svg" => "image/svg+xml",
    "ico" => "image/x-icon",
    "json" => "application/json",
    "pdf" => "application/pdf",
    "woff" => "font/woff",
    "woff2" => "font/woff2",
    "ttf" => "font/ttf",
    "eot" => "application/vnd.ms-fontobject",
    "otf" => "font/otf",
    "txt" => "text/plain",
    "xml" => "application/xml",
    "csv" => "text/csv",
    "map" => "application/json",
    "md" => "text/markdown",
    "yaml" => "application/yaml",
    "yml" => "application/yaml",
    "mp3" => "audio/mpeg",
    "mp4" => "video/mp4",
    "webp" => "image/webp",
    "webm" => "video/webm",
    "zip" => "application/zip",
    "rar" => "application/x-rar-compressed",
];

function serve_file($file_path, $allowed_static_extensions, $mime_types)
{
    $extension = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));

    // For PHP files, include them
    if ($extension === "php") {
        include $file_path;
        return true;
    }
    // For static files, serve them with appropriate mime type
    elseif (in_array($extension, $allowed_static_extensions)) {
        header(
            "Content-Type: " .
                ($mime_types[$extension] ?? "application/octet-stream")
        );
        readfile($file_path);
        return true;
    }
    // For unknown file types, still serve them but with octet-stream
    else {
        header("Content-Type: application/octet-stream");
        header(
            "Content-Disposition: attachment; filename=" . basename($file_path)
        );
        readfile($file_path);
        return true;
    }
}

$public_dir = __DIR__ . "/public";
$uri = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
$uri = str_replace("../", "", $uri);

// Handle /docs/images/* - serve from docs_build/images
if (preg_match('#^/docs/images/(.+)$#', $uri, $matches)) {
    $docs_build_dir = realpath(__DIR__ . "/docs_build");
    $file_path = realpath($docs_build_dir . "/images/" . $matches[1]);

    if ($file_path && str_starts_with($file_path, $docs_build_dir)) {
        return serve_file($file_path, $allowed_static_extensions, $mime_types);
    }

    header("HTTP/1.1 404 Not Found");
    echo "Image not found.";
    return true;
}

// Handle /docs/* redirects to docs.php
if (preg_match('#^/docs(/.*)?$#', $uri)) {
    $file_path = realpath($public_dir . "/docs.php");
    if ($file_path && is_file($file_path) && is_readable($file_path)) {
        include $file_path;
        return true;
    }
}

// Handle /api/* redirects to api.php
if (preg_match('#^/api(/.*)?$#', $uri)) {
    $file_path = realpath($public_dir . "/api.php");
    if ($file_path && is_file($file_path) && is_readable($file_path)) {
        include $file_path;
        return true;
    }
}

// Handle directory requests
if (is_dir($public_dir . $uri)) {
    if (substr($uri, -1) === "/") {
        $index_php_path = $public_dir . $uri . "index.php";
        $index_file_path = realpath($index_php_path);

        if (
            $index_file_path &&
            strpos($index_file_path, realpath($public_dir)) === 0 &&
            is_file($index_file_path) &&
            is_readable($index_file_path) &&
            strtolower(pathinfo($index_file_path, PATHINFO_EXTENSION)) === "php"
        ) {
            $uri .= "index.php";
        } else {
            header("HTTP/1.1 403 Forbidden");
            echo "Access denied: Directory listing is forbidden and no index file found.";
            return true;
        }
    } else {
        header("Location: " . $uri . "/");
        exit();
    }
}

// Handle root URL
if ($uri === "/") {
    $uri = "/index.php";
}

// Try the exact requested path
$requested_path = $public_dir . $uri;
$file_path = realpath($requested_path);

// Security check - make sure the file is within the public directory
if (
    $file_path &&
    strpos($file_path, realpath($public_dir)) === 0 &&
    is_file($file_path) &&
    is_readable($file_path)
) {
    if (serve_file($file_path, $allowed_static_extensions, $mime_types)) {
        return true;
    }
}

// Try adding .php extension if no extension exists
$original_uri_path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
$original_uri_path = str_replace("../", "", $original_uri_path);

if (!$file_path && pathinfo($original_uri_path, PATHINFO_EXTENSION) === "") {
    $php_uri = rtrim($original_uri_path, "/") . ".php";
    $potential_php_path = $public_dir . $php_uri;
    $php_file_path = realpath($potential_php_path);

    if (
        $php_file_path &&
        strpos($php_file_path, realpath($public_dir)) === 0 &&
        is_file($php_file_path) &&
        is_readable($php_file_path)
    ) {
        if (
            serve_file($php_file_path, $allowed_static_extensions, $mime_types)
        ) {
            return true;
        }
    }
}

// Not found
header("HTTP/1.1 404 Not Found");
chdir($public_dir);
include "404.php";
return true;
?>
