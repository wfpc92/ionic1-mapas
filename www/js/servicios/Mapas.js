var MapasFactory = function($q, $cordovaGeolocation, CargarScriptsFactory, $ionicPopup, $log) {
	var deferred = null,
		mapa = null,
		elemMapa = null,
		puntos = null,
		stations = null,
		directionsService = null,
		directionsDisplays = null;

	var initMap = function() {

		if(!google) {
			deferred.reject("no existe referencia a google.maps");
			return;
		}

		var mapOptions = {
			zoom: 11,
			mapTypeId: google.maps.MapTypeId.ROADMAP,
			disableDefaultUI: true, //quitar controles por defecto: "tipo", "zoom", "hombrecillo"
			//scaleControl: true, // mostrar escala
			//mapTypeControl: false, //deshabilitar "tipo mapa"
			zoomControl: true
		};

		elemMapa = document.createElement("div");
		elemMapa.id = "id-mapa";
		elemMapa.setAttribute("data-tap-disabled","true");
		//crear mapa en <div id="{{idMapa}}">
		mapa = new google.maps.Map(elemMapa, mapOptions);

		directionsService = new google.maps.DirectionsService;
        directionsDisplays = [];
	};

	var crearPunto = function(info, punto, color) {
		var pinImage = new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|" + color,
		    new google.maps.Size(21, 34),
		    new google.maps.Point(0,0),
		    new google.maps.Point(10, 34)),

			punto = new google.maps.Marker({
				position: new google.maps.LatLng(punto.lat, punto.lng),
				map: mapa,
				draggable: false,
				icon: pinImage,
				title: info.name
			}),

			contentString = '<div class="popup">'+
				"<h5>"+info.name+" #"+info.order+"</h5>"+
				'<p>'+info.address+'</p>'+
				'<p><b>Descripción:</b> '+info.description+'</p>'+
				'<p><b>Tipo:</b> '+info.type+'</p>'+
				'<p><b>Capacidad:</b> '+info.capacity+'</p>'+
				'<p><b>Bicicletas:</b> '+info.bikes+', Estado: '+info.bikes_state+'</p>'+
				'<p><b>Lugares Disponibles:</b> '+info.places+', Estado: '+info.places_state+'</p>'+
				'<p><b>Cerrado:</b> '+info.closed+', CDO?: '+info.cdo+'</p>'+
				//'<img src="'+info.picture+'" alt="image de estacion"/>'+
				'</div>',

			infoWindow = new google.maps.InfoWindow({
				content: contentString,
				//disableAutoPan: true
			}); 

		punto.addListener('click', function() {
			infoWindow.open(mapa, punto);
		});
	};

	function mostrarRuta(i, station) {
		if (typeof station.ruta !== 'undefined') {
			directionsDisplays[i] = new google.maps.DirectionsRenderer({
				polylineOptions: {
					//strokeOpacity: 0,
					strokeColor: "#"+station.color,
					strokeWeight: 4,
				},
				suppressMarkers: true,
			});
			directionsDisplays[i].setMap(mapa);
			directionsDisplays[i].setDirections(station.ruta);
		}
	};

	function ocultarRuta(i,station) {
		if (typeof station.ruta !== 'undefined') {
			directionsDisplays[i].setMap(null);
		}
	} 

	function calcularRuta(info, puntos) {
        var waypts = [];
        var checkboxArray = document.getElementById('waypoints');
        for (var i = 1; i < puntos.length - 1; i++) {
            waypts.push({
              location: new google.maps.LatLng(puntos[i].lat, puntos[i].lng),
              stopover: true
            });
        }

        directionsService.route({
          origin: new google.maps.LatLng(puntos[0].lat, puntos[0].lng),
          destination: new google.maps.LatLng(puntos[puntos.length - 1].lat, puntos[puntos.length - 1].lng),
          waypoints: waypts,
          optimizeWaypoints: true,
          travelMode: 'DRIVING'//DRIVING, WALKING, BICYCLING, TRANSIT
        }, function(response, status) {
        	if (status === 'OK') {
          		info.ruta = response;
          	}
        });
    }

	var crearLinea = function(info, puntos, color) {
		info.polilyne = new google.maps.Polyline({
			path: puntos,
			geodesic: true,
			strokeOpacity: 0,
			strokeColor: "#"+color,
			strokeWeight: 4,
			map: mapa
		});

		if(puntos.length >= 2) {
			calcularRuta(info, puntos);
		}
	};

	var resultado = function() {
		deferred.resolve({
			map: mapa,
			mapaDOM: elemMapa,

			procesarPuntos: function(data) {
				stations = data.stations;

				for (var i = 0; i < stations.length; i++) {
					var station = stations[i];
					//console.log(station.name)
					puntos = [], station.color = getRandomColor();

					for (var j = 0; j < station.items.length; j++) {
						var punto = {lat: Number(station.items[j].lat), lng: Number(station.items[j].lon)};
						//console.log(punto)
						puntos.push(punto);
						crearPunto(station.items[j], punto, station.color);
					}
					
					crearLinea(station, puntos, station.color);
				}

				mapa.setCenter(new google.maps.LatLng(puntos[0].lat, puntos[0].lng));
				return this;
			},

			fachadaLineas: function() {
				for (var i = 0; i < stations.length; i++) {
					var station = stations[i];
					station.polilyne.setOptions({strokeOpacity:1});
					ocultarRuta(i, station);

					for (var j = 0; j < station.items.length; j++) {
						var punto = {lat: Number(station.items[j].lat), lng: Number(station.items[j].lon)};
					}
				}

				return this;
			},

			fachadaRutaCicla: function() {
				for (var i = 0; i < stations.length; i++) {
					var station = stations[i];
					station.polilyne.setOptions({strokeOpacity:0});
					mostrarRuta(i, station);
				}
				return this;
			}
			
		});
	};

	function getRandomColor() {
		var letters = '0123456789ABCDEF'.split('');
		var color = '';
		for (var i = 0; i < 6; i++ ) {
			color += letters[Math.floor(Math.random() * 16)];
		}
		return color;
	};

	return {
		getMapa: function() {
			deferred = $q.defer();
			if(!mapa) {
				$log.debug("mapa google no ha sido creado, construyendo dom...")
				CargarScriptsFactory.cargarGoogleMaps(function() {
					$log.debug("creando mapa de google...")
					initMap();
					resultado();			
				}, function() {
					$log.debug("no se ha podido cargar el script de google maps")
				});
			}
			else {
				$log.debug("mapa google ya ha sido previamente construido.")
				resultado();
			}
			return deferred.promise;
		}
	}
};

app.factory("MapasFactory", MapasFactory);
