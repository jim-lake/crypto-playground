#!/bin/bash
set -e

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <file> <contract_name>"
  exit -1
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

TEMP_DIR=$(mktemp -d -t solcjs-compile)
FILE=$1
CONTRACT=$2

echo TEMP_DIR=$TEMP_DIR

$DIR/../node_modules/.bin/solcjs -v --abi --bin --via-ir --optimize --optimize-runs 200 -o $TEMP_DIR $FILE

cp $TEMP_DIR/*$CONTRACT.abi $DIR/../compiled/$CONTRACT.json
cp $TEMP_DIR/*$CONTRACT.bin $DIR/../compiled/$CONTRACT.bin

rm $TEMP_DIR/*.abi
rm $TEMP_DIR/*.bin
rmdir $TEMP_DIR
