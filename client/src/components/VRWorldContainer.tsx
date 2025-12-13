import { Suspense, useEffect, useState } from "react";
import { VRCanvas, XRButton } from "@react-three/xr";
import { VRWorldScene } from "./VRWorldScene";
import { UserLocation, ProcessedFlight } from "@shared/src/types";

interface VRWorldContainerProps {
    userLocation: UserLocation;
    flights: ProcessedFlight[];
    onBack: () => void;
}

export function VRWorldContainer({ userLocation, flights: _flights, onBack }: VRWorldContainerProps) {
    const [isWebXRSupported, setIsWebXRSupported] = useState<boolean | null>(null);

    // Check for VR support
    useEffect(() => {
        if ('xr' in navigator) {
            (navigator as any).xr.isSessionSupported('immersive-vr').then((supported: boolean) => {
                setIsWebXRSupported(supported);
            });
        } else {
            setIsWebXRSupported(false);
        }
    }, []);

    const sessionInit = { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking", "layers"] };

    // Button Style (Matching VRScene)
    const standardButtonStyle = {
        position: 'absolute' as 'absolute',
        bottom: '25px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 24px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '8px',
        background: 'rgba(0,0,0,0.5)',
        color: '#fff',
        font: 'normal 13px sans-serif',
        textAlign: 'center' as 'center',
        opacity: '1',
        outline: 'none',
        zIndex: 50,
        cursor: 'pointer',
    };

    return (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "#000" }}>

            {/* Back Button (Standard overlay) */}
            <button
                onClick={onBack}
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    zIndex: 1000,
                    padding: '8px 16px',
                    background: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                Back to Cesium
            </button>

            <VRCanvas
                sessionInit={sessionInit}
                camera={{ position: [0, 1.6, 0], fov: 75, far: 1000000 }}
                gl={{
                    logarithmicDepthBuffer: true,
                    antialias: true,
                    // depth: true, // Default is true
                    // stencil: false, // Default is false
                    // alpha: false, // Default is false for VR usually
                }}
                onCreated={({ gl }) => {
                    gl.localClippingEnabled = true;
                    // gl.outputEncoding = THREE.LinearEncoding; // Three r150+ uses outputColorSpace
                    // gl.outputColorSpace = 'srgb-linear'; // Cesium uses linear workflow usually?
                    // Actually, keep default sRGB for now unless colors look off.

                    // Enable shadow map if needed, but for tiles it might be heavy
                    // gl.shadowMap.enabled = true;
                }}
            >
                <ambientLight intensity={1.0} />
                <directionalLight position={[10, 10, 5]} intensity={1.5} />

                <Suspense fallback={null}>
                    <VRWorldScene userLocation={userLocation} />
                </Suspense>
            </VRCanvas>

            {/* XR Entry Button - Only show if supported */}
            {isWebXRSupported && (
                <XRButton
                    mode="VR"
                    sessionInit={{
                        requiredFeatures: ['local-floor'],
                        optionalFeatures: ['bounded-floor', 'hand-tracking', 'layers']
                    }}
                    style={standardButtonStyle}
                >
                    Enter VR
                </XRButton>
            )}
        </div>
    );
}
