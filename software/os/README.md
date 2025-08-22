# OS • Project Caroline

Current platform for NTP server itself is a Raspberry Pi 4, running Raspberry Pi OS Lite arm64.
This directory contains crucial configuration files for the NTP server and its related services.

## ntpsec

ntpsec packages in mainline distros usually come without legacy refclock drivers,
including Motorola Oncore GPS (refclock_oncore.c) we use.

Building ntpsec from source allows us to include these legacy refclocks:

```shell
# Enable source indexes
# This file will include a comment about enabling source indexes.
nano /etc/apt/sources.list

# Update indexes
apt update

# Fetch source packages
apt source ntpsec

# Jump into ntpsec dir
cd ntpsec-*

# Install build depdendencies
./buildprep

# Build ntpsec with all known refclocks included
./waf build --refclock=all

# Install
./waf install
```

You might need to manually set up systemd service. Reference files are in the `etc` directory.
