var UPDATE_INTERVAL_MS = 1000;
var MAX_SEEN = 120;
var MIN_ALTITUDE = 0;
var MAX_ALTITUDE = 40000;
var MIN_OPACITY = 0.25;

var MAP_CENTER_COORDINATES = [8.56, 47.38];
var ZOOM = 9;
var ZOOM_FOCUS = 10;

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

var view = new ol.View({
    center: ol.proj.fromLonLat(MAP_CENTER_COORDINATES),
    extent: ol.proj.get('EPSG:3857').getExtent(),
    zoom: ZOOM
});

var map = new ol.Map({
    interactions: ol.interaction.defaults({
        doubleClickZoom: false,
        dragAndDrop: false,
        dragPan: false,
        keyboardPan: false,
        keyboardZoom: false,
        mouseWheelZoom: false,
        pointer: false,
        select: false
    }),
    layers: [
        new ol.layer.Tile({
            source: new ol.source.OSM({
                // url : "http://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
                url : "http://{a-c}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
                wrapX: false
            })
        })
    ],
    target: 'map',
    view: view
});

// var cloudLayer = new ol.layer.Tile({
//     source: new ol.source.XYZ({
//         url: 'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=KEY',
//     })
// });
// var precipitationLayer = new ol.layer.Tile({
//     source: new ol.source.XYZ({
//         url: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=KEY',
//     })
// });
// map.addLayer(cloudLayer);
// map.addLayer(precipitationLayer);

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

var staticLayer = new ol.layer.Vector({
    source: new ol.source.Vector()
});

map.addLayer(staticLayer);
map.addLayer(planeTrackLayer);
map.addLayer(planeLayer);

updateStaticLayer();

function updateStaticLayer() {
    updateReceiverLocation();
    updateNavAid();
}

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
    var trackColor = getAltitudeColor(plane);

    return new ol.style.Style({
        image: new ol.style.Circle({
            radius: 1,
            fill: new ol.style.Fill({
                color: trackColor
            }),
        }),
        stroke: new ol.style.Stroke({
            color: trackColor,
            width: 2
        })
    });
}

function toRad(angle) {
    return angle*Math.PI/180;
}

function getReceiverStyle(receiver) {
    var font = '11px Menlo,Courier,monospace';

    var r = 80;
    var g = 40;
    var b = 40;

    var color = [r, g, b];

    var style = [
        new ol.style.Style({
            image: new ol.style.Circle({
                radius: 1,
                fill: new ol.style.Fill({
                    color: color
                }),
                stroke: new ol.style.Stroke({
                    color: color,
                    width: 1
                })
            })
        }),
    ];

    var i;
    for (i = 1; i <= 20; i++) {
        style.push(
            new ol.style.Style({
                image: new ol.style.Circle({
                    radius: i*100,
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: 1
                    })
                })
            })
        );
    }

    return style;
}

function getNavAidStyle(navaid) {
    var font = '11px Menlo,Courier,monospace';

    var r = 75;
    var g = 150;
    var b = 75;

    var color = [r, g, b];

    var style = [
        new ol.style.Style({
            image: new ol.style.Circle({
                radius: 1,
                fill: new ol.style.Fill({
                    color: color
                }),
                stroke: new ol.style.Stroke({
                    color: color,
                    width: 1
                })
            })
        }),
        new ol.style.Style({
            text: new ol.style.Text({
                font: font,
                text: navaid.get('type'),
                textAlign: 'left',
                offsetX: 10,
                offsetY: 6,
                rotation: 0,
                fill: new ol.style.Fill({
                    color: color
                }),
            })
        }),
        new ol.style.Style({
            text: new ol.style.Text({
                font: font,
                text: navaid.get('short')+' '+navaid.get('freq'),
                textAlign: 'left',
                offsetX: 10,
                offsetY: -6,
                rotation: 0,
                fill: new ol.style.Fill({
                    color: color
                }),
            })
        }),
    ];

    if (navaid.get('type') == 'NDB') {
        style.push(
            new ol.style.Style({
                image: new ol.style.Circle({
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: 1
                    }),
                    radius: 5
                })
            }),
        );
    }
    else if (navaid.get('type') == 'DME') {
        style.push(
            new ol.style.Style({
                image: new ol.style.RegularShape({
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: 1
                    }),
                    angle: Math.PI / 4,
                    points: 4,
                    radius: 5
                })
            }),
        );
    }
    else {
        style.push(
            new ol.style.Style({
                image: new ol.style.RegularShape({
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: 1
                    }),
                    angle: Math.PI / 6,
                    points: 6,
                    radius: 5
                })
            }),
        );
    }

    return style;
}

