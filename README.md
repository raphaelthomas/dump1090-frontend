# dump1090-frontend-switzerland

A frontend for data fed by dump1090 using the API from map.geo.admin.ch.

## Installation

1. Run dump1090 with the --net option.
1. Setup nginx on your machine and place index.html in the configured www
directory.
1. Add the `proxy_pass` configuration as shown in the nginx configuration
snippet and edit the IP address to point to the machine where dump1090 is
running.
