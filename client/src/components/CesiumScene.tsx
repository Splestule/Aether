import { useRef, useEffect, useState } from 'react';
// import { Viewer, Entity, PolylineGraphics } from "resium";
import {
  Cartesian3,
  Color,
  Viewer as CesiumViewer,
  Math as CesiumMath,
  Cesium3DTileset,
  CameraEventType,
  createWorldTerrainAsync,
  sampleTerrainMostDetailed,
  Cartographic,
  Matrix4,
  Ion,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  IonImageryProvider,
  CatmullRomSpline,
  ConstantProperty,
  CustomShader,
  CallbackProperty,
  ColorMaterialProperty,
  EasingFunction,
  Transforms,
  JulianDate,
  HeadingPitchRoll,
} from 'cesium';

import { ProcessedFlight, UserLocation } from '@shared/src/types';
import { formatAltitude, formatSpeed } from '@shared/src/utils';
import { config } from '../config';

// Set Cesium Ion token if available
if (import.meta.env.VITE_CESIUM_ION_TOKEN) {
  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
}

interface CesiumSceneProps {
  userLocation: UserLocation;
  flights: ProcessedFlight[];
  selectedFlight: ProcessedFlight | null;
  onFlightSelect: (flight: ProcessedFlight | null) => void;
  followingFlight: ProcessedFlight | null;
  cameraRef?: React.MutableRefObject<{ heading: number; pitch: number } | null>;
}

