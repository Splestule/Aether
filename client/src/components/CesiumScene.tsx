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
    Cartographic,
    Matrix4,
    Ion,
    VerticalOrigin,
    HorizontalOrigin,
    DistanceDisplayCondition,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    defined,
    IonImageryProvider,
    CustomShader,
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
        if (!selectedFlight) {
            setTrajectory([]);
            return;
        }

        const fetchTrajectory = async () => {
            try {
                const response = await fetch(`${config.apiUrl}/api/flights/${selectedFlight.icao24}/trajectory?lat=${userLocation.latitude}&lon=${userLocation.longitude}&alt=${userLocation.altitude}`);
                const data = await response.json();
                if (data.success) {
                    setTrajectory(data.data);
                }
            } catch (error) {
                console.error("Failed to fetch trajectory:", error);
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
                setTerrainProvider(terrain);

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
        viewer.scene.globe.depthTestAgainstTerrain = false;

        // SKY & ATMOSPHERE STYLING (Gradient Sky)
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
        if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
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
    // 3. RENDER ENTITIES (Flights & Trajectory)
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!viewerRef.current) return;
        const viewer = viewerRef.current;

        // Clear all entities to prevent duplicates
        viewer.entities.removeAll();

        // Add Flights
        flights.forEach((flight) => {
            // Add click handler wrapper? 
            // Native Cesium entities don't have onClick props directly.
            // We handle clicks via ScreenSpaceEventHandler usually, but for now let's just render.
            // To handle selection, we need a global handler.

            viewer.entities.add({
                id: flight.id,
                position: Cartesian3.fromDegrees(
                    flight.gps.longitude,
                    flight.gps.latitude,
                    flight.gps.altitude
                ),
                point: {
                    pixelSize: selectedFlight?.id === flight.id ? 15 : 10,
                    color: selectedFlight?.id === flight.id ? Color.YELLOW : Color.RED,
                    outlineColor: Color.WHITE,
                    outlineWidth: 2,
                },
                label: {
                    text: `${flight.callsign} \n${formatAltitude(flight.gps.altitude)} `,
                    font: "12px sans-serif",
                    pixelOffset: new Cartesian3(0, 20, 0),
                    verticalOrigin: VerticalOrigin.BOTTOM,
                    horizontalOrigin: HorizontalOrigin.CENTER,
                    fillColor: Color.WHITE,
                    showBackground: false,
                    distanceDisplayCondition: new DistanceDisplayCondition(0, 50000),
                },
                description: `
Callsign: ${flight.callsign}
Altitude: ${formatAltitude(flight.gps.altitude)}
Speed: ${formatSpeed(flight.velocity)}
Heading: ${flight.heading}°
`
            });
        });

        // Add Trajectory
        if (trajectory.length > 0) {
            viewer.entities.add({
                polyline: {
                    positions: Cartesian3.fromDegreesArrayHeights(
                        trajectory.flatMap(p => [p.gps.longitude, p.gps.latitude, p.gps.altitude])
                    ),
                    width: 3,
                    material: Color.CYAN
                }
            });
        }

    }, [flights, selectedFlight, trajectory]);

    // Handle Clicks on Entities
    useEffect(() => {
        if (!viewerRef.current) return;
        const viewer = viewerRef.current;
        const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction((click: any) => {
            const pickedObject = viewer.scene.pick(click.position);
            if (defined(pickedObject) && pickedObject.id) {
                // Find flight by ID
                const flightId = pickedObject.id.id; // Entity ID
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
