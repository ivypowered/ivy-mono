#!/bin/sh
if [ -z "$1" ]; then
    echo "Please provide an icon name as an argument."
    exit 1
fi

if ! [ -d "icons" ]; then
    mkdir icons
fi

cd icons
curl -O -L "https://raw.githubusercontent.com/lucide-icons/lucide/refs/heads/main/icons/$1.svg"
cd ..
