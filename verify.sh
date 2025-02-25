#!/bin/bash

# Check if text argument is provided
if [ $# -eq 0 ]; then
    echo "Please provide a text argument"
    exit 1
fi

# Get the text argument
text=$1

# Run curl command with the provided text
curl 'http://localhost:3000/b850bc30-45f8-0041-a00a-83df46d8555d/verify-claim' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    --data-raw "{\"text\":\"$text\",\"user\":\"user\"}"
