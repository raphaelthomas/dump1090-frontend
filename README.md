# dump1090-frontend

A frontend for data fed by dump1090 using OpenLayers and OpenStreetMap.

## Installation

1. Run dump1090 with the --net option.
1. Setup nginx on your machine and point the web root directory to `www`.
1. Run the `airplane-info-server.pl` script after configuring it with the IP
and port of the dump1090 process (can be remote).
1. Add the `proxy_pass` configuration as shown in the nginx configuration
snippet and point it to the `airplane-info-server.pl`.
1. Open index.html in a browser and checkout the map ;-)

## Limitations

* Only tested with nginx and Chrome.
