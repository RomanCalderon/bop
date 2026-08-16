/// <reference types="google.maps" />

export const bopMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#efe6d6" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5c5346" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f0e8" }] },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#efe6d6" }, { saturation: -35 }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#d7c4a3" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#e4d8c4" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d2c4ae" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dcc9a8" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
