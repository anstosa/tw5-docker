#!/usr/bin/env sh

set -e

export TIDDLYWIKI="/var/lib/wiki/server/node_modules/.bin/tiddlywiki"

if [ ! -d /var/lib/wiki/data/wiki ]; then
    $TIDDLYWIKI wiki --init server
fi

/var/lib/wiki/server/auth.js
