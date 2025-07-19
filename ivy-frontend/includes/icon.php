<?php

/**
 * SVG inline helper function
 * Creates inline SVGs with the provided class name
 *
 * @param string $icon Name of the SVG file (without extension)
 * @param string $class_name Classes to add to the SVG
 * @return string The inline SVG with applied classes
 */
function icon($icon, $class_name = "")
{
    $icon_path = __DIR__ . "/../icons/{$icon}.svg";

    if (!file_exists($icon_path)) {
        return "<!-- SVG {$icon} not found -->";
    }

    $svg = file_get_contents($icon_path);

    // If there are classes to add
    if (!empty($class_name)) {
        $svg = str_replace("<svg", '<svg class="' . $class_name . '"', $svg);
    }

    return $svg;
}

?>
