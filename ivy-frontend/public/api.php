<?php
// Allow CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header(
    "Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization",
);

// Handle preflight OPTIONS request
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

// Include API helper functions
require_once __DIR__ . "/../includes/api.php"; // Uses call_backend() and call_aggregator()

// --- Helper Functions ---

/**
 * Sends a JSON response.
 * @param string $status Status ("ok" or "err").
 * @param mixed $data Data payload or error message.
 * @param int $code HTTP status code.
 */
function send_response($status, $data, $code = 200)
{
    // Set content type to JSON (moved here to avoid setting for SSE)
    header("Content-Type: application/json");

    http_response_code($code);
    if ($status == "ok") {
        echo json_encode([
            "status" => "ok",
            "data" => $data,
        ]);
    } else {
        echo json_encode([
            "status" => $status,
            "msg" => $data,
        ]);
    }
    exit();
}

/**
 * Proxies Server-Sent Events stream from Backend API.
 * @param string $path API path relative to backend base URL.
 */
function proxy_sse_to_backend($path)
{
    // Disable all output buffering BEFORE setting headers
    while (ob_get_level()) {
        ob_end_clean();
    }

    // Set SSE headers
    header("Content-Type: text/event-stream");
    header("Cache-Control: no-cache");
    header("Connection: keep-alive");
    header("X-Accel-Buffering: no"); // Disable Nginx buffering

    // Disable compression and buffering
    @ini_set("output_buffering", "off");
    @ini_set("zlib.output_compression", false);
    @ini_set("implicit_flush", 1);

    // Build full path with query string
    $query_string = http_build_query($_GET);
    $full_path = $path . ($query_string ? "?" . $query_string : "");
    $url = AGGREGATOR_API_URL . $full_path;

    // First, check if allow_url_fopen is enabled
    if (!ini_get("allow_url_fopen")) {
        echo "event: error\n";
        echo "data: " .
            json_encode(["error" => "allow_url_fopen is disabled"]) .
            "\n\n";
        @flush();
        exit();
    }

    // Try using cURL instead of fopen for better SSE support
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_HEADER => false,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_WRITEFUNCTION => function ($ch, $data) {
            // Write data directly to output
            echo $data;
            @ob_flush();
            @flush();
            return strlen($data);
        },
        CURLOPT_HTTPHEADER => [
            "Accept: text/event-stream",
            "Cache-Control: no-cache",
            isset($_SERVER["HTTP_AUTHORIZATION"])
                ? "Authorization: " . $_SERVER["HTTP_AUTHORIZATION"]
                : null,
        ],
        CURLOPT_SSL_VERIFYPEER => false, // Only for local development
        CURLOPT_SSL_VERIFYHOST => false, // Only for local development
        CURLOPT_BUFFERSIZE => 128,
        CURLOPT_NOPROGRESS => false,
        CURLOPT_PROGRESSFUNCTION => function () {
            // Check if client disconnected
            if (connection_aborted()) {
                return 1; // Return non-zero to abort
            }
            return 0;
        },
    ]);

    // Execute the request
    $result = curl_exec($ch);

    if ($result === false) {
        $error = curl_error($ch);
        echo "event: error\n";
        echo "data: " .
            json_encode(["error" => "cURL error: " . $error]) .
            "\n\n";
        @flush();
    }

    curl_close($ch);
    exit();
}

/**
 * Proxies request to Aggregator API.
 * @param string $path API path relative to aggregator base URL.
 */
function proxy_to_aggregator($path)
{
    $query_string = http_build_query($_GET);
    $full_path = $path . ($query_string ? "?" . $query_string : "");
    try {
        send_response("ok", call_aggregator($full_path));
    } catch (Exception $e) {
        send_response("err", $e->getMessage(), 500);
    }
}

/**
 * Proxies request to Backend API.
 * @param string $path API path relative to backend base URL.
 * @param string $method HTTP request method.
 * @param array|null $data Optional request data.
 */
function proxy_to_backend($path, $method, $data = null)
{
    $query_string = http_build_query($_GET);
    $full_path = $path . ($query_string ? "?" . $query_string : "");
    try {
        send_response("ok", call_backend($full_path, $method, $data));
    } catch (Exception $e) {
        send_response("err", $e->getMessage(), 500);
    }
}

// --- Request Processing ---

$request_method = $_SERVER["REQUEST_METHOD"];
$uri_path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);

// Extract path after /api/
$api_prefix = "/api/";
if (!str_starts_with($uri_path, $api_prefix)) {
    send_response("err", "Invalid API path structure", 404);
}
$path = "/" . trim(substr($uri_path, strlen($api_prefix)), "/");

// Get request body for POST
$request_data = null;
if ($request_method === "POST") {
    $request_body = file_get_contents("php://input");
    if (!empty($request_body)) {
        $request_data = json_decode($request_body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            send_response(
                "err",
                "Invalid JSON in request body: " . json_last_error_msg(),
                400,
            );
        }
    }
}

// --- Regex Route Matching ---

$path = $path === "" ? "/" : $path; // Handle root path
$method_path = "$request_method $path"; // Combine method and path for matching

// Define regex patterns with actions
$routes = [
    ["pattern" => "#^GET /$#i", "action" => "timestamp"],
    [
        "pattern" => "#^GET /games/[^/]+/stream$#i",
        "action" => "sse",
    ],
    [
        "pattern" => "#^GET /games/[^/]+/balances/[^/]+$#i",
        "action" => "backend",
    ],
    [
        "pattern" => "#^POST /games/[^/]+/withdraws/[^/]+$#i",
        "action" => "backend",
    ],
    [
        "pattern" => "#^GET /games#i",
        "action" => "aggregator",
    ],
    ["pattern" => "#^GET /comments#i", "action" => "aggregator"],
    ["pattern" => "#^GET /ivy#i", "action" => "aggregator"],
    ["pattern" => "#^GET /id$#i", "action" => "backend"],
    ["pattern" => "#^POST /tx/send$#i", "action" => "backend"],
    ["pattern" => "#^GET /tx/confirm#i", "action" => "backend"],
    ["pattern" => "#^GET /tx/effects#i", "action" => "backend"],
    ["pattern" => "#^POST /accounts-data$#i", "action" => "backend"],
    ["pattern" => "#^POST /token-balance$#i", "action" => "backend"],
    ["pattern" => "#^POST /treasury-balance$#i", "action" => "backend"],
    ["pattern" => "#^POST /tx-token-deltas$#i", "action" => "backend"],
    ["pattern" => "#^GET /ctx#i", "action" => "backend"],
    ["pattern" => "#^GET /world-alt$#i", "action" => "backend"],
];

// Match route
$action = null;
foreach ($routes as $route) {
    if (preg_match($route["pattern"], $method_path)) {
        $action = $route["action"];
        break;
    }
}

// Execute action
if ($action) {
    if ($action === "timestamp") {
        send_response("ok", time());
    } elseif ($action === "sse") {
        proxy_sse_to_backend($path);
    } elseif ($action === "aggregator") {
        proxy_to_aggregator($path);
    } elseif ($action === "backend") {
        proxy_to_backend($path, $request_method, $request_data);
    }
} else {
    send_response("err", "Endpoint not found: $path", 404);
}
?>
