var UPDATE_INTERVAL_MS = 1000;
var MAX_SEEN = 120;
var MIN_ALTITUDE = 0;
var MAX_ALTITUDE = 40000;
var MIN_OPACITY = 0.25;

var MAP_OPACITY = 0.25;
var MAP_CENTER_COORDINATES = ol.proj.fromLonLat([151.1730877, -33.9399183]);
var MAP_ZOOM = 11;
var PLANE_ZOOM = 13;

var ACTIVECLASS = 'active';

function setSize() {
    var scrollbarWidth = $('body').outerWidth()-$('body').innerWidth();
    var sidebarWidth = $('div#sidebar').outerWidth()+scrollbarWidth;
    var controlBoxHeight = $('div#controlBox').outerHeight();

    $('div#sidebar').css({
        width: sidebarWidth,
        height: ($(window).height()-controlBoxHeight)
    });

    $('#map').css({
        position: 'absolute',
        width: ($(window).width()-sidebarWidth),
        height: ($(window).height()-controlBoxHeight)
    });
}

$(window).resize(function() {
    setSize();
});

setSize();

var layer = new ol.layer.Tile({ source: new ol.source.OSM() });

layer.setOpacity(MAP_OPACITY);

var map = new ol.Map({
    tooltip: false,
    target: 'map',
    layers: [layer],
    view: new ol.View({
        center: MAP_CENTER_COORDINATES,
        zoom: MAP_ZOOM
    })
});

function getAltitudeColor(plane) {
    var altitude = plane.get('altitude');

    if (altitude < MIN_ALTITUDE) {
        altitude = MIN_ALTITUDE;
    }
    else if (altitude > MAX_ALTITUDE) {
        altitude = MAX_ALTITUDE;
    }

    var n = altitude*240/(MAX_ALTITUDE-MIN_ALTITUDE);

    return 'hsl('+n+',100%,50%)';
}

function getTrackStyle(plane) {
    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: getAltitudeColor(plane),
            width: 2
        })
    });
}

function toRad(angle) {
    return angle*Math.PI/180;
}

function getPlaneStyle(plane, highlighted = false) {
    var font = '11px Menlo,Courier,monospace';
    var seen = plane.get('seen');
    var opacity = (seen > MAX_SEEN) ? MIN_OPACITY : (1-seen/MAX_SEEN*(1-MIN_OPACITY));

    var planeCall = plane.get('flight');
    if (planeCall == '') {
        planeCall = '['+plane.get('hex').toUpperCase()+']';
    }

    var r = 0;
    var g = 0;
    var b = 0;

    var planeSquawk = plane.get('squawk');
    switch (planeSquawk) {
        case '7100':
            r = 255;
            planeSquawk += ' REGA';
            font = 'bold '+font;
            break;
        case '7500':
            r = 255;
            planeSquawk += ' HI-JACK';
            font = 'bold '+font;
            break;
        case '7600':
            r = 255;
            planeSquawk += ' COMFAIL';
            font = 'bold '+font;
            break;
        case '7700':
            r = 255;
            planeSquawk += ' EMERG';
            font = 'bold '+font;
            break;
    }

    var planeShort = plane.get('plane_short');
    if (planeShort) {
        planeSquawk = planeShort+' '+planeSquawk;
    }

    var vertIndicator = ' ';
    var vertRate = plane.get('vert_rate');
    if (vertRate < 0) {
        vertIndicator = '\u2193';
    }
    else if (vertRate > 0) {
        vertIndicator = '\u2191';
    }
    var altitude = Math.round(plane.get('altitude')/100)+"";
    altitude = pad(altitude, 3, '0');

    var planeInfo = altitude+vertIndicator+Math.round(plane.get('speed')/10);

    if (highlighted && (r == 0)) {
        b = 255;
    }

    var fillColor = [r, g, b, opacity];
    var strokeColor = [r, g, b, opacity];
    var textColor = [r, g, b, opacity];

    // speed vector unit is meters per 10 seconds, i.e. where the plane is in 10 seconds
    var speed = plane.get('speed')*0.514444*10;
    var track = plane.get('track');
    var pointFrom = plane.getGeometry().getCoordinates();
    var pointTo = [
        pointFrom[0] + speed*Math.sin(toRad(track)),
        pointFrom[1] + speed*Math.cos(toRad(track))
    ];
    var line = new ol.geom.LineString([
        pointTo,
        pointFrom
    ]);

    return [
        new ol.style.Style({
            geometry: line,
            stroke: new ol.style.Stroke({
                color: strokeColor,
                width: 2
            })
        }),
        new ol.style.Style({
            image: new ol.style.Circle({
                radius: 5,
                /*
                fill: new ol.style.Fill({
                    color: fillColor
                }),
                */
                stroke: new ol.style.Stroke({
                    color: strokeColor,
                    width: 2
                })
            })
        }),
        new ol.style.Style({
            text: new ol.style.Text({
                font: font,
                text: planeCall, 
                textAlign: 'left',
                offsetX: 10,
                offsetY: -11,
                rotation: 0,
                fill: new ol.style.Fill({
                    color: textColor
                }),
            })
        }),
        new ol.style.Style({
            text: new ol.style.Text({
                font: font,
                text: planeSquawk, 
                textAlign: 'left',
                offsetX: 10,
                offsetY: 0,
                rotation: 0,
                fill: new ol.style.Fill({
                    color: textColor
                }),
            })
        }),
        new ol.style.Style({
            text: new ol.style.Text({
                font: font,
                text: planeInfo, 
                textAlign: 'left',
                offsetX: 10,
                offsetY: 11,
                rotation: 0,
                fill: new ol.style.Fill({
                    color: textColor
                }),
            })
        })
    ];
}

