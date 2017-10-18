#!/usr/bin/env sh

set -e

username="${USERNAME:-user}"
TIDDLYWIKI="/var/lib/wiki/server/node_modules/.bin/tiddlywiki"
PORT="8888"

if [ ! -d /var/lib/wiki/data/wiki ]; then
    $TIDDLYWIKI wiki --init server
fi

/var/lib/wiki/server/auth.js & $TIDDLYWIKI wiki --server $PORT $:/core/save/lazy-all text/plain text/html $username "" 0.0.0.0
