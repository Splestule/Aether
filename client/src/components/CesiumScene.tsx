import { useRef, useEffect, useState } from "react";
import { Viewer, Entity, CameraFlyTo, ImageryLayer, PolylineGraphics } from "resium";
import {
    Cartesian3,
    Color,
    VerticalOrigin,
    HorizontalOrigin,
    DistanceDisplayCondition,
    Ion,
    Viewer as CesiumViewer,
    Math as CesiumMath,
    Cesium3DTileset,
    buildModuleUrl,
    TileMapServiceImageryProvider,
    ArcGisMapServerImageryProvider,
    CameraEventType,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
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
    const viewerRef = useRef<CesiumViewer | null>(null);
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

    // Load Google Photorealistic 3D Tiles via Cesium Ion (Asset ID 96188)
    useEffect(() => {
        const loadTileset = async () => {
            if (!viewerRef.current) return;

            // Force resize to ensure canvas is visible
            viewerRef.current.resize();

            // Double check resize after a short delay to handle transition animations
            setTimeout(() => {
                if (viewerRef.current) viewerRef.current.resize();
            }, 100);
            setTimeout(() => {
                if (viewerRef.current) viewerRef.current.resize();
            }, 500);

            console.log("Attempting to load Google 3D Tiles (Asset 96188)...");
            if (!Ion.defaultAccessToken) {
                console.warn("Cesium Ion token is missing! Please check VITE_CESIUM_ION_TOKEN in .env");
            }

            try {
                const tileset = await Cesium3DTileset.fromIonAssetId(96188);
                viewerRef.current.scene.primitives.add(tileset);
                console.log("Google Photorealistic 3D Tiles (Ion Asset 96188) loaded successfully");

            } catch (error) {
                console.error("Failed to load Google 3D Tiles from Ion:", error);
            }
        };

        loadTileset();
    }, []);

    // Handle flight selection
    const handleSelect = (flight: ProcessedFlight) => {
        onFlightSelect(flight);
    };

    return (
        <div className="absolute inset-0 z-10 bg-black">
            {/* Force Cesium styles */}
            <style>{`
                .cesium-viewer, 
                .cesium-viewer-bottom, 
                .cesium-widget, 
                .cesium-widget canvas {
                    height: 100% !important;
                    width: 100% !important;
                    position: absolute !important;
                    top: 0;
                    left: 0;
                }
            `}</style>

            <Viewer
                full
                className="w-full h-full block"
                ref={(e) => {
                    if (e && e.cesiumElement) {
                        viewerRef.current = e.cesiumElement;

                        // Aggressive resize strategy
                        const viewer = e.cesiumElement;

                        // Configure for ground level view
                        const scene = viewer.scene;
                        const canvas = scene.canvas;

                        // Disable default camera controls entirely to prevent interference
                        scene.screenSpaceCameraController.enableRotate = false;
                        scene.screenSpaceCameraController.enableTranslate = false;
                        scene.screenSpaceCameraController.enableZoom = false;
                        scene.screenSpaceCameraController.enableTilt = false;
                        scene.screenSpaceCameraController.enableLook = false;

                        // Custom FPS Look Handler
                        // We use a raw ScreenSpaceEventHandler to manually rotate the camera
                        // This guarantees "look around" behavior without moving position
                        const handler = new ScreenSpaceEventHandler(canvas);
                        let isLooking = false;
                        let lastMousePosition: any = null;

                        handler.setInputAction((movement: any) => {
                            isLooking = true;
                            lastMousePosition = movement.position;
                        }, ScreenSpaceEventType.LEFT_DOWN);

                        handler.setInputAction((movement: any) => {
                            if (isLooking && lastMousePosition) {
                                const deltaX = movement.endPosition.x - lastMousePosition.x;
                                const deltaY = movement.endPosition.y - lastMousePosition.y;

                                const sensitivity = 0.002;
                                viewer.camera.lookRight(deltaX * sensitivity);
                                viewer.camera.lookDown(deltaY * sensitivity);

                                lastMousePosition = movement.endPosition;
                            }
                        }, ScreenSpaceEventType.MOUSE_MOVE);

                        handler.setInputAction(() => {
                            isLooking = false;
                        }, ScreenSpaceEventType.LEFT_UP);

                        // Store handler to destroy later if needed (though component unmount cleans viewer)
                        (viewer as any)._customHandler = handler;

                        // 1. Immediate resize
                        viewer.resize();

                        // 2. Resize loop for the first second to handle transitions
                        let frames = 0;
                        const resizeLoop = () => {
                            if (frames < 60) { // Run for ~1 second
                                viewer.resize();
                                frames++;
                                requestAnimationFrame(resizeLoop);
                            }
                        };
                        requestAnimationFrame(resizeLoop);

                        // 3. Force window resize event as backup
                        window.dispatchEvent(new Event('resize'));
                    }
                }}
                timeline={false}
                animation={false}
                baseLayerPicker={true} // Use default picker
                geocoder={false}
                homeButton={false}
                sceneModePicker={false}
                navigationHelpButton={false}
                selectionIndicator={true}
                infoBox={false}
                contextOptions={{
                    webgl: {
                        alpha: false, // Force opaque
                    }
                }}
            >
                {/* Fly to user location on start - Ground Level View */}
                <CameraFlyTo
                    destination={Cartesian3.fromDegrees(
                        userLocation.longitude,
                        userLocation.latitude,
                        50 // Start at 50m altitude (safe ground level)
                    )}
                    orientation={{
                        heading: CesiumMath.toRadians(0), // North
                        pitch: CesiumMath.toRadians(-5), // Slightly down to see horizon and ground
                        roll: 0
                    }}
                    duration={3}
                />

                {/* User Location Marker */}
                <Entity
                    position={Cartesian3.fromDegrees(
                        userLocation.longitude,
                        userLocation.latitude
                    )}
                    point={{ pixelSize: 10, color: Color.BLUE }}
                    label={{
                        text: "You",
                        font: "14px sans-serif",
                        pixelOffset: new Cartesian3(0, -20, 0),
                        verticalOrigin: VerticalOrigin.TOP,
                        horizontalOrigin: HorizontalOrigin.CENTER,
                        fillColor: Color.WHITE,
                        showBackground: true,
                        backgroundColor: new Color(0, 0, 0, 0.5),
                    }}
                />

                {/* Flights */}
                {flights.map((flight) => (
                    <Entity
                        key={flight.id}
                        position={Cartesian3.fromDegrees(
                            flight.gps.longitude,
                            flight.gps.latitude,
                            flight.gps.altitude
                        )}
                        onClick={() => handleSelect(flight)}
                        point={{
                            pixelSize: selectedFlight?.id === flight.id ? 15 : 10,
                            color: selectedFlight?.id === flight.id ? Color.YELLOW : Color.RED,
                            outlineColor: Color.WHITE,
                            outlineWidth: 2,
                        }}
                        label={{
                            text: `${flight.callsign} \n${formatAltitude(flight.gps.altitude)} `,
                            font: "12px sans-serif",
                            pixelOffset: new Cartesian3(0, 20, 0),
                            verticalOrigin: VerticalOrigin.BOTTOM,
                            horizontalOrigin: HorizontalOrigin.CENTER,
                            fillColor: Color.WHITE,
                            showBackground: true,
                            backgroundColor: new Color(0, 0, 0, 0.7),
                            distanceDisplayCondition: new DistanceDisplayCondition(0, 50000), // Hide label when far away
                        }}
                        description={`
Callsign: ${flight.callsign}
Altitude: ${formatAltitude(flight.gps.altitude)}
Speed: ${formatSpeed(flight.velocity)}
Heading: ${flight.heading}°
`}
                    />
                ))}

                {/* Trajectory for Selected Flight */}
                {trajectory.length > 0 && (
                    <Entity>
                        <PolylineGraphics
                            positions={Cartesian3.fromDegreesArrayHeights(
                                trajectory.flatMap(p => [p.gps.longitude, p.gps.latitude, p.gps.altitude])
                            )}
                            width={3}
                            material={Color.CYAN}
                        />
                    </Entity>
                )}
            </Viewer>
        </div>
    );
}
