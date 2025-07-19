<?php
require_once __DIR__ . "/constants.php";

/**
 * General purpose API request helper.
 * Assumes the remote API returns JSON.
 * Throws exceptions for cURL, network, and JSON decoding errors.
 *
 * @param string $url Full URL to the API endpoint.
 * @param string $method HTTP method (GET, POST, PUT, DELETE).
 * @param array|null $data Data to send. For POST/PUT, will be JSON encoded. For GET, will be query parameters.
 * @return mixed Decoded JSON response from the API.
 * @throws Exception On request failure, network error, or invalid response.
 */
function api_request($url, $method = "GET", $data = null)
{
    $ch = curl_init();
    $method = strtoupper($method);

    $default_headers = ["Accept: application/json"];
    if ($method === "POST" || $method === "PUT") {
        $default_headers[] = "Content-Type: application/json";
    }

    // Handle GET requests with data by appending query parameters
    if ($method === "GET" && $data !== null && is_array($data)) {
        // Add query parameters to URL
        $query = http_build_query($data);
        $url =
            strpos($url, "?") !== false
                ? $url . "&" . $query
                : $url . "?" . $query;
    }

    $options = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5, // Connection timeout (seconds)
        CURLOPT_TIMEOUT => 15, // Total timeout (seconds)
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $default_headers,
    ];

    if (($method === "POST" || $method === "PUT") && $data !== null) {
        $options[CURLOPT_POSTFIELDS] = json_encode($data);
        // Check for JSON encoding errors
        if (json_last_error() !== JSON_ERROR_NONE) {
            curl_close($ch); // Ensure curl handle is closed
            throw new Exception(
                "Internal error preparing request data: " .
                    json_last_error_msg()
            );
        }
    }

    curl_setopt_array($ch, $options);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    $errno = curl_errno($ch);

    curl_close($ch);

    // Handle cURL errors (network, timeout, connection refused, etc.)
    if ($errno) {
        throw new Exception("cURL Error ({$errno}) calling {$url}: {$error}");
    }

    // Handle potentially empty responses
    if (!$response) {
        throw new Exception(
            "Empty response from API ({$url}) with HTTP code: {$http_code}"
        );
    }

    // Decode the JSON response
    $decoded = json_decode($response, true);

    // Handle JSON decoding errors
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception(
            "Failed to decode API response: " . json_last_error_msg()
        );
    }

    // Ensure the response is an array
    if (!is_array($decoded)) {
        throw new Exception(
            "Invalid response from API ({$url}) with HTTP code: {$http_code}"
        );
    }

    // If status is "err", throw an exception
    if ($decoded["status"] === "err") {
        throw new Exception($decoded["msg"]);
    }

    // If status is "ok", return the data
    if ($decoded["status"] === "ok") {
        return $decoded["data"];
    }

    // If status is unknown, throw an exception
    throw new Exception(
        "Unknown status from API ({$url}) with HTTP code: {$http_code}"
    );
}

/**
 * Makes a request to the Backend API.
 *
 * @param string $endpoint API endpoint (e.g., "/upload-game").
 * @param string $method HTTP method.
 * @param array|null $data Data payload for POST/PUT, or query parameters for GET.
 * @return mixed Decoded response from the backend API.
 * @throws Exception On request failure.
 */
function call_backend($endpoint, $method = "GET", $data = null)
{
    $url = rtrim(BACKEND_API_URL, "/") . "/" . ltrim($endpoint, "/");
    return api_request($url, $method, $data);
}

/**
 * Makes a request to the Aggregator API.
 *
 * @param string $endpoint API endpoint (e.g., "/games/hot").
 * @param array|null $data Query parameters for GET requests.
 * @return mixed Decoded response from the aggregator API.
 * @throws Exception On request failure.
 */
function call_aggregator($endpoint, $data = null)
{
    $url = rtrim(AGGREGATOR_API_URL, "/") . "/" . ltrim($endpoint, "/");
    return api_request($url, "GET", $data);
}

?>
