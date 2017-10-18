#!/usr/bin/env bash

# shamelessly stolen from https://grosinger.net/blog/2017-09-18-running-tiddlywiki/

set -e

previous=$(ls -t ${DATA_DIR}/backup|awk 'NR==1')
next="wiki.$(date +%Y%m%d-%H%M).tar.bz2"

cd $DATA_DIR
tar -cjf ${DATA_DIR}/backup/${next} wiki

cd ${DATA_DIR}/backup

md5_previous=$(md5sum ${previous}|awk '{print $1}')
md5_next=$(md5sum ${next}|awk '{print $1}')

if [ "${md5_previous}" == "${md5_next}" ]; then
    # Don't store the backup if it is the same
    echo "Removing the old one"
    rm $next
else
    echo "Not removing the old one"
    # Keep the last 300 archives
    rm -f `ls -t | awk 'NR>300'`
fi