(function worker() {
    fetchUpdatePlaneLayer();
    setTimeout(worker, UPDATE_INTERVAL_MS);
})();

var planeLayer = new ol.layer.Vector({
    source: new ol.source.Vector()
});

var planeTrackLayer = new ol.layer.Vector({
    source: new ol.source.Vector()
});

map.addLayer(planeTrackLayer);
map.addLayer(planeLayer);

function fetchUpdatePlaneLayer() {
    $.getJSON('/data.json', function(data) {
        
        planeLayer.getSource().getFeatures().forEach(function (feature, index, array) {
            feature.set('dirty', true);
        });

        $.each(data, function () {
            if ((this.validposition == 0) || (this.seen > MAX_SEEN)) {
                return true;
            }

            var coordinates = ol.proj.fromLonLat([this.lon, this.lat]);

            var plane = planeLayer.getSource().getFeatureById(this.hex);

            if (plane) {
                // console.log('Updating plane '+this.flight+' '+this.altitude);

                var oldCoordinates = plane.getGeometry().getCoordinates();
                plane.setGeometry(new ol.geom.Point(coordinates));

                if ((oldCoordinates[0] != coordinates[0]) || (oldCoordinates[1] != coordinates[1])) {
                    // console.log('Updating track');

                    var line = new ol.geom.LineString([oldCoordinates, coordinates]);
                    var track = new ol.Feature({
                        geometry: line,
                        name: this.hex
                    });

                    track.setStyle(getTrackStyle(plane));
                    planeTrackLayer.getSource().addFeature(track);

                    var trackPoint = new ol.Feature({
                        geometry: new ol.geom.Point(coordinates),
                        name: this.hex
                    });

                    if ($('div#stripe-'+this.hex).hasClass(ACTIVECLASS)) {
                        panToLocation(plane.getGeometry().getCoordinates(), PLANE_ZOOM);
                    }
                }
            }
            else {
                // console.log('Adding plane '+this.flight);

                plane = new ol.Feature({
                    geometry: new ol.geom.Point(coordinates),
                });

                planeLayer.getSource().addFeature(plane);
            }

            plane.setId(this.hex);

            plane.set('dirty', false);
            plane.set('hex', this.hex);
            if (this.squawk == '0000') {
                plane.set('squawk', '----');
            }
            else {
                plane.set('squawk', this.squawk);
            }
            plane.set('messages', this.messages);
            plane.set('seen', this.seen);
            plane.set('altitude', this.altitude);
            plane.set('vert_rate', this.vert_rate);
            plane.set('speed', this.speed);
            plane.set('track', this.track);
            plane.set('flight', this.flight);
            plane.set('owner', this.owner);
            plane.set('immatriculation', this.immatriculation);
            plane.set('plane_short', this.plane_short);
            plane.set('plane', this.plane_full);

            var pos_text = getPositionText(this.lon, this.lat);
            plane.set('lon', pos_text[0]);
            plane.set('lat', pos_text[1]);

            updateStripe(plane);

            plane.setStyle(getPlaneStyle(plane));
        });

        planeLayer.getSource().getFeatures().forEach(function (plane, index, array) {
            if (plane.get('dirty')) {
                // console.log('Removing plane '+plane.get('flight'));
                var hex = plane.get('hex');
                planeLayer.getSource().removeFeature(plane);

                planeTrackLayer.getSource().getFeatures().forEach(function (track, index, array) {
                    if (track.get('name') == hex) {
                        planeTrackLayer.getSource().removeFeature(track);
                    }
                });

                if ($('div#stripe-'+hex).hasClass(ACTIVECLASS)) {
                    panToLocation();
                }
                $('div#stripe-'+hex).remove();
            }
        });

        var wrapper = $('div#stripeContainer');

        wrapper.find('.stripe').sort(function(a, b) {
                return a.dataset.altitude - b.dataset.altitude;
        })
        .appendTo(wrapper);

        $('div#planeCount').html(pad($('div.stripe').length, 4)+' planes on map '+pad(data.length, 4)+' planes received');
    });
}

