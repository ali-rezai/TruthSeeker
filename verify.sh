#!/bin/bash

# Check if text argument is provided
if [ $# -eq 0 ]; then
    echo "Please provide a text argument"
    exit 1
fi

# Get the text argument
text=$1

escape() {
    echo "$1" | sed 's/"/\\"/g' | perl -pe 's/\n/\\n/g'
}

########################################################
# BLUE - RED - AGGREGATOR
########################################################

echo "Running verification: BLUE -> RED -> AGGREGATOR"
echo "================================================"

# Blue team
blue_response=$(curl 'http://localhost:3000/truthseeker/verify-claim-1' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    --data-raw "{\"team\":\"blue\", \"text\":\"$text\", \"user\":\"user\"}")

blue_information=$(echo "$blue_response" | jq -r '.queryResults')
blue_decision=$(echo "$blue_response" | jq -r '.decision')

escaped_blue_information=$(escape "$blue_information")
escaped_blue_decision=$(escape "$blue_decision")

echo "Blue team decision: $blue_decision"
echo "================================================"

# Red team
red_response=$(curl 'http://localhost:3000/truthseeker/verify-claim-1' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    --data-raw "{\"team\":\"red\",\"prevTeamInformation\":\"$escaped_blue_information\",\"prevTeamDecision\":\"$escaped_blue_decision\",\"text\":\"$text\",\"user\":\"user\"}")

red_information=$(echo "$red_response" | jq -r '.queryResults')
red_decision=$(echo "$red_response" | jq -r '.decision')

escaped_red_decision=$(escape "$red_decision")
escaped_red_information=$(escape "$red_information")

echo "Red team decision: $red_decision"
echo "================================================"

# Aggregator
aggregator_response=$(curl 'http://localhost:3000/truthseeker/verify-claim-2' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    --data-raw "{\"blueTeamDecision\":\"$escaped_blue_decision\",\"redTeamDecision\":\"$escaped_red_decision\",\"blueTeamInformation\":\"$escaped_blue_information\",\"redTeamInformation\":\"$escaped_red_information\",\"text\":\"$text\",\"user\":\"user\"}")

echo "Aggregator decision: $aggregator_response"
