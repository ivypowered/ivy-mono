<?php

/**
 * Helper function to format time elapsed since creation (Unix timestamp)
 *
 * @param int $timestamp Unix timestamp.
 * @return string Human-readable time difference.
 */
function fmt_timestamp($timestamp)
{
    if (!is_numeric($timestamp) || $timestamp <= 0) {
        return "some time ago"; // Handle invalid timestamps
    }
    $current_time = time();
    $time_difference = $current_time - $timestamp;

    if ($time_difference < 60) {
        $value = $time_difference;
        return $value . ($value === 1 ? " second" : " seconds") . " ago";
    } elseif ($time_difference < 3600) {
        $value = floor($time_difference / 60);
        return $value . ($value === 1 ? " minute" : " minutes") . " ago";
    } elseif ($time_difference < 86400) {
        $value = floor($time_difference / 3600);
        return $value . ($value === 1 ? " hour" : " hours") . " ago";
    } elseif ($time_difference < 2592000) {
        // Approx 30 days
        $value = floor($time_difference / 86400);
        return $value . ($value === 1 ? " day" : " days") . " ago";
    } elseif ($time_difference < 31536000) {
        // Approx 365 days
        $value = floor($time_difference / 2592000);
        return $value . ($value === 1 ? " month" : " months") . " ago";
    } else {
        $value = floor($time_difference / 31536000);
        return $value . ($value === 1 ? " year" : " years") . " ago";
    }
}

/**
 * Helper function to format large numbers into K, M, B format.
 *
 * @param float|int $number The number to format.
 * @param int $precision The number of decimal places.
 * @return string Formatted number string with suffix.
 */
function fmt_number_short($number, $precision = 1)
{
    if (!is_numeric($number)) {
        return "N/A";
    }

    if ($number < 1000) {
        // No suffix for numbers less than 1000
        return number_format($number, 0);
    } elseif ($number < 1000000) {
        // Kilo
        $formatted = $number / 1000;
        return number_format($formatted, $precision) . "K";
    } elseif ($number < 1000000000) {
        // Mega
        $formatted = $number / 1000000;
        return number_format($formatted, $precision) . "M";
    } else {
        // Giga (Billion)
        $formatted = $number / 1000000000;
        return number_format($formatted, $precision) . "B";
    }
}

?>
