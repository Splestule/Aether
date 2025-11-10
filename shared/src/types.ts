// Shared types between client and server

export interface FlightData {
  icao24: string;
  callsign: string;
  origin_country: string;
  time_position: number;
  last_contact: number;
  longitude: number;
  latitude: number;
  baro_altitude: number;
  on_ground: boolean;
  velocity: number;
  true_track: number;
  vertical_rate: number;
  sensors: number[];
  geo_altitude: number;
  squawk: string;
  spi: boolean;
  position_source: number;
}

export interface OpenSkyResponse {
  time: number;
  states: [
    string,     // icao24
    string,     // callsign
    string,     // origin_country
    number,     // time_position
    number,     // last_contact
    number,     // longitude
    number,     // latitude
    number,     // geo_altitude
    boolean,    // on_ground
    number,     // velocity
    number,     // true_track
    number,     // vertical_rate
    number[],   // sensors
    number,     // baro_altitude
    string,     // squawk
    boolean,    // spi
    number      // position_source
  ][];
}

export interface ProcessedFlight {
  id: string;
  callsign: string;
  icao24: string;
  airline: string;
  position: {
    x: number; // VR space coordinates
    y: number;
    z: number;
  };
  gps: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  velocity: number; // m/s
  heading: number; // degrees
  distance: number; // km from user
  elevation: number; // degrees above horizon
  azimuth: number; // degrees from north
  onGround: boolean;
  lastUpdate: number;
  lastTrajectoryRefresh?: number;
  positionHistory?: Array<{
    timestamp: number;
    position: {
      x: number;
      y: number;
      z: number;
    };
    gps: {
      latitude: number;
      longitude: number;
      altitude: number;
    };
  }>; // Historical positions for trajectory visualization
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  altitude: number; // meters above sea level
  name?: string;
}

export interface FlightTrajectory {
  flightId: string;
  positions: Array<{
    timestamp: number;
    latitude: number;
    longitude: number;
    altitude: number;
  }>;
}

export interface VRConfig {
  maxDistance: number; // km
  updateInterval: number; // ms
  maxFlights: number;
  enableTrajectories: boolean;
}

export interface FlightInfo {
  callsign: string;
  icao24: string;
  airline: string;
  aircraftType: string;
  origin: string;
  destination: string;
  altitude: number;
  speed: number;
  heading: number;
  distance: number;
  eta?: string;
}

export interface FlightRouteEndpointInfo {
  airport?: string;
  iata?: string;
  icao?: string;
  gate?: string;
  terminal?: string;
  baggage?: string;
  scheduled?: string;
  estimated?: string;
  actual?: string;
  delayMinutes?: number;
}

export interface FlightRouteInfo {
  callsign: string;
  flightNumber?: string;
  airline?: string;
  status?: string;
  origin: FlightRouteEndpointInfo | null;
  destination: FlightRouteEndpointInfo | null;
  updatedAt: number;
}

export interface ElevationResponse {
  latitude: number;
  longitude: number;
  elevation: number;
}

// WebSocket message types
export interface WSMessage {
  type: 'flight_update' | 'flight_add' | 'flight_remove' | 'error' | 'connection' | 'subscription' | 'ping' | 'pong' | 'request_flights' | 'subscribe_flights' | 'unsubscribe_flights';
  data: any;
  timestamp: number;
}

export interface FlightUpdateMessage extends WSMessage {
  type: 'flight_update';
  data: ProcessedFlight[];
}

export interface FlightAddMessage extends WSMessage {
  type: 'flight_add';
  data: ProcessedFlight;
}

export interface FlightRemoveMessage extends WSMessage {
  type: 'flight_remove';
  data: { id: string };
}

export interface ConnectionMessage extends WSMessage {
  type: 'connection';
  data: { clientId: string; message: string };
}

export interface SubscriptionMessage extends WSMessage {
  type: 'subscription';
  data: { subscribed?: string[]; unsubscribed?: string[] };
}

export interface PingMessage extends WSMessage {
  type: 'ping';
  data: { timestamp: number };
}

export interface PongMessage extends WSMessage {
  type: 'pong';
  data: { timestamp: number };
}
