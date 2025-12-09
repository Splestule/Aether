import { useRef, useEffect, useState } from "react";
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
    HermiteSpline,
    ConstantProperty,
    NearFarScalar,
    CustomShader,
    CallbackProperty,
    ColorMaterialProperty,
    Transforms,
} from "cesium";

import { ProcessedFlight, UserLocation } from "@shared/src/types";
import { formatAltitude, formatSpeed } from "@shared/src/utils";
import { config } from "../config";

// Set Cesium Ion token if available
if (import.meta.env.VITE_CESIUM_ION_TOKEN) {
    Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
}

interface CesiumSceneProps {
    userLocation: UserLocation;
    flights: ProcessedFlight[];
    selectedFlight: ProcessedFlight | null;
    onFlightSelect: (flight: ProcessedFlight | null) => void;
}

export function CesiumScene({
    userLocation,
    flights,
    selectedFlight,
    onFlightSelect,
}: CesiumSceneProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<CesiumViewer | null>(null);
    const isCameraInitialized = useRef(false);
    const [trajectory, setTrajectory] = useState<any[]>([]);

    // Fetch trajectory when flight is selected
    useEffect(() => {
        // Clear previous trajectory immediately to prevent "transfer" glitch
        setTrajectory([]);
        setHistorySamples([]); // Clear static history immediately

        // INSTANT CLEANUP: Remove existing trajectory entities from the scene
        // This ensures the old path disappears *instantly* when switching planes.
        if (viewerRef.current) {
            const entitiesToRemove: any[] = [];
            viewerRef.current.entities.values.forEach(e => {
                if (e.id && typeof e.id === 'string' && e.id.startsWith("traj-")) {
                    entitiesToRemove.push(e);
                }
            });
            entitiesToRemove.forEach(e => viewerRef.current?.entities.remove(e));
        }

        if (!selectedFlight) {
            return;
        }

        const fetchTrajectory = async () => {
            try {
                console.log(`[CesiumScene] Fetching trajectory for ${selectedFlight.icao24}...`);
                const url = `${config.apiUrl}/api/flights/${selectedFlight.icao24}/trajectory?lat=${userLocation.latitude}&lon=${userLocation.longitude}&alt=${userLocation.altitude}`;
                // console.log("[CesiumScene] URL:", url);

                const response = await fetch(url);
                console.log(`[CesiumScene] Response status: ${response.status}`);

                const data = await response.json();
                if (data.success) {
                    console.log(`[CesiumScene] Loaded ${data.data.length} points.`);
                    setTrajectory(data.data);
                } else {
                    console.warn("[CesiumScene] API returned success: false", data);
                }
            } catch (error) {
                console.error("[CesiumScene] Failed to fetch trajectory:", error);
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
                    requestWaterMask: true
                });
                // setTerrainProvider(terrain); // State removed to fix unused var error

                // FORCE UPDATE: Manually assign to viewer to ensure it applies immediately
                if (viewerRef.current) {
                    viewerRef.current.terrainProvider = terrain;
                    console.log("World Terrain manually assigned to viewer.");

                    // Store for sampling
                    (viewerRef.current as any)._samplingTerrain = terrain;
                }

                console.log("World Terrain loaded & set to state.");
            } catch (error) {
                console.error("Failed to load World Terrain:", error);
            }
        };

        initTerrain();
    }, []); // Run once on mount

    // 2. CAMERA UPDATE: Handle User Location Changes (Run when userLocation changes)
    useEffect(() => {
        const updateCameraPosition = async () => {
            if (!viewerRef.current) return;

            console.log("Updating Camera for Location:", userLocation);

            // Sample terrain height
            try {
                // Access the terrain we stored for sampling
                const terrain = (viewerRef.current as any)._samplingTerrain;

                if (!terrain) {
                    console.warn("Terrain for sampling not ready yet.");
                    return;
                }

                // Sample terrain height
                const position = Cartographic.fromDegrees(userLocation.longitude, userLocation.latitude);
                let terrainHeight = 0;

                try {
                    const updatedPositions = await sampleTerrainMostDetailed(terrain, [position]);
                    terrainHeight = updatedPositions[0].height;
                } catch (e) {
                    console.warn("Terrain sampling failed, using default altitude.", e);
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
                            roll: 0
                        }
                    });
                    isCameraInitialized.current = true;
                }
                // ELSE: DO NOTHING. 
                // We intentionally do not update the camera on subsequent location updates
                // to prevent "snapping" the view back to default orientation.
                // The user is in full control.

            } catch (error) {
                console.error("Failed to update camera position:", error);
            }
        };

        updateCameraPosition();
    }, []); // RUN ONCE: Never re-run to prevent camera snapping/resetting

    // Handle flight selection
    const handleSelect = (flight: ProcessedFlight) => {
        onFlightSelect(flight);
    };

    // -------------------------------------------------------------------------
    // 1. INITIALIZATION (Runs EXACTLY ONCE)
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!containerRef.current || viewerRef.current) return;

        console.log("Initializing Cesium Viewer...");

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
            creditContainer: document.createElement("div"),
            contextOptions: {
                webgl: {
                    alpha: true, // Enable transparency for CSS background
                }
            }
        } as any);

        // Load Imagery Async with Styling
        IonImageryProvider.fromAssetId(4).then((provider) => {
            const layer = viewer.imageryLayers.addImageryProvider(provider);
            // Style: Dark Gray Filter
            layer.saturation = 0.1; // Almost grayscale
            layer.contrast = 1.2;   // Higher contrast for dark mode
            layer.brightness = 0.6; // Dark Gray
            layer.gamma = 1.0;
        }).catch((error) => {
            console.error("Failed to load Bing Maps Road:", error);
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

        // HORIZON LOCK & COMPASS UPDATE
        viewer.scene.postRender.addEventListener(() => {
            const camera = viewer.camera;

            // 1. Horizon Lock: Force roll to 0 (Fixes "Tilt")
            if (Math.abs(camera.roll) > 1e-4) {
                camera.setView({
                    orientation: {
                        heading: camera.heading,
                        pitch: camera.pitch,
                        roll: 0
                    }
                });
            }

            // 2. Compass Update
            const compassEl = document.getElementById("compass-display");
            if (compassEl) {
                const headingDegrees = CesiumMath.toDegrees(camera.heading);
                const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
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

        canvas.setAttribute("tabindex", "0");
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
            (viewer as any).cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        } catch (e) {
            console.warn("Failed to disable double-click zoom:", e);
        }

        // FIX SNAPPING
        viewer.trackedEntity = undefined;
        viewer.camera.lookAtTransform(Matrix4.IDENTITY);

        // D. Load Google 3D Tiles
        const loadTiles = async () => {
            try {
                console.log("Loading Google 3D Tiles (Asset 96188)...");
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
                    `
                });

                viewer.scene.primitives.add(tileset);
                console.log("Google Photorealistic 3D Tiles added.");
            } catch (error) {
                console.error("Failed to load Google 3D Tiles:", error);
            }
        };
        loadTiles();

        // E. Fog Disabled (User Request)
        viewer.scene.fog.enabled = false;

        // E. Initial Camera Position
        setTimeout(() => {
            if (viewer.isDestroyed()) return;
            console.log("Executing Initial Camera SetView");
            viewer.camera.setView({
                destination: Cartesian3.fromDegrees(
                    userLocation.longitude,
                    userLocation.latitude,
                    (userLocation.altitude || 0) + 100 // Lower altitude (Closer to ground)
                ),
                orientation: {
                    heading: CesiumMath.toRadians(0),
                    pitch: CesiumMath.toRadians(-10), // Look more level
                    roll: 0
                }
            });
            isCameraInitialized.current = true;
        }, 100);

        // Cleanup
        return () => {
            console.log("CesiumScene Unmounting...");
            if (viewerRef.current) {
                viewerRef.current.destroy();
                viewerRef.current = null;
            }
        };
    }, []); // Empty dependency array = Runs ONCE

    // -------------------------------------------------------------------------
    // 3. RENDER ENTITIES (Flights)
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!viewerRef.current) return;
        const viewer = viewerRef.current;

        // Track active flight IDs to identify removals
        const activeFlightIds = new Set(flights.map(f => f.id));

        // 1. Update or Add Flights
        flights.forEach((flight) => {
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
            const mainColor = isSelected ? Color.fromCssColorString("#c6a0e8") : Color.WHITE;
            const ghostColor = mainColor.withAlpha(0.5);
            const pixelSize = isSelected ? 25 : 20;

            // --- MAIN ENTITY ---
            if (entity) {
                // UPDATE existing entity
                entity.position = position as any;

                if (entity.point) {
                    entity.point.color = new ConstantProperty(mainColor);
                    entity.point.pixelSize = new ConstantProperty(pixelSize);
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
                        pixelSize: pixelSize,
                        color: mainColor,
                        outlineColor: Color.BLACK.withAlpha(0.2),
                        outlineWidth: 1,
                        scaleByDistance: new NearFarScalar(1.0e3, 1.0, 1.0e5, 0.5),
                        // Normal depth test (occluded by terrain)
                        disableDepthTestDistance: 0,
                    },
                    // Vertical Line to Ground
                    polyline: {
                        width: 2,
                        material: new Color(1.0, 1.0, 1.0, 0.3) // Faint white
                    },
                    description: `
Callsign: ${flight.callsign}
Altitude: ${formatAltitude(flight.gps.altitude)}
Speed: ${formatSpeed(flight.velocity)}
Heading: ${flight.heading}°
`
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
                    ghostEntity.point.pixelSize = new ConstantProperty(pixelSize);
                }
            } else {
                viewer.entities.add({
                    id: ghostId,
                    position: position,
                    point: {
                        pixelSize: pixelSize,
                        color: ghostColor,
                        outlineColor: Color.BLACK.withAlpha(0.1),
                        outlineWidth: 1,
                        scaleByDistance: new NearFarScalar(1.0e3, 1.0, 1.0e5, 0.5),
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
            if (id.startsWith("traj-")) return;

            // Ghost Entity
            if (id.endsWith("-ghost")) {
                const baseId = id.replace("-ghost", "");
                if (activeFlightIds.has(baseId)) return; // Keep if base is active
                entitiesToRemove.push(entity);
                return;
            }

            // Main Entity
            if (activeFlightIds.has(id)) return;

            // Otherwise remove (stale main entity or unknown)
            entitiesToRemove.push(entity);
        });

        entitiesToRemove.forEach(e => viewer.entities.remove(e));

    }, [flights, selectedFlight]); // Only re-run when flights or selection changes

    // -------------------------------------------------------------------------
    // 4. RENDER TRAJECTORY (Split into Static History + Live Bridge)

    // State for static history samples (computed only when trajectory data changes)
    const [historySamples, setHistorySamples] = useState<Cartesian3[]>([]);
    // const [lastHistoryTime, setLastHistoryTime] = useState<number>(0);

    // Effect A: Compute Static History Spline
    useEffect(() => {
        if (trajectory.length === 0) {
            setHistorySamples([]);
            // setLastHistoryTime(0);
            return;
        }

        // Helper to remove outliers (sharp turns)
        const removeOutliers = (points: any[]) => {
            if (points.length < 3) return points;

            try {
                const cartesians = points.map(p => Cartesian3.fromDegrees(p.gps.longitude, p.gps.latitude, p.gps.altitude));
                const keep = new Array(points.length).fill(true);

                for (let i = 1; i < points.length - 1; i++) {
                    const prev = cartesians[i - 1];
                    const curr = cartesians[i];
                    const next = cartesians[i + 1];

                    const v1 = Cartesian3.subtract(curr, prev, new Cartesian3());
                    const v2 = Cartesian3.subtract(next, curr, new Cartesian3());

                    // Check for zero length vectors to prevent crash
                    if (Cartesian3.magnitudeSquared(v1) < 0.0001 || Cartesian3.magnitudeSquared(v2) < 0.0001) {
                        continue;
                    }

                    Cartesian3.normalize(v1, v1);
                    Cartesian3.normalize(v2, v2);

                    const dot = Cartesian3.dot(v1, v2);

                    // Filter sharp turns (> 90 degrees change)
                    if (dot < 0.0) {
                        keep[i] = false;
                    }
                }

                return points.filter((_, i) => keep[i]);
            } catch (e) {
                console.error("[CesiumScene] Error removing outliers:", e);
                return points;
            }
        };

        // Sort by timestamp first
        const sortedTrajectory = [...trajectory].sort((a, b) => a.timestamp - b.timestamp);

        // Remove outliers before filtering by time
        let workingTrajectory = removeOutliers(sortedTrajectory);

        // Safety check: If outlier removal left us with too few points, revert to original
        if (workingTrajectory.length < 2) {
            workingTrajectory = sortedTrajectory;
        }

        // Filter for last 15 minutes
        const cutoff = Date.now() - 15 * 60 * 1000;
        let filteredTrajectory = workingTrajectory.filter(p => p.timestamp > cutoff);

        // Fallback: If we have no recent points, or too few, take the last 20 points available
        // This ensures we show *something* even if data is old (matching Desktop behavior)
        if (filteredTrajectory.length < 2 && workingTrajectory.length > 0) {
            filteredTrajectory = workingTrajectory.slice(-20);
        }

        // If we have NO points, clear and return
        if (filteredTrajectory.length === 0) {
            setHistorySamples([]);
            return;
        }

        const positions = filteredTrajectory.map(p => Cartesian3.fromDegrees(p.gps.longitude, p.gps.latitude, p.gps.altitude));

        // If we only have 1 point, we can't make a spline, but we CAN use it as a start point for the bridge
        if (positions.length === 1) {
            setHistorySamples(positions);
            return;
        }

        const times = filteredTrajectory.map(p => p.timestamp / 1000);

        try {
            const spline = new CatmullRomSpline({
                times: times,
                points: positions
            });

            const startTime = times[0];
            const endTime = times[times.length - 1];
            const duration = endTime - startTime;

            if (duration <= 0) return;

            const numSamples = Math.max(positions.length * 10, 50);
            const samples: Cartesian3[] = [];
            for (let i = 0; i <= numSamples; i++) {
                const t = startTime + (i / numSamples) * duration;
                samples.push(spline.evaluate(t));
            }

            setHistorySamples(samples);
            // setLastHistoryTime(endTime); // Store end time of history for bridging
        } catch (e) {
            console.error("[CesiumScene] Error generating history spline:", e);
            // Fallback: Use raw positions if spline fails
            setHistorySamples(positions);
        }
    }, [trajectory]);

    // Effect B: Render Loop (Connect History to Live Plane)
    useEffect(() => {
        if (!viewerRef.current) return;
        const viewer = viewerRef.current;

        // SKIP LAST POINT STRATEGY:
        // We exclude the very last point of the static history from the "static" list.
        // Instead, we start the smooth bridge from the *second to last* point.
        // This replaces the final jagged segment with a smooth curve, eliminating the "kink" at the connection.
        let finalPositions: Cartesian3[] = [];
        let bridgeStartPoint: Cartesian3 | null = null;
        let prevHistoryPoint: Cartesian3 | null = null;

        if (historySamples.length >= 2) {
            // Use all points EXCEPT the last one
            finalPositions = historySamples.slice(0, historySamples.length - 1);
            bridgeStartPoint = historySamples[historySamples.length - 2];

            // For tangent calculation
            if (historySamples.length >= 3) {
                prevHistoryPoint = historySamples[historySamples.length - 3];
            } else {
                prevHistoryPoint = bridgeStartPoint; // Fallback
            }
        } else {
            // Not enough history to skip, just use what we have
            finalPositions = [...historySamples];
            if (historySamples.length > 0) {
                bridgeStartPoint = historySamples[historySamples.length - 1];
                prevHistoryPoint = bridgeStartPoint;
            }
        }

        // Add Bridge to Current Position (Smooth Spline + Validation)
        if (selectedFlight && bridgeStartPoint) {
            const currentPos = Cartesian3.fromDegrees(
                selectedFlight.gps.longitude,
                selectedFlight.gps.latitude,
                selectedFlight.gps.altitude
            );

            // Validate currentPos to prevent crash
            if (currentPos && !Cartesian3.equals(currentPos, Cartesian3.ZERO)) {
                const distance = Cartesian3.distance(bridgeStartPoint, currentPos);

                // Only add if distance is significant (> 1 meter) to prevent zero-length segments
                // which cause "normalized result is not a number" errors in Cesium
                if (distance > 1.0) {
                    // SMOOTHING: Use a local spline to connect history to current position
                    try {
                        // Calculate tangents for Hermite Spline
                        // 1. Outgoing tangent from history (at bridgeStartPoint)
                        let outgoingTangent: Cartesian3;

                        // Scale factor: 0.5 is standard for Catmull-Rom style curvature. 
                        const tangentScale = distance * 0.5;

                        if (prevHistoryPoint && Cartesian3.distance(prevHistoryPoint, bridgeStartPoint) > 0.1) {
                            // CATMULL-ROM TANGENT STRATEGY:
                            // Tangent = (NextPoint - PrevPoint) / 2
                            // NextPoint = currentPos
                            // PrevPoint = prevHistoryPoint
                            const curveDir = Cartesian3.subtract(currentPos, prevHistoryPoint, new Cartesian3());
                            Cartesian3.normalize(curveDir, curveDir);
                            outgoingTangent = Cartesian3.multiplyByScalar(curveDir, tangentScale, new Cartesian3());
                        } else {
                            // No previous history, point straight at plane
                            const dir = Cartesian3.subtract(currentPos, bridgeStartPoint, new Cartesian3());
                            Cartesian3.normalize(dir, dir);
                            outgoingTangent = Cartesian3.multiplyByScalar(dir, tangentScale, new Cartesian3());
                        }

                        // 2. Incoming tangent to plane: Aligned with Heading AND Pitch
                        const currentAlt = selectedFlight.gps.altitude;
                        const lastCartographic = Cartographic.fromCartesian(bridgeStartPoint);
                        const lastAlt = lastCartographic.height;
                        const altDiff = currentAlt - lastAlt;

                        // Calculate slope (approximate sine of pitch)
                        const slope = altDiff / distance;

                        const headingRad = CesiumMath.toRadians(selectedFlight.heading);
                        const modelMatrix = Transforms.eastNorthUpToFixedFrame(currentPos);

                        // ENU: East=X, North=Y, Up=Z
                        const x = Math.sin(headingRad);
                        const y = Math.cos(headingRad);

                        // Combine into 3D vector
                        const localDir = new Cartesian3(x, y, slope);
                        Cartesian3.normalize(localDir, localDir);

                        const planeDir = Matrix4.multiplyByPointAsVector(modelMatrix, localDir, new Cartesian3());

                        // Scale tangent by distance
                        const planeTangent = Cartesian3.multiplyByScalar(planeDir, tangentScale, new Cartesian3());

                        // Create Hermite Spline
                        const bridgeSpline = new HermiteSpline({
                            times: [0, 1],
                            points: [bridgeStartPoint, currentPos],
                            inTangents: [outgoingTangent, planeTangent],
                            outTangents: [outgoingTangent, planeTangent]
                        });

                        // Sample the bridge segment
                        const bridgeSamples = 20; // Increased samples for smoother curve
                        for (let i = 1; i <= bridgeSamples; i++) {
                            const t = i / bridgeSamples;
                            finalPositions.push(bridgeSpline.evaluate(t));
                        }
                    } catch (e) {
                        // Fallback to straight line if spline fails
                        finalPositions.push(currentPos);
                    }
                }
            }
        } else if (selectedFlight && historySamples.length > 0) {
            // Fallback for very short history (0 or 1 point): just draw line from last point
            const currentPos = Cartesian3.fromDegrees(
                selectedFlight.gps.longitude,
                selectedFlight.gps.latitude,
                selectedFlight.gps.altitude
            );
            if (currentPos && !Cartesian3.equals(currentPos, Cartesian3.ZERO)) {
                finalPositions.push(currentPos);
            }
        }

        // Filter out any invalid points (Zero vectors) just in case to strictly prevent crashes
        // AND Deduplicate points to prevent "normalized result is not a number" crash in PolylinePipeline
        finalPositions = finalPositions.filter((p, index) => {
            if (Cartesian3.equals(p, Cartesian3.ZERO)) return false;
            if (index === 0) return true;
            return Cartesian3.distance(p, finalPositions[index - 1]) > 0.1; // 10cm threshold
        });

        const segmentCount = finalPositions.length - 1;

        for (let i = 0; i < segmentCount; i++) {
            const start = finalPositions[i];
            const end = finalPositions[i + 1];
            const progress = i / segmentCount;

            // Visual Style: Thinner, Purple, Fades out
            // Width: 0 (tail) -> 3 (plane)
            const width = progress * 3;
            // Opacity: 0.0 (tail) -> 0.8 (plane)
            const opacity = progress * 0.8;
            const color = Color.fromCssColorString("#c6a0e8").withAlpha(opacity);

            const segmentId = `traj-${i}`;
            const entity = viewer.entities.getById(segmentId);

            if (entity) {
                // UPDATE existing segment
                if (entity.polyline) {
                    entity.polyline.positions = [start, end] as any;
                    entity.polyline.width = new ConstantProperty(width);
                    entity.polyline.material = new ColorMaterialProperty(color);
                    entity.polyline.depthFailMaterial = new ColorMaterialProperty(Color.TRANSPARENT);
                }
            } else {
                // ADD new segment
                viewer.entities.add({
                    id: segmentId,
                    polyline: {
                        positions: [start, end],
                        width: width,
                        material: new ColorMaterialProperty(color),
                        depthFailMaterial: new ColorMaterialProperty(Color.TRANSPARENT)
                    }
                });
            }
        }

        // Cleanup Stale Segments
        const entitiesToRemove: any[] = [];
        viewer.entities.values.forEach(e => {
            if (e.id && typeof e.id === 'string' && e.id.startsWith("traj-")) {
                const index = parseInt(e.id.replace("traj-", ""), 10);
                if (!isNaN(index) && index >= segmentCount) {
                    entitiesToRemove.push(e);
                }
            }
        });
        entitiesToRemove.forEach(e => viewer.entities.remove(e));
    }, [historySamples, selectedFlight]);

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
                if (typeof flightId === 'string' && flightId.endsWith("-ghost")) {
                    flightId = flightId.replace("-ghost", "");
                }

                const flight = flights.find(f => f.id === flightId);
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
                    background: "linear-gradient(to bottom, #1a1625 0%, #4a3b69 100%)" // Dark Purple Gradient
                }}
                onClickCapture={() => {
                    // Force focus on click
                    const canvas = viewerRef.current?.scene.canvas;
                    if (canvas) canvas.focus();
                }}
            />

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