function getPlaneStyle(plane, highlighted = false) {
    var font = '11px Menlo,Courier,monospace';
    var seen = plane.get('seen');
    var opacity = (seen > MAX_SEEN) ? MIN_OPACITY : (1-seen/MAX_SEEN*(1-MIN_OPACITY));

    var planeCall = plane.get('flight');
    if (planeCall == '') {
        planeCall = '['+plane.get('hex').toUpperCase()+']';
    }

    var r = 255;
    var g = 255;
    var b = 255;
    // var r = 0;
    // var g = 0;
    // var b = 0;

    var planeSquawk = plane.get('squawk');
    switch (planeSquawk) {
        case '7100':
            r = 255;
            g = 0;
            b = 0;
            planeSquawk += ' REGA';
            break;
        case '7500':
            r = 255;
            g = 0;
            b = 0;
            planeSquawk += ' HI-JACK';
            break;
        case '7600':
            r = 255;
            g = 0;
            b = 0;
            planeSquawk += ' COMFAIL';
            break;
        case '7700':
            r = 255;
            g = 0;
            b = 0;
            planeSquawk += ' EMERG';
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

    // speed vector unit is meters per 15 seconds, i.e. where the plane is in 10 seconds
    var speed = plane.get('speed')*0.514444*15;
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
                radius: 4,
                // fill: new ol.style.Fill({
                //     color: fillColor
                // }),
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

function updateReceiverLocation() {
    $.getJSON('/receiver.json', function(data) {
        console.log(data);
        var coordinates = ol.proj.transform([data.receiver.longitude, data.receiver.latitude], 'EPSG:4326', 'EPSG:3857');
        receiver = new ol.Feature({
            geometry: new ol.geom.Point(coordinates),
        });

        staticLayer.getSource().addFeature(receiver);
        receiver.setStyle(getReceiverStyle(receiver));
        map.getView().setCenter(coordinates);
    });
}

function updateNavAid() {
    $.getJSON('/navaid.json', function(data) {
        $.each(data, function () {
            var coordinates = ol.proj.transform([this.longitude, this.latitude], 'EPSG:4326', 'EPSG:3857');
            navaid = new ol.Feature({
                geometry: new ol.geom.Point(coordinates),
            });

            navaid.set('short', this.short);
            navaid.set('name', this.name);
            navaid.set('freq', this.frequency);
            navaid.set('type', this.type);

            staticLayer.getSource().addFeature(navaid);
            navaid.setStyle(getNavAidStyle(navaid));
        });
    });
}

function fetchUpdatePlaneLayer() {
    $.getJSON('/data.json', function(data) {
        planeLayer.getSource().getFeatures().forEach(function (feature, index, array) {
            feature.set('dirty', true);
        });

        $.each(data.planes, function () {
            if ((this.validposition == 0) || (this.seen > MAX_SEEN)) {
                return true;
            }

            var coordinates = ol.proj.transform([this.lon, this.lat], 'EPSG:4326', 'EPSG:3857');

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
                        geometry: new ol.geom.Point(oldCoordinates),
                        name: this.hex
                    });

                    trackPoint.setStyle(getTrackStyle(plane));
                    planeTrackLayer.getSource().addFeature(trackPoint);

                    if ($('div#stripe-'+this.hex).hasClass(ACTIVECLASS)) {
                        panToLocation(plane.getGeometry().getCoordinates(), ZOOM_FOCUS);
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

        var wrapper = $('div#sidebar');

        wrapper.find('.stripe').sort(function(a, b) {
            var val_a = a.dataset.sort;
            var val_b = b.dataset.sort;

            if (isNumber(val_a) && isNumber(val_b)) {
                return val_a - val_b;
            }
            else {
                return val_a.localeCompare(val_b);
            }
        })
        .appendTo(wrapper);

        $('div#planeCount').html(pad($('div.stripe').length, 3, '0')+' planes on map '+pad(data.planes.length, 3, '0')+' planes received');

        $('div#time').html(data.time);
    });
}

function isNumber(n) {
    return /^-?[\d.]+(?:e-?\d+)?$/.test(n);
}

function updateStripe(plane) {
    var hex = plane.get('hex');

    if ($('div#stripe-'+hex).length == 0) {
        $("#sidebar").append(
            '<div id="stripe-'+hex+'" class="stripe">'+
            '<div class="title">'+
            '<div class="element callsign"></div>'+
            '<div class="element immatriculation"></div>'+
            '<div class="element airplane_short"></div>'+
            '<div class="element squawk"></div>'+
            '</div>'+
            '<div class="details">'+
            '<div class="detailsection">'+
            '<div class="line subtitle">TRACKING</div>'+
            '<div class="line">'+
            '<div class="label">Squawk</div>'+
            '<div class="value squawk"></div>'+
            '</div>'+
            '<div class="line">'+
            '<div class="label">Speed</div>'+
            '<div class="value speed"></div>'+
            '</div>'+
            '<div class="line">'+
            '<div class="label">Altitude</div>'+
            '<div class="value altitude"></div>'+
            '</div>'+
            '<div class="line">'+
            '<div class="label">Heading</div>'+
            '<div class="value track"></div>'+
            '</div>'+
            '<div class="line">'+
            '<div class="label">Position</div>'+
            '<div class="value position"></div>'+
            '</div>'+
            '</div>'+
            '<div class="detailsection">'+
            '<div class="line subtitle">AIRCRAFT</div>'+
            '<div class="line">'+
            '<div class="label">Owner</div>'+
            '<div class="value airline"></div>'+
            '</div>'+
            '<div class="line">'+
            '<div class="label">Type</div>'+
            '<div class="value airplane"></div>'+
            '</div>'+
            '<div class="line">'+
            '<div class="label">Immatriculation</div>'+
            '<div class="value immatriculation"></div>'+
            '</div>'+
            '<div class="line">'+
            '<div class="label">ICAO Address</div>'+
            '<div class="value icao24"></div>'+
            '</div>'+
            '</div>'+
            '<div class="detailsection">'+
            '<div class="line subtitle">META</div>'+
            '<div class="line">'+
            '<div class="label">Last Time Seen</div>'+
            '<div class="value lts"></div>'+
            '</div>'+
            '<div class="line">'+
            '<div class="label">Messages Seen</div>'+
            '<div class="value messages"></div>'+
            '</div>'+
            '</div>'+
            '</div>'+
            '<div class="info">'+
            '<div class="element speed"></div>'+
            '<div class="element altitude"></div>'+
            '<div class="element track"></div>'+
            '<div class="element position"></div>'+
            '</div>'+
            '</div>'
        );

        $('div#stripe-'+hex+' div.details').hide();

        $('div#stripe-'+hex).click(function() {
            $('div.stripe').each(function() {
                if ($(this).attr('id') != 'stripe-'+hex) {
                    $('div.details', this).hide();
                    $('div.info', this).show();
                    $(this).removeClass(ACTIVECLASS);
                }
            });

            if ($(this).hasClass(ACTIVECLASS)) {
                $('div.details', this).hide();
                $('div.info', this).show();
                $(this).removeClass(ACTIVECLASS);
                panToLocation();
            }
            else {
                $('div.details', this).show();
                $('div.info', this).hide();
                $(this).addClass(ACTIVECLASS);
                panToLocation(plane.getGeometry().getCoordinates(), ZOOM);
            }
        });
    }

    $('div#stripe-'+hex).attr('data-sort', plane.get($('select#stripeSort').val()));

    var seen = plane.get('seen');
    var n = (seen >= MAX_SEEN) ? 0 : 120*(1-seen/MAX_SEEN);
    var seenColor = 'hsl('+n+',100%,50%)';
    $('div#stripe-'+hex).css('border-right-color', seenColor);

    var altitudeColor = getAltitudeColor(plane);
    $('div#stripe-'+hex).css('border-left-color', altitudeColor);

    var flight = plane.get('flight');
    $('div#stripe-'+hex+' div.callsign').html(flight);

    var immatriculation = plane.get('immatriculation');
    $('div#stripe-'+hex+' div.immatriculation').html(immatriculation);

    $('div#stripe-'+hex+' div.icao24').html(hex.toUpperCase());

    var speed = Math.round(plane.get('speed')*1.852);
    $('div#stripe-'+hex+' div.speed').html(pad(speed, 3)+' km/h');

    var altitude = Math.round(plane.get('altitude')*0.3048);
    var vertRate = plane.get('vert_rate');
    var vertIndicator = (vertRate > 0) ? '\u2191' : ((vertRate < 0) ? '\u2193' : '&nbsp;');
    $('div#stripe-'+hex+' div.altitude').html(pad(altitude, 5)+' m '+vertIndicator);

    $('div#stripe-'+hex+' div.track').html(pad(plane.get('track'), 3)+'&deg;');
    $('div#stripe-'+hex+' div.squawk').html(plane.get('squawk'));

    var coordinates = ol.proj.transform(plane.getGeometry().getCoordinates(), 'EPSG:3857', 'EPSG:4326');
    $('div#stripe-'+hex+' div.position')
        .html(Math.round(coordinates[0]*1000)/1000+','+Math.round(coordinates[1]*1000)/1000);

    $('div#stripe-'+hex+' div.lts').html(plane.get('seen')+'s ago');
    $('div#stripe-'+hex+' div.messages').html(plane.get('messages'));
    $('div#stripe-'+hex+' div.airline').html(plane.get('owner'));
    $('div#stripe-'+hex+' div.airplane').html(plane.get('plane'));
    $('div#stripe-'+hex+' div.airplane_short').html(plane.get('plane_short'));
    $('div#stripe-'+hex+' div.airplane_short').prop('title', plane.get('plane'));
    $('div#stripe-'+hex+' div.immatriculation').prop('title', hex.toUpperCase());
    $('div#stripe-'+hex+' div.callsign').prop('title', plane.get('owner'));
}

function pad(string, length, character='&nbsp;') {
    string += '';
    var delta = (length - string.length);

    if (delta > 0) {
        for (i = 0; i < delta; i++) {
            string = character+string;
        }
    }

    return string;
}

function panToLocation(coordinates, zoom=ZOOM) {
    if (!coordinates) {
        coordinates = ol.proj.fromLonLat(MAP_CENTER_COORDINATES);
    }

    // map.getView().setCenter(coordinates);
    // map.getView().setZoom(zoom);
}
