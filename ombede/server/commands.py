import serial
import threading

port = "/dev/rfcomm0"
baudrate = 9600

def read_from_port(ser):
    while True:
        try:
            data = ser.readline()
            if data:
                print(f"\n{data.decode(errors='ignore').strip()}", end="")
        except Exception as e:
            print(f"\nError reading: {e}")
            break

def main():
    ser = serial.Serial(port, baudrate, timeout=1)
    print(f"CONNECTED {port} ({baudrate})")
    threading.Thread(target=read_from_port, args=(ser,), daemon=True).start()

    try:
        while True:
            cmd = input("")
            if cmd.lower() in ('exit', 'quit'):
                break
            ser.write((cmd + '\n').encode())
    except KeyboardInterrupt:
        print("\nQUIT")
    finally:
        ser.close()

if __name__ == "__main__":
    main()