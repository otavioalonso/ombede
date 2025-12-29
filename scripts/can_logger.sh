#!/bin/bash

INTERFACE="can0"
USER=$USER
LOGDIR="/home/$USER/canlogs"
LOGFILE="$LOGDIR/canlog_$(date +'%Y%m%d_%H%M%S').log"
MAXSIZE=$((40 * 1024 * 1024 * 1024)) # 40GB in bytes

# Create log directory if it doesn't exist
if [ ! -d "$LOGDIR" ]; then
	mkdir -p "$LOGDIR"
	chown "$USER":"$USER" "$LOGDIR"
	chmod 755 "$LOGDIR"
fi
	
# Check if directory is larger than MAXSIZE
DIRSIZE=$(du -sb "$LOGDIR" | awk '{print $1}')
if [ "$DIRSIZE" -gt $MAXSIZE ]; then
	echo "Log directory is larger than MAXSIZE. Skipping logging."
	exit 0
fi

# Start logging CAN data
/usr/bin/candump -L "$INTERFACE" | awk '{print substr($1, 2, length($1)-2),$3}' > "$LOGFILE"