function updateStripe(plane) {
    var hex = plane.get('hex');

    if ($('div#stripe-'+hex).length == 0) {
        $("#stripeContainer").append(
            '<div id="stripe-'+hex+'" class="stripe">'+
            '<div class="title">'+
            '<div class="callsign"></div>'+
            '<div class="immatriculation"></div>'+
            '<div class="icao24"></div>'+
            '</div>'+
            '<div class="info">'+
            '<div class="element airplane"></div>'+
            '<div class="element position pos_ns"></div>'+
            '</div>'+
            '<div class="info">'+
            '<div class="element speed"></div>'+
            '<div class="element altitude"></div>'+
            '<div class="element track"></div>'+
            '<div class="element squawk"></div>'+
            '<div class="element position pos_ew"></div>'+
            '</div>'+
            '</div>'
        );

        $('div#stripe-'+hex).click(function() {
            $('div.stripe').each(function() {
                if ($(this).attr('id') != 'stripe-'+hex) {
                    $(this).removeClass(ACTIVECLASS);
                }
            });

            if ($(this).hasClass(ACTIVECLASS)) {
                $(this).removeClass(ACTIVECLASS);
                panToLocation();
            }
            else {
                $(this).addClass(ACTIVECLASS);
                panToLocation(plane.getGeometry().getCoordinates(), PLANE_ZOOM);
            }
        });
    }

    $('div#stripe-'+hex).attr('data-altitude', plane.get('altitude'));

    var seen = plane.get('seen');
    var n = (seen >= MAX_SEEN) ? 0 : 120*(1-seen/MAX_SEEN);
    var seenColor = 'hsl('+n+',100%,50%)';
    $('div#stripe-'+hex).css('border-right-color', seenColor);

    var altitudeColor = getAltitudeColor(plane);
    $('div#stripe-'+hex).css('border-left-color', altitudeColor);

    var flight = plane.get('flight');
    $('div#stripe-'+hex+' div.callsign').html(flight);

    var immatriculation = plane.get('immatriculation');
    $('div#stripe-'+hex+' div.immatriculation').html(plane.get('plane_short'));

    $('div#stripe-'+hex+' div.icao24').html(hex.toUpperCase());

    var speed = Math.round(plane.get('speed')*1.852);
    $('div#stripe-'+hex+' div.speed').html('GS '+pad(speed, 3)+'km/h');

    var altitude = Math.round(plane.get('altitude')*0.3048);
    var vertRate = plane.get('vert_rate');
    var vertIndicator = (vertRate > 0) ? '\u2191' : ((vertRate < 0) ? '\u2193' : '&nbsp;');
    $('div#stripe-'+hex+' div.altitude').html('ALT '+pad(altitude, 5)+'m '+vertIndicator);

    $('div#stripe-'+hex+' div.track').html('HDG '+pad(plane.get('track'), 3)+'&deg;');
    $('div#stripe-'+hex+' div.squawk').html('SQK '+plane.get('squawk'));

    $('div#stripe-'+hex+' div.pos_ns').html(plane.get('lat'));
    $('div#stripe-'+hex+' div.pos_ew').html(plane.get('lon'));

    $('div#stripe-'+hex+' div.icao24').html(plane.get('owner'));
    $('div#stripe-'+hex+' div.airplane').html(plane.get('plane')+' ('+immatriculation+')');
}

function pad(string, length, character='&nbsp;') {
    string += '';
    var parts = string.split(".", 2);
    var full = parts[0];

    var delta = (length - full.length);

    if (delta > 0) {
        for (i = 0; i < delta; i++) {
            string = character+string;
        }
    }

    return string;
}

function panToLocation(coordinates=MAP_CENTER_COORDINATES, zoom=MAP_ZOOM) {
    map.getView().animate({zoom: zoom, center: coordinates});

    return;
}

function deg2dm(deg) {
    var d = parseInt(deg);
    var m = Math.round(Math.abs(deg - d) * 60 * 100)/100;

    m += '';
    parts = m.split('.', 2);

    if (parts.length == 1) {
        m = m+'.00';
    }
    else if (parts[1].length == 1) {
        m = m+'0';
    }

    return [d, m];
}

function getPositionText(lon, lat) {
    var lon_text;
    if (lon < 0) {
        lon_text = 'W';
        lon *= -1;
    }
    else {
        lon_text = 'E';
    }
    var lon = deg2dm(lon);
    lon_text = lon_text+pad(lon[0], 3, '0')+"&deg;"+pad(lon[1], 2, '0')+"'";

    var lat_text;
    if (lat < 0) {
        lat_text = 'S ';
        lat *= -1;
    }
    else {
        lat_text = 'N ';
    }
    var lat = deg2dm(lat);
    lat_text = lat_text+pad(lat[0], 2, '0')+"&deg;"+pad(lat[1], 2, '0')+"'";

    return [lon_text, lat_text];
}
