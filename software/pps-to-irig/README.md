# pps-to-irig

Simple C program to send IRIG J-xy serial data on PPS assert

Build flags:

- `PPS_WAIT_TIMEOUT` - PPS assert wait timeout in seconds
- `IRIG_VARIANT_X` - 'x' value of IRIG J-xy standard
- `IRIG_VARIANT_Y` - 'y' value of IRIG J-xy standard

Usage: `./pps-to-irig <PPS device> <serial device>`
Example: `./pps-to-irig /dev/pps0 /dev/ttyUSB0`