export function CesiumScene({
  userLocation,
  flights,
  selectedFlight,
  onFlightSelect,
  followingFlight,
  cameraRef,
}: CesiumSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const isCameraInitialized = useRef(false);
  const [trajectory, setTrajectory] = useState<any[]>([]);
  const flightsRef = useRef<ProcessedFlight[]>(flights); // Ref to access latest flights in loop
  const isLandingViewTriggered = useRef(false);

  // Update flights ref
  useEffect(() => {
    flightsRef.current = flights;
  }, [flights]);

  // 2.5 LANDING VIEW AUTOMATION
  useEffect(() => {
    if (!viewerRef.current || !followingFlight) return;
    const viewer = viewerRef.current;

    // Check Live Status
    const liveFlight = flightsRef.current.find((f) => f.id === followingFlight.id);
    const currentFlightData = liveFlight || followingFlight;

    if (currentFlightData.onGround) {
      // Only trigger if we aren't already viewing the landing
      if (!isLandingViewTriggered.current) {
        console.log('[CesiumScene] Flight Landed! Switching to Top-Down View.');
        isLandingViewTriggered.current = true;

        // 1. Stop Tracking (Break Anchor)
        viewer.trackedEntity = undefined;

        // 2. Fly to Top-Down View
        const entity = viewer.entities.getById(currentFlightData.id);
        // Or Ghost?
        const ghost = viewer.entities.getById(currentFlightData.id + '-ghost');
        const targetPos =
          ghost?.position?.getValue(viewer.clock.currentTime) ||
          entity?.position?.getValue(viewer.clock.currentTime);

        if (targetPos) {
          const transform = Transforms.eastNorthUpToFixedFrame(targetPos);
          const localOffset = new Cartesian3(0, 0, 75000); // 75km up
          const dest = Matrix4.multiplyByPoint(transform, localOffset, new Cartesian3());

          viewer.camera.flyTo({
            destination: dest,
            orientation: {
              heading: 0, // North Up
              pitch: CesiumMath.toRadians(-90), // Straight Down
              roll: 0,
            },
            duration: 3.0,
            easingFunction: EasingFunction.CUBIC_IN_OUT,
          });
        }
      }
    } else {
      // Reset trigger if active again
      isLandingViewTriggered.current = false;
    }
  }, [followingFlight, flights]); // Check on flight updates

  // 3. FOLLOW FLIGHT LOGIC (Freelook Enabled)
  useEffect(() => {
    if (!viewerRef.current) return;

    const interval = setInterval(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      const now = Date.now();

      flightsRef.current.forEach((flight) => {
        const entity = viewer.entities.getById(flight.id);
        if (!entity) return;

        // Calculate time since last update
        // flight.lastUpdate is in ms (from server/OpenSky)
        const lastUpdate = flight.lastUpdate || now;
        const elapsedSeconds = (now - lastUpdate) / 1000;

        if (elapsedSeconds <= 0) return;

        // Calculate distance traveled
        // velocity is m/s
        const distanceMeters = (flight.velocity || 0) * elapsedSeconds;

        if (distanceMeters <= 0) return;

        // Calculate new position using ENU offset
        const position = Cartesian3.fromDegrees(
          flight.gps.longitude,
          flight.gps.latitude,
          flight.gps.altitude
        );
        const transform = Transforms.eastNorthUpToFixedFrame(position);

        // Heading: 0=North (Y+), 90=East (X+)
        const headingRad = CesiumMath.toRadians(flight.heading);
        const offsetX = Math.sin(headingRad) * distanceMeters;
        const offsetY = Math.cos(headingRad) * distanceMeters;

        const offset = new Cartesian3(offsetX, offsetY, 0);
        let newPos = Matrix4.multiplyByPoint(transform, offset, new Cartesian3());

        // FIX ALTITUDE DRIFT:
        // The ENU transform is a tangent plane. Moving along it increases altitude relative to the curved earth.
        // We must snap the new position back to the correct altitude.
        const cartographic = Cartographic.fromCartesian(newPos);
        cartographic.height = flight.gps.altitude; // Keep altitude constant
        newPos = Cartesian3.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          cartographic.height
        );

        // Update Entity Directly (Teleport)
        entity.position = newPos as any;

        // UPDATE ORIENTATION (Required for viewFrom to work as "Behind")
        const hpr = new HeadingPitchRoll(headingRad - CesiumMath.PI_OVER_TWO, 0, 0);
        // Note: Cesium Heading 0=East? No, 0=North usually.
        // But ENU frame: X=East, Y=North.
        // Transforms.headingPitchRollQuaternion uses Local Frame.
        // Usually Heading 0 = X axis (East).
        // Our data: 0=North. So offset by -90 degrees (-PI/2).

        const orientation = Transforms.headingPitchRollQuaternion(newPos, hpr);
        entity.orientation = orientation as any;

        // Set ViewFrom (Follow Camera Offset)
        // Only if it's the following flight? No, set it always or only when selected?
        // Setting it here overrides user orbit if they are tracking?
        // NO. viewFrom is only used when trackedEntity is FIRST set.
        // However, if we update it constantly, it might be ignored or jitter.
        // Better to set it ONCE in the useEffect logic, but we need the Entity to have Orientation for "Behind" to mean "Tail".

        // We set 'viewFrom' on the entity definition or lazily.
        if (!entity.viewFrom) {
          entity.viewFrom = new ConstantProperty(new Cartesian3(0, -2500, 1200)); // Back 2.5km, Up 1.2km (Higher Elevation)
        }

        // Update Ghost
        const ghost = viewer.entities.getById(flight.id + '-ghost');
        if (ghost) {
          ghost.position = newPos as any;
          ghost.orientation = orientation as any; // Sync Orientation

          if (!ghost.viewFrom) {
            ghost.viewFrom = new ConstantProperty(new Cartesian3(0, -2500, 1200)); // Back 2.5km, Up 1.2km
          }
        }
      });
    }, 2000); // 2 seconds

    return () => clearInterval(interval);
  }, []);

  const prevSelectedFlightId = useRef<string | null>(null);

  // Fetch trajectory when flight is selected
  useEffect(() => {
    if (!selectedFlight) {
      // If deselected, clear everything
      setTrajectory([]);
      prevSelectedFlightId.current = null;
      if (viewerRef.current) {
        const entitiesToRemove: any[] = [];
        viewerRef.current.entities.values.forEach((e) => {
          if (e.id && typeof e.id === 'string' && e.id.startsWith('traj-')) {
            entitiesToRemove.push(e);
          }
        });
        entitiesToRemove.forEach((e) => viewerRef.current?.entities.remove(e));
      }
      return;
    }

    // Check if we switched planes
    const hasSwitchedPlanes = selectedFlight.id !== prevSelectedFlightId.current;
    prevSelectedFlightId.current = selectedFlight.id;

    if (hasSwitchedPlanes) {
      // Clear previous trajectory immediately to prevent "transfer" glitch
      setTrajectory([]);

      // INSTANT CLEANUP: Remove existing trajectory entities from the scene
      // This ensures the old path disappears *instantly* when switching planes.
      if (viewerRef.current) {
        const entitiesToRemove: any[] = [];
        viewerRef.current.entities.values.forEach((e) => {
          if (e.id && typeof e.id === 'string' && e.id.startsWith('traj-')) {
            entitiesToRemove.push(e);
          }
        });
        entitiesToRemove.forEach((e) => viewerRef.current?.entities.remove(e));
      }
    }

    const fetchTrajectory = async () => {
      try {
        // console.log(`[CesiumScene] Fetching trajectory for ${selectedFlight.icao24}...`);
        const url = `${config.apiUrl}/api/flights/${selectedFlight.icao24}/trajectory?lat=${userLocation.latitude}&lon=${userLocation.longitude}&alt=${userLocation.altitude}`;

        const response = await fetch(url);
        // console.log(`[CesiumScene] Response status: ${response.status}`);

        const data = await response.json();
        if (data.success) {
          // console.log(`[CesiumScene] Loaded ${data.data.length} points.`);
          setTrajectory(data.data);
        } else {
          console.warn('[CesiumScene] API returned success: false', data);
        }
      } catch (error) {
        console.error('[CesiumScene] Failed to fetch trajectory:', error);
      }
    };

    fetchTrajectory();
  }, [selectedFlight, userLocation]);

  // 1. INITIALIZATION: Load Terrain
  useEffect(() => {
    const initTerrain = async () => {
      try {
        const terrain = await createWorldTerrainAsync({
          requestVertexNormals: true, // Better lighting
          requestWaterMask: true,
        });
        // setTerrainProvider(terrain); // State removed to fix unused var error

        // FORCE UPDATE: Manually assign to viewer to ensure it applies immediately
        if (viewerRef.current) {
          viewerRef.current.terrainProvider = terrain;
          console.log('World Terrain manually assigned to viewer.');

          // Store for sampling
          (viewerRef.current as any)._samplingTerrain = terrain;
        }

        console.log('World Terrain loaded & set to state.');
      } catch (error) {
        console.error('Failed to load World Terrain:', error);
      }
    };

    initTerrain();
  }, []); // Run once on mount

  // 2. CAMERA UPDATE: Handle User Location Changes (Run when userLocation changes)
  useEffect(() => {
    const updateCameraPosition = async () => {
      if (!viewerRef.current) return;

      console.log('Updating Camera for Location:', userLocation);

      // Sample terrain height
      try {
        // Access the terrain we stored for sampling
        const terrain = (viewerRef.current as any)._samplingTerrain;

        if (!terrain) {
          console.warn('Terrain for sampling not ready yet.');
          return;
        }

        // Sample terrain height
        const position = Cartographic.fromDegrees(userLocation.longitude, userLocation.latitude);
        let terrainHeight = 0;

        try {
          const updatedPositions = await sampleTerrainMostDetailed(terrain, [position]);
          terrainHeight = updatedPositions[0].height;
        } catch (e) {
          console.warn('Terrain sampling failed, using default altitude.', e);
        }

        // Calculate final altitude: Terrain Height + 100m
        const finalAltitude = (terrainHeight || userLocation.altitude || 0) + 100;

        console.log(`Camera Altitude: Terrain=${terrainHeight}m -> Final=${finalAltitude}m`);

        const destination = Cartesian3.fromDegrees(
          userLocation.longitude,
          userLocation.latitude,
          finalAltitude
        );

        if (!isCameraInitialized.current) {
          // First time: Set Position + Orientation
          viewerRef.current.camera.setView({
            destination: destination,
            orientation: {
              heading: CesiumMath.toRadians(0), // North
              pitch: CesiumMath.toRadians(-10), // Look more level
              roll: 0,
            },
          });
          isCameraInitialized.current = true;
        }
        // ELSE: DO NOTHING.
        // We intentionally do not update the camera on subsequent location updates
        // to prevent "snapping" the view back to default orientation.
        // The user is in full control.
      } catch (error) {
        console.error('Failed to update camera position:', error);
      }
    };

    updateCameraPosition();
  }, []); // RUN ONCE: Never re-run to prevent camera snapping/resetting

  // 3. FOLLOW FLIGHT LOGIC (Freelook Enabled)
  useEffect(() => {
    if (!viewerRef.current) return;

    const viewer = viewerRef.current;
    const scene = viewer.scene;
    const controller = scene.screenSpaceCameraController;

    if (followingFlight) {
      console.log(`[CesiumScene] Tracking Flight: ${followingFlight.id}`);

      // 1. Configure Inputs for "Pivot" Mode (Strict Orbit)
      controller.enableInputs = true;

      // ENABLE ORBIT
      controller.enableRotate = true; // Left Click Drag (Orbit around center)
      controller.enableTilt = true; // Middle/Right Click Drag (Orbit Vertical)

      // DISABLE EVERYTHING ELSE
      controller.enableZoom = false; // Disable Zoom (User Request: Fixed Distance)
      controller.enableTranslate = false; // Disable Pan (Keep Anchor Centered)
      controller.enableLook = false; // Disable Look (Prevents turning head away from anchor)

      // 2. Set Tracked Entity (Native Cesium Follow)
      // TRACK THE GHOST (Point Only) to ensure Camera centers on the Plane, not the Line midpoint.
      const ghost = viewer.entities.getById(followingFlight.id + '-ghost');
      if (ghost) {
        viewer.trackedEntity = ghost;
      } else {
        console.warn('Ghost entity not found, tracking main entity.');
        const entity = viewer.entities.getById(followingFlight.id);
        if (entity) viewer.trackedEntity = entity;
      }

      // NOTE: We do NOT set Viewer.camera.setView() manually anymore.
      // This allows the user to rotate/zoom (Freelook) while the camera stays attached to the plane.
    } else {
      console.log('[CesiumScene] Stopping Track. returning to User.');

      // 1. Stop Tracking
      viewer.trackedEntity = undefined;

      // 2. Disable Inputs (Restore "Street View" / Look Only Mode)
      controller.enableRotate = false;
      controller.enableTilt = false;
      controller.enableTranslate = false;
      controller.enableZoom = false;

      // Restore "Look" for Map Mode
      controller.enableLook = true;

      // 3. Fly Back to User
      const destination = Cartesian3.fromDegrees(
        userLocation.longitude,
        userLocation.latitude,
        (userLocation.altitude || 0) + 150
      );

      viewer.camera.flyTo({
        destination: destination,
        orientation: {
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-10),
          roll: 0,
        },
        duration: 1.5,
      });
    }

    // Cleanup?
    // Nothing drastic needed as re-running the effect handles the switch.
  }, [followingFlight, userLocation]);

  // Handle flight selection
  const handleSelect = (flight: ProcessedFlight) => {
    onFlightSelect(flight);
  };

  // -------------------------------------------------------------------------
  // 1. INITIALIZATION (Runs EXACTLY ONCE)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    console.log('Initializing Cesium Viewer...');

    // A. Create Viewer with Reliable Imagery (Bing Maps Road)
    // Asset 4 = Bing Maps Road. Asset 2 = Bing Maps Aerial with Labels.
    const viewer = new CesiumViewer(containerRef.current, {
      terrainProvider: undefined, // Start flat, terrain loaded async
      // imageryProvider will be set async below to ensure correct loading
      imageryProvider: false,
      scene3DOnly: true,
      selectionIndicator: false,
      baseLayerPicker: false,
      timeline: false,
      animation: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      vrButton: false,
      infoBox: false,
      creditContainer: document.createElement('div'),
      contextOptions: {
        webgl: {
          alpha: true, // Enable transparency for CSS background
        },
      },
    } as any);

    // Load Imagery Async with Styling
    IonImageryProvider.fromAssetId(4)
      .then((provider) => {
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        // Style: Dark Gray Filter
        layer.saturation = 0.1; // Almost grayscale
        layer.contrast = 1.2; // Higher contrast for dark mode
        layer.brightness = 0.6; // Dark Gray
        layer.gamma = 1.0;
      })
      .catch((error) => {
        console.error('Failed to load Bing Maps Road:', error);
      });

    viewerRef.current = viewer;

    // B. Global Settings
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.highDynamicRange = false; // Fix "white" color washout

    // SKY & ATMOSPHERE STYLING (Gradient Sky)
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;
    viewer.scene.backgroundColor = Color.TRANSPARENT; // Let CSS gradient show through
    viewer.scene.globe.baseColor = Color.BLACK; // Solid core

    viewer.scene.fog.enabled = false; // Disable fog (clean view)
    viewer.shadows = false;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = false;

    viewer.scene.requestRenderMode = false;
    viewer.targetFrameRate = 60;
    viewer.resolutionScale = 1.0;

    // FORCE CLOCK TO ANIMATE
    // If this is false, time doesn't advance, dt = 0, and smoothing freezes.
    viewer.clock.shouldAnimate = true;
    viewer.clock.startTime = JulianDate.now();
    viewer.clock.currentTime = JulianDate.now();
    viewer.clock.clockRange = 1; // LOOP_STOP (but we want continuous real time?)
    // Actually, for real-time, we just want it to tick.
    viewer.clock.multiplier = 1.0; // Real time speed

    // HORIZON LOCK & COMPASS UPDATE
    viewer.scene.postRender.addEventListener(() => {
      const camera = viewer.camera;

      // 1. Horizon Lock: Force roll to 0 (Fixes "Tilt")
      if (Math.abs(camera.roll) > 1e-4) {
        camera.setView({
          orientation: {
            heading: camera.heading,
            pitch: camera.pitch,
            roll: 0,
          },
        });
      }

      // 2. Compass Update
      const compassEl = document.getElementById('compass-display');
      if (compassEl) {
        const headingDegrees = CesiumMath.toDegrees(camera.heading);
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        // Cesium heading: 0=North, 90=East.
        // Index = round(degrees / 45) % 8
        const index = Math.round(headingDegrees / 45) % 8;
        compassEl.textContent = directions[index];
      }
    });

    // C. Camera & Controls Setup
    const scene = viewer.scene;
    const canvas = scene.canvas;
    const controller = scene.screenSpaceCameraController;

    canvas.setAttribute('tabindex', '0');
    canvas.onclick = () => canvas.focus();

    controller.inertiaSpin = 0;
    controller.inertiaTranslate = 0;
    controller.inertiaZoom = 0;
    controller.enableCollisionDetection = false;

    // Disable Movement (Street View Mode)
    controller.enableRotate = false;
    controller.enableTilt = false;
    controller.enableTranslate = false;
    controller.enableZoom = false;

    // Enable Look
    controller.enableInputs = true;
    controller.enableLook = true;
    controller.lookEventTypes = CameraEventType.LEFT_DRAG;

    // Disable Double Click (Teleport)
    try {
      (viewer as any).cesiumWidget.screenSpaceEventHandler.removeInputAction(
        ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      );
    } catch (e) {
      console.warn('Failed to disable double-click zoom:', e);
    }

    // FIX SNAPPING
    viewer.trackedEntity = undefined;
    viewer.camera.lookAtTransform(Matrix4.IDENTITY);

    // D. Load Google 3D Tiles
    const loadTiles = async () => {
      try {
        console.log('Loading Google 3D Tiles (Asset 96188)...');
        const tileset = await Cesium3DTileset.fromIonAssetId(96188);

        // 1. High Detail Nearby (0-2km)
        tileset.maximumScreenSpaceError = 2; // Very high detail
        (tileset as any).maximumMemoryUsage = 2048;

        // 2. Dynamic Detail Reduction (2km - 6km)
        // We simulate fog density to drop detail, even though visual fog is off.
        tileset.dynamicScreenSpaceError = true;
        tileset.dynamicScreenSpaceErrorDensity = 0.002; // Lower density = Slower drop-off (extends high detail further)
        tileset.dynamicScreenSpaceErrorFactor = 4.0; // Moderate reduction
        tileset.preloadWhenHidden = true;

        // 3. Custom Shader: 6km Cutoff + Gradient Styling
        tileset.customShader = new CustomShader({
          fragmentShaderText: `
                        void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
                            // 1. Distance Cutoff (> 6km)
                            float dist = distance(fsInput.attributes.positionWC, czm_viewerPositionWC);
                            if (dist > 6000.0) {
                                discard;
                            }

                            // 2. Styling: Pale Gradient (Gray -> Purple)
                            
                            // Colors
                            vec3 paleGray = vec3(0.90, 0.90, 0.92); // Base Light
                            vec3 logoPurple = vec3(0.776, 0.627, 0.910); // #c6a0e8
                            vec3 mildPurple = vec3(0.85, 0.80, 0.95); // Lighter Purple

                            // Calculate Height Gradient (Approximate)
                            // We use positionWC.z. Adjust divisor for scale.
                            // Assuming buildings are roughly 0-100m tall relative to camera/ground.
                            // This is a bit hacky without relative height, but creates variation.
                            float heightFactor = clamp((fsInput.attributes.positionWC.z - czm_viewerPositionWC.z + 100.0) / 200.0, 0.0, 1.0);
                            
                            // Create Gradient Palette
                            vec3 gradientColor = mix(paleGray, mildPurple, heightFactor);

                            // Convert original texture to grayscale to preserve details but remove original colors
                            float gray = dot(material.diffuse, vec3(0.299, 0.587, 0.114));
                            
                            // Mix: 
                            // - 60% Light Base (Make it bright/pale)
                            // - 40% Gradient Color (Apply the purple theme)
                            vec3 base = vec3(gray);
                            vec3 finalColor = mix(base, gradientColor, 0.5);
                            
                            // Brighten slightly
                            material.diffuse = finalColor + 0.1;
                        }
                    `,
        });

        viewer.scene.primitives.add(tileset);
        console.log('Google Photorealistic 3D Tiles added.');
      } catch (error) {
        console.error('Failed to load Google 3D Tiles:', error);
      }
    };
    loadTiles();

    // E. Fog Disabled (User Request)
    viewer.scene.fog.enabled = false;

    // E. Initial Camera Position
    setTimeout(() => {
      if (viewer.isDestroyed()) return;
      console.log('Executing Initial Camera SetView');

      const initialOrientation = cameraRef?.current
        ? {
            heading: cameraRef.current.heading,
            pitch: cameraRef.current.pitch,
            roll: 0,
          }
        : {
            heading: CesiumMath.toRadians(0),
            pitch: CesiumMath.toRadians(-10), // Look more level
            roll: 0,
          };

      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(
          userLocation.longitude,
          userLocation.latitude,
          (userLocation.altitude || 0) + 100 // Lower altitude (Closer to ground)
        ),
        orientation: initialOrientation,
      });
      isCameraInitialized.current = true;
    }, 100);

    // Cleanup
    return () => {
      console.log('CesiumScene Unmounting...');
      if (viewerRef.current) {
        // Save camera orientation
        if (cameraRef) {
          cameraRef.current = {
            heading: viewerRef.current.camera.heading,
            pitch: viewerRef.current.camera.pitch,
          };
          console.log('Saved Cesium Camera:', cameraRef.current);
        }

        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []); // Empty dependency array = Runs ONCE

  // -------------------------------------------------------------------------
  // 3. RENDER ENTITIES (Flights)
  // -------------------------------------------------------------------------    // Filter flights if following
  // Ensure we use the LIVE flight data from the flights array, otherwise the entity won't update
  const visibleFlights = followingFlight
    ? flights.find((f) => f.id === followingFlight.id)
      ? [flights.find((f) => f.id === followingFlight.id)!]
      : [followingFlight]
    : flights;

  // 4. RENDER LOOP (Create/Update/Remove Entities)
  useEffect(() => {
    if (!viewerRef.current) return;

    const viewer = viewerRef.current;

    // Map of current flight IDs for cleanup
    const activeFlightIds = new Set(visibleFlights.map((f) => f.id));

    // 1. Update or Add Flights
    visibleFlights.forEach((flight) => {
      const isSelected = selectedFlight?.id === flight.id;
      const ghostId = `${flight.id}-ghost`;

      let entity = viewer.entities.getById(flight.id);
      let ghostEntity = viewer.entities.getById(ghostId);

      const position = Cartesian3.fromDegrees(
        flight.gps.longitude,
        flight.gps.latitude,
        flight.gps.altitude
      );

      // Colors
      const mainColor = isSelected ? Color.fromCssColorString('#c6a0e8') : Color.WHITE;
      const ghostColor = mainColor.withAlpha(0.5);

      // VR SCALING LOGIC
      // We use a CallbackProperty to calculate the pixel size dynamically based on distance and altitude.
      // This matches the 3D sphere size from VRScene.
      const getPixelSize = (time: any) => {
        const currentPos = entity?.position?.getValue(time) || position;
        const cameraPos = viewer.camera.position;
        const distanceMeters = Cartesian3.distance(currentPos, cameraPos);
        const distanceKm = distanceMeters / 1000;

        // VR Formula (Scaled up for 2D Screen):
        // Base Size: 480m (80% of 600) normally
        // Follow Mode: 300m (User Request: 3x Bigger)
        const baseSize = followingFlight ? 300 : 480;

        // Distance Multiplier: Slightly larger for very far planes (>50km)
        const distanceMultiplier = distanceKm > 50 ? Math.min(1.5, 1 + (distanceKm - 50) / 100) : 1;

        // Altitude Multiplier: Larger for high planes
        const altitudeMultiplier = Math.max(
          1,
          Math.min(2, Math.sqrt(Math.abs(flight.gps.altitude) / 5000))
        );

        // Final 3D Size in Meters
        const sphereSizeMeters = baseSize * distanceMultiplier * altitudeMultiplier;

        // Project to Pixels
        // PixelSize = (TargetSize / Distance) * (ScreenHeight / (2 * tan(FOV / 2)))
        const frustum = viewer.camera.frustum as any; // PerspectiveFrustum
        const fov = frustum.fov || CesiumMath.toRadians(60); // Default 60 deg
        const screenHeight = viewer.scene.drawingBufferHeight;

        const pixelSize =
          (sphereSizeMeters / distanceMeters) * (screenHeight / (2 * Math.tan(fov / 2)));

        // Follow Mode Override: Fixed Large Size (Anchor)
        if (followingFlight && flight.id === followingFlight.id) {
          if (flight.onGround) return 37; // Half size for Landing View (High Altitude)
          return 75; // Use a fixed big size for the anchor
        }

        // Clamp to reasonable limits (e.g. min 15px so it's always visible, max 500px)
        return Math.max(15, Math.min(500, pixelSize));
      };

      const pixelSizeProperty = new CallbackProperty(getPixelSize, false);

      // --- MAIN ENTITY ---
      if (entity) {
        // UPDATE existing entity
        // Reset position to exact GPS from server (correction)
        entity.position = position as any;

        if (entity.point) {
          entity.point.color = new ConstantProperty(mainColor);
          entity.point.pixelSize = pixelSizeProperty;
          // Remove scaleByDistance if it exists from previous version
          entity.point.scaleByDistance = undefined;
        }

        // Polyline positions are handled by CallbackProperty set on creation

        entity.description = new ConstantProperty(`
Callsign: ${flight.callsign}
Altitude: ${formatAltitude(flight.gps.altitude)}
Speed: ${formatSpeed(flight.velocity)}
Heading: ${flight.heading}°
`) as any;
      } else {
        // ADD new entity
        const newEntity = viewer.entities.add({
          id: flight.id,
          position: position,
          // Point (Flat, No Shading)
          point: {
            pixelSize: pixelSizeProperty,
            color: mainColor,
            outlineColor: Color.BLACK.withAlpha(0.2),
            outlineWidth: 1,
            // scaleByDistance REMOVED - we handle scaling manually
            // Normal depth test (occluded by terrain)
            disableDepthTestDistance: 0,
          },
          // Vertical Line to Ground
          polyline: {
            width: 2,
            material: new Color(1.0, 1.0, 1.0, 0.3), // Faint white
          },
          description: `
Callsign: ${flight.callsign}
Altitude: ${formatAltitude(flight.gps.altitude)}
Speed: ${formatSpeed(flight.velocity)}
Heading: ${flight.heading}°
`,
        });

        // Use CallbackProperty to lock line to point
        newEntity.polyline!.positions = new CallbackProperty((time: any) => {
          const currentPos = newEntity.position?.getValue(time);
          if (!currentPos) return [];

          // Calculate ground position (same lat/lon, height 0)
          const cart = Cartographic.fromCartesian(currentPos);
          const groundPos = Cartesian3.fromRadians(cart.longitude, cart.latitude, 0);

          return [currentPos, groundPos];
        }, false);
      }

      // --- GHOST ENTITY (Always Visible, 50% Opacity) ---
      if (ghostEntity) {
        ghostEntity.position = position as any;
        if (ghostEntity.point) {
          ghostEntity.point.color = new ConstantProperty(ghostColor);
          ghostEntity.point.pixelSize = pixelSizeProperty;
          ghostEntity.point.scaleByDistance = undefined;
        }
      } else {
        viewer.entities.add({
          id: ghostId,
          position: position,
          point: {
            pixelSize: pixelSizeProperty,
            color: ghostColor,
            outlineColor: Color.BLACK.withAlpha(0.1),
            outlineWidth: 1,
            // scaleByDistance REMOVED
            // Always visible (ignores depth)
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          // No polyline for ghost
        });
      }
    });

    // 2. Remove Stale Flights
    const entitiesToRemove: any[] = [];
    viewer.entities.values.forEach((entity) => {
      const id = entity.id;
      if (typeof id !== 'string') return;

      // Trajectory
      if (id.startsWith('traj-')) return;

      // Ghost Entity
      if (id.endsWith('-ghost')) {
        const baseId = id.replace('-ghost', '');
        if (activeFlightIds.has(baseId)) return; // Keep if base is active
        entitiesToRemove.push(entity);
        return;
      }

      // Main Entity
      if (activeFlightIds.has(id)) return;

      // Otherwise remove (stale main entity or unknown)
      entitiesToRemove.push(entity);
    });

    entitiesToRemove.forEach((e) => viewer.entities.remove(e));
  }, [visibleFlights, selectedFlight]); // Only re-run when flights or selection changes

  // -------------------------------------------------------------------------
  // 4. RENDER TRAJECTORY (Split into Static History + Live Bridge)

  // -------------------------------------------------------------------------
  // 4. RENDER TRAJECTORY (Unified Spline)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    // 1. Prepare Points: History + Current Position
    let allPoints: Cartesian3[] = [];

    // A. Process History
    // Helper to remove outliers (sharp turns) - KEEPING THIS as it's good for Cesium
    const removeOutliers = (points: any[]) => {
      if (points.length < 3) return points;
      try {
        const cartesians = points.map((p) =>
          Cartesian3.fromDegrees(p.gps.longitude, p.gps.latitude, p.gps.altitude)
        );
        const keep = new Array(points.length).fill(true);
        for (let i = 1; i < points.length - 1; i++) {
          const prev = cartesians[i - 1];
          const curr = cartesians[i];
          const next = cartesians[i + 1];
          const v1 = Cartesian3.subtract(curr, prev, new Cartesian3());
          const v2 = Cartesian3.subtract(next, curr, new Cartesian3());
          if (Cartesian3.magnitudeSquared(v1) < 0.0001 || Cartesian3.magnitudeSquared(v2) < 0.0001)
            continue;
          Cartesian3.normalize(v1, v1);
          Cartesian3.normalize(v2, v2);
          if (Cartesian3.dot(v1, v2) < 0.0) keep[i] = false; // > 90 deg turn
        }
        return points.filter((_, i) => keep[i]);
      } catch (e) {
        return points;
      }
    };

    // VR LOGIC PORT: Dedupe close points (min 20s separation)
    const dedupeClosePoints = (points: any[]) => {
      if (points.length === 0) return points;
      const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
      const filtered = [sorted[0]];

      for (let i = 1; i < sorted.length; i++) {
        const prev = filtered[filtered.length - 1];
        const current = sorted[i];
        // 20 seconds = 20000 ms
        if (current.timestamp - prev.timestamp >= 20000) {
          filtered.push(current);
        }
      }
      return filtered;
    };

    const sortedTrajectory = [...trajectory].sort((a, b) => a.timestamp - b.timestamp);

    // 1. Remove outliers first (sanity check)
    let workingTrajectory = removeOutliers(sortedTrajectory);
    if (workingTrajectory.length < 2) workingTrajectory = sortedTrajectory;

    // 2. Dedupe close points (VR Logic)
    workingTrajectory = dedupeClosePoints(workingTrajectory);

    // 3. Trim History to last 5 points (VR Logic)
    // VR uses slice(-5).
    const HISTORY_LIMIT = 5;
    let filteredTrajectory = workingTrajectory.slice(-HISTORY_LIMIT);

    // 4. Enforce separation with CURRENT position (Time AND Distance)
    // Cesium's CatmullRomSpline doesn't support "centripetal" parameterization like Three.js.
    // This causes overshoots/loops if the last history point is too close to the current position.
    // We manually enforce separation between the last history point and the current plane.
    const MIN_SEPARATION_MS = 20000;
    const MIN_SEPARATION_METERS = 1000; // 1km

    // Current position Cartesian
    const currentPosCartesian = selectedFlight
      ? Cartesian3.fromDegrees(
          selectedFlight.gps.longitude,
          selectedFlight.gps.latitude,
          selectedFlight.gps.altitude
        )
      : Cartesian3.ZERO;

    while (filteredTrajectory.length > 0 && selectedFlight) {
      const lastPoint = filteredTrajectory[filteredTrajectory.length - 1];

      // Check Time
      const timeDiff = selectedFlight.lastUpdate - lastPoint.timestamp;

      // Check Distance
      const lastPointCartesian = Cartesian3.fromDegrees(
        lastPoint.gps.longitude,
        lastPoint.gps.latitude,
        lastPoint.gps.altitude
      );
      const distance = Cartesian3.distance(currentPosCartesian, lastPointCartesian);

      if (timeDiff < MIN_SEPARATION_MS || distance < MIN_SEPARATION_METERS) {
        // Too close! Drop the history point in favor of the live one.
        filteredTrajectory.pop();
      } else {
        break;
      }
    }

    // Convert history to Cartesian3
    const historyPositions = filteredTrajectory.map((p) =>
      Cartesian3.fromDegrees(p.gps.longitude, p.gps.latitude, p.gps.altitude)
    );

    // B. Add Current Position
    if (selectedFlight) {
      const currentPos = Cartesian3.fromDegrees(
        selectedFlight.gps.longitude,
        selectedFlight.gps.latitude,
        selectedFlight.gps.altitude
      );

      // Only add if we have history and it's distinct from the last point
      if (historyPositions.length > 0) {
        const lastHist = historyPositions[historyPositions.length - 1];
        if (Cartesian3.distance(lastHist, currentPos) > 5.0) {
          // 5m threshold
          historyPositions.push(currentPos);
        } else {
          // Update last point to be exact current pos
          historyPositions[historyPositions.length - 1] = currentPos;
        }
      } else {
        historyPositions.push(currentPos);
      }
    }

    allPoints = historyPositions;

    // C. Generate Spline
    let finalPositions: Cartesian3[] = [];

    if (allPoints.length >= 2) {
      try {
        // We don't have exact times for the current position relative to history easily available
        // without parsing everything. For a visual path, we can assume uniform or distance-based spacing.
        // CatmullRomSpline works best with times. We'll approximate times based on index or distance.
        // Actually, let's use the timestamps we have for history, and extrapolate for current.

        // Re-map to include timestamps
        const pointsWithTime: { time: number; pos: Cartesian3 }[] = [];

        // History points
        filteredTrajectory.forEach((p, i) => {
          pointsWithTime.push({
            time: p.timestamp,
            pos: historyPositions[i], // Corresponds to filteredTrajectory[i]
          });
        });

        // Current point (if added)
        if (allPoints.length > filteredTrajectory.length) {
          // It was added.
          pointsWithTime.push({
            time: Date.now(),
            pos: allPoints[allPoints.length - 1],
          });
        }

        // Ensure times are strictly increasing
        for (let i = 1; i < pointsWithTime.length; i++) {
          if (pointsWithTime[i].time <= pointsWithTime[i - 1].time) {
            pointsWithTime[i].time = pointsWithTime[i - 1].time + 1000; // Force 1s gap
          }
        }

        const times = pointsWithTime.map((p) => p.time / 1000); // Seconds
        const positions = pointsWithTime.map((p) => p.pos);

        const spline = new CatmullRomSpline({
          times: times,
          points: positions,
        });

        const startTime = times[0];
        const endTime = times[times.length - 1];
        const duration = endTime - startTime;

        // Sample
        const numSamples = Math.max(positions.length * 10, 100);
        for (let i = 0; i <= numSamples; i++) {
          const t = startTime + (i / numSamples) * duration;
          finalPositions.push(spline.evaluate(t));
        }
      } catch (e) {
        console.warn('Spline generation failed, using raw points', e);
        finalPositions = allPoints;
      }
    } else {
      finalPositions = allPoints;
    }

    console.log(
      `[CesiumScene] Trajectory Gen: History=${historyPositions.length}, Total=${allPoints.length}, Final=${finalPositions.length}`
    );

    // REMOVED: HIDE TRAJECTORY IN FOLLOW MODE
    // We want to see the trajectory even when following to verify the fix.
    // if (followingFlight) {
    //     finalPositions = [];
    // }

    // D. Render Segments
    const segmentCount = finalPositions.length - 1;

    for (let i = 0; i < segmentCount; i++) {
      const start = finalPositions[i];
      const end = finalPositions[i + 1];
      const progress = i / segmentCount;

      // Visual Style: Solid Purple, Fades out
      const maxWidth = followingFlight ? 10 : 4; // Slightly thicker
      const width = progress * maxWidth;

      // Opacity: Solid 1.0 (User Request: "only purple", no gradient)
      const opacity = 1.0;

      // SOLID PURPLE
      const color = Color.fromCssColorString('#c6a0e8').withAlpha(opacity);

      const segmentId = `traj-${i}`;
      const entity = viewer.entities.getById(segmentId);

      if (entity) {
        if (entity.polyline) {
          entity.polyline.positions = [start, end] as any;
          entity.polyline.width = new ConstantProperty(width);
          entity.polyline.material = new ColorMaterialProperty(color);
          // Ensure depthFailMaterial matches main color so it doesn't look dark/transparent when clipping terrain
          entity.polyline.depthFailMaterial = new ColorMaterialProperty(color);
        }
      } else {
        viewer.entities.add({
          id: segmentId,
          polyline: {
            positions: [start, end],
            width: width,
            material: new ColorMaterialProperty(color),
            // Ensure depthFailMaterial matches main color
            depthFailMaterial: new ColorMaterialProperty(color),
          },
        });
      }
    }

    // Cleanup Stale
    const entitiesToRemove: any[] = [];
    viewer.entities.values.forEach((e) => {
      if (e.id && typeof e.id === 'string' && e.id.startsWith('traj-')) {
        const index = parseInt(e.id.replace('traj-', ''), 10);
        if (!isNaN(index) && index >= segmentCount) {
          entitiesToRemove.push(e);
        }
      }
    });
    entitiesToRemove.forEach((e) => viewer.entities.remove(e));
  }, [trajectory, selectedFlight, followingFlight]);

  // Handle Clicks on Entities
  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (defined(pickedObject) && pickedObject.id) {
        // Find flight by ID
        let flightId = pickedObject.id.id; // Entity ID (string)

        // Handle ghost entities
        if (typeof flightId === 'string' && flightId.endsWith('-ghost')) {
          flightId = flightId.replace('-ghost', '');
        }

        const flight = flights.find((f) => f.id === flightId);
        if (flight) {
          handleSelect(flight);
        }
      } else {
        // Deselect if clicked empty space? Maybe not for now.
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [flights]); // Re-bind when flights change to ensure closure has latest data

  // -------------------------------------------------------------------------
  // 2. RENDER
  // -------------------------------------------------------------------------
  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{
          background: 'linear-gradient(to bottom, #1a1625 0%, #4a3b69 100%)', // Dark Purple Gradient
        }}
        onClickCapture={() => {
          // Force focus on click
          const canvas = viewerRef.current?.scene.canvas;
          if (canvas) canvas.focus();
        }}
      />

      {/* Enter AR Button */}

      {/* CSS Overlay Fix */}
      <style>{`
                .cesium-viewer, 
                .cesium-widget, 
                .cesium-widget canvas {
                    height: 100% !important;
                    width: 100% !important;
                    position: absolute !important;
                    top: 0;
                    left: 0;
                    pointer-events: auto !important;
                }
                
                .cesium-viewer-bottom {
                    display: none !important;
                }
            `}</style>
    </div>
  );
}
