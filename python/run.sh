sudo rfcomm bind hci0 AA:BB:CC:11:22:33
python ombede.py
bluetoothctl disconnect AA:BB:CC:11:22:33 > /dev/null
sudo rfcomm release all
