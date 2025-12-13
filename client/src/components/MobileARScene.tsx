import { Canvas, useThree } from "@react-three/fiber";

import { DeviceOrientationControls } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { UserLocation, ProcessedFlight, VRConfig } from "@shared/src/types.js";
import { ARWaypoint } from "./ARWaypoint";
import { FlightTrajectory } from "./FlightTrajectory";

interface MobileARSceneProps {
    userLocation: UserLocation;
    flights: ProcessedFlight[];
    selectedFlight: ProcessedFlight | null;
    onFlightSelect: (flight: ProcessedFlight | null) => void;
    config: VRConfig;
    heightCoefficient: number;
    distanceCoefficient: number;
    isOutOfRange?: boolean;
}

interface MobileARContentProps extends MobileARSceneProps {
    headingOffset: number;
}

// Compass component reading direct hardware heading
function CompassHeading() {
    useEffect(() => {
        const handleOrientation = (e: DeviceOrientationEvent) => {
            let heading: number | null = null;

            // @ts-ignore - iOS Property
            if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
                // @ts-ignore
                heading = e.webkitCompassHeading;
            } else if (e.alpha !== null) {
                // Android/Standard Fallback (0=N, CCW) -> Convert to CW
                heading = 360 - e.alpha;
            }

            if (heading !== null) {
                // Convert to int
                const degrees = Math.round(heading);
                // Convert to compass direction
                const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
                const index = Math.round(degrees / 45) % 8;
                const direction = directions[index];

                // Update the compass display element
                const compassEl = document.getElementById("compass-display");
                if (compassEl) {
                    compassEl.textContent = direction;
                }
            }
        };

        window.addEventListener("deviceorientation", handleOrientation);
        return () => window.removeEventListener("deviceorientation", handleOrientation);
    }, []);

    return null;
}

function MobileARContent({
    flights,
    selectedFlight,
    onFlightSelect,
    userLocation,
    headingOffset,
}: MobileARContentProps) {
    const { camera } = useThree();

    // Ensure camera starts looking forward/horizontal
    useEffect(() => {
        camera.position.set(0, 0, 0);
    }, [camera]);

    return (
        <>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />

            {/* Device Orientation Controls - Syncs camera with phone gyroscope */}
            <DeviceOrientationControls />

            {/* Updates UI Compass (Hardware direct - no offset) */}
            <CompassHeading />

            {/* Rotated Scene Content to Align with True North */}
            {/* Rotation = Heading + 90 deg. (Positive Y Rotation) */}
            <group rotation={[0, headingOffset, 0]}>
                {/* Flights */}
                {flights.map((flight) => (
                    <ARWaypoint
                        key={flight.id}
                        flight={flight}
                        isSelected={selectedFlight?.id === flight.id}
                        onClick={() => onFlightSelect(flight)}
                        isVR={false}
                    />
                ))}

                {/* Trajectory for selected flight */}
                {selectedFlight && (
                    <FlightTrajectory
                        flight={selectedFlight}
                        userLocation={userLocation}
                        isVR={false}
                    />
                )}
            </group>
        </>
    );
}

export function MobileARScene(props: MobileARSceneProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [streamError, setStreamError] = useState<string | null>(null);
    const [headingOffset, setHeadingOffset] = useState(0);

    // Effect 1: Compass Calibration (One-time startup alignment)
    useEffect(() => {
        const handleOrientation = (e: DeviceOrientationEvent) => {
            let compassHeading: number | null = null;

            // @ts-ignore - iOS Property
            if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
                // @ts-ignore
                compassHeading = e.webkitCompassHeading;
            } else if (e.alpha !== null) {
                // Android/Standard Fallback
                compassHeading = 360 - e.alpha;
            }

            if (compassHeading !== null) {
                // Formula: Offset = Heading + 90 degrees (+PI/2)
                // Mirrors the math we derived for X-North coordinate system
                const headingRad = (compassHeading * Math.PI) / 180 + Math.PI / 2;
                setHeadingOffset(headingRad);
            }
        };

        // Listen for the first reliable reading ONLY
        window.addEventListener("deviceorientation", handleOrientation, { once: true });

        return () => {
            window.removeEventListener("deviceorientation", handleOrientation);
        };
    }, []);

    // Effect 2: Camera Stream
    useEffect(() => {
        let stream: MediaStream | null = null;

        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "environment", // Rear camera
                    },
                    audio: false,
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                }
            } catch (err: any) {
                console.error("Error accessing camera:", err);
                setStreamError(err.message || "Could not access camera");
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    return (
        <div className="relative w-full h-full bg-black">
            {/* Camera Feed Background */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ zIndex: 0 }}
                playsInline
                muted
            />

            {/* Error Message */}
            {streamError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 text-white p-4 text-center">
                    <div>
                        <h3 className="text-xl font-bold mb-2">Camera Error</h3>
                        <p>{streamError}</p>
                        <p className="text-sm mt-4 text-gray-400">
                            Please ensure you have granted camera permissions.
                        </p>
                    </div>
                </div>
            )}

            {/* AR Overlay */}
            <div className="absolute inset-0 z-10">
                <Canvas
                    camera={{ position: [0, 0, 0], fov: 75, near: 0.1, far: 100000 }}
                    gl={{ alpha: true, antialias: true }} // Transparent canvas
                >
                    <MobileARContent {...props} headingOffset={headingOffset} />
                </Canvas>
            </div>

            {/* Back Button (Overlay) */}
            <div className="absolute top-4 left-4 z-50">
                {/* This is handled by the parent UI usually, but good to have a fallback if needed */}
            </div>
        </div>
    );
}
