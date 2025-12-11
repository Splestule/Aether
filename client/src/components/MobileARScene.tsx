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

function MobileARContent({
    flights,
    selectedFlight,
    onFlightSelect,
    userLocation,
}: MobileARSceneProps) {
    const { camera } = useThree();

    // Ensure camera starts looking North (Z-)
    useEffect(() => {
        camera.position.set(0, 0, 0);
    }, [camera]);

    return (
        <>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />

            {/* Device Orientation Controls - Syncs camera with phone gyroscope */}
            <DeviceOrientationControls />

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
        </>
    );
}

export function MobileARScene(props: MobileARSceneProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [streamError, setStreamError] = useState<string | null>(null);

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
                    <MobileARContent {...props} />
                </Canvas>
            </div>

            {/* Back Button (Overlay) */}
            <div className="absolute top-4 left-4 z-50">
                {/* This is handled by the parent UI usually, but good to have a fallback if needed */}
            </div>
        </div>
    );
}
