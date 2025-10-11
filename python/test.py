import serial
import time

# Change this to your RFCOMM device
DEVICE = "/dev/rfcomm0"

# Common ELM327 baud rates
BAUD_RATES = [9600, 38400, 115200]

# Command to test
TEST_CMD = "ATZ\r"

for baud in BAUD_RATES:
    print(f"\nTrying baud rate: {baud}")
    try:
        with serial.Serial(DEVICE, baudrate=baud, timeout=2) as ser:
            # Flush input/output buffers
            ser.reset_input_buffer()
            ser.reset_output_buffer()
            
            # Send ATZ command
            ser.write(TEST_CMD.encode('utf-8'))
            time.sleep(1)  # Give device a moment to respond
            
            # Read response
            response = ser.read(ser.in_waiting or 64).decode('utf-8', errors='replace')
            if response.strip():
                print(f"Response at {baud} baud:\n{response}")
            else:
                print(f"No response at {baud} baud")
                
    except serial.SerialException as e:
        print(f"Failed to open {DEVICE} at {baud} baud: {e}")
