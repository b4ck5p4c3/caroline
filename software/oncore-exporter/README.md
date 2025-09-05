# Oncore Exporter • Project Caroline

Metrics exporter for Oncore GPS devices.

Designed to be used alongside with refclock_oncore driver in ntpd or ntpsec, it
reads binary frames from the same serial port as the driver, and exposes metrics in Prometheus format.

## Usage

```shell
# Install dependencies
pnpm install --frozen-lockfile

# Run the exporter on port 9123
PORT=9123 pnpx tsx src/index.ts /dev/oncore.serial.0
```

## Configuration

The exporter takes the following environment variables:

- `PORT`: Port to listen on (default: `9123`)
- `HOST`: Host to bind to (default: to all available interfaces)

## License

Mozilla Public License 2.0.
