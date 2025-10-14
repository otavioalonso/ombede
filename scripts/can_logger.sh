#!/bin/bash

INTERFACE="can0"
LOGDIR="/home/ota/canlogs"
LOGFILE="$LOGDIR/canlog_$(date +'%Y%m%d_%H%M%S').log"
USER="ota"

# Create log directory if it doesn't exist
if [ ! -d "$LOGDIR" ]; then
	mkdir -p "$LOGDIR"
	chown "$USER":"$USER" "$LOGDIR"
	chmod 755 "$LOGDIR"
fi

# Start logging CAN data
/usr/bin/candump -L "$INTERFACE" | awk '{print substr($1, 2, length($1)-2),$3}' > "$LOGFILE"
