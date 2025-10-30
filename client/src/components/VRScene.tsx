import { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Interactive, useXR } from "@react-three/xr";
import { OrbitControls, Sky } from "@react-three/drei";
import { UserLocation, ProcessedFlight, VRConfig } from "@shared/src/types.js";
import { ARWaypoint } from "./ARWaypoint";
import { FlightTrajectory } from "./FlightTrajectory";
import React from "react";

interface VRSceneProps {
  userLocation: UserLocation;
  flights: ProcessedFlight[];
  selectedFlight: ProcessedFlight | null;
  onFlightSelect: (flight: ProcessedFlight | null) => void;
  isVRActive: boolean;
  config: VRConfig;
}

// VR Button Component
function VRToggleButton() {
  const [isPresenting, setIsPresenting] = useState(false);

  const handleClick = async () => {
    const canvas = document.querySelector("canvas");

    if (!canvas || !("xr" in navigator)) {
      alert("WebXR not supported on this device/browser");
      return;
    }

    try {
      const xr = (navigator as any).xr;

      if (isPresenting) {
        setIsPresenting(false);
      } else {
        const supported = await xr.isSessionSupported("immersive-vr");
        if (!supported) {
          alert("VR is not supported on this device/browser");
          return;
        }

        const session = await xr.requestSession("immersive-vr", {
          optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
        });

        const gl =
          canvas.getContext("webgl2", { xrCompatible: true }) ||
          canvas.getContext("webgl", { xrCompatible: true });

        if (!gl) {
          throw new Error("Failed to get WebGL context");
        }

        await (gl as any).makeXRCompatible?.();

        await session.updateRenderState({
          baseLayer: new (window as any).XRWebGLLayer(session, gl),
        });

        setIsPresenting(true);

        session.addEventListener("end", () => {
          setIsPresenting(false);
        });
      }
    } catch (err) {
      console.error("Failed to start VR session:", err);
      alert(`VR Error: ${(err as Error).message}`);
      setIsPresenting(false);
    }
  };

  return (
    <button
      className="vr-toggle-button"
      onClick={handleClick}
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        background: "rgba(0, 0, 0, 0.8)",
        color: "white",
        border: "2px solid white",
        borderRadius: "8px",
        padding: "12px 24px",
        fontWeight: "bold",
        cursor: "pointer",
        zIndex: 1000,
      }}
    >
      {isPresenting ? "Exit VR" : "Enter VR"}
    </button>
  );
}

// Scene Content Component
function SceneContent({
  flights,
  selectedFlight,
  onFlightSelect,
  config,
  userLocation,
}: Omit<VRSceneProps, "isVRActive">) {
  const { isPresenting } = useXR();

  const filteredFlights = flights.filter(
    (flight) => flight.distance <= config.maxDistance
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[0, 5, 0]} intensity={0.5} />

      {/* Environment - Sky */}
      <Sky
        distance={450000}
        sunPosition={[0, 1, 0]}
        inclination={0.49}
        azimuth={0.25}
      />

      {/* Flight objects */}
      {filteredFlights.map((flight) => (
        <React.Fragment key={flight.id}>
          <Interactive onSelect={() => onFlightSelect(flight)}>
            <ARWaypoint
              flight={flight}
              isSelected={selectedFlight?.id === flight.id}
              onClick={() => onFlightSelect(flight)}
            />
          </Interactive>
          {config.enableTrajectories && <FlightTrajectory flight={flight} />}
        </React.Fragment>
      ))}

      {/* Controls - only enabled when not in VR */}
      {!isPresenting && (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableRotate={true}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          target={[0, 0, 0]}
          enableDamping={true}
          dampingFactor={0.05}
          rotateSpeed={0.5}
        />
      )}
    </>
  );
}

export function VRScene({
  userLocation,
  flights,
  selectedFlight,
  onFlightSelect,
  isVRActive,
  config,
}: VRSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    // Check WebGL support
    const testCanvas = document.createElement("canvas");
    const gl =
      testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");

    if (!gl) {
      setCanvasError("WebGL is not supported on this device/browser");
      return;
    }

    setCanvasReady(true);
  }, []);

  if (canvasError) {
    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(255, 0, 0, 0.9)",
          color: "white",
          padding: "20px",
          borderRadius: "8px",
          textAlign: "center",
          zIndex: 10000,
          maxWidth: "400px",
        }}
      >
        <h2>❌ Cannot Load 3D Scene</h2>
        <p>{canvasError}</p>
        <p style={{ fontSize: "12px", marginTop: "10px" }}>
          Your browser or device doesn't support WebGL.
          <br />
          Try updating your browser or enabling hardware acceleration.
        </p>
      </div>
    );
  }

  if (!canvasReady) {
    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(0, 0, 0, 0.8)",
          color: "white",
          padding: "20px",
          borderRadius: "8px",
          textAlign: "center",
        }}
      >
        <h2>⏳ Initializing 3D Scene...</h2>
      </div>
    );
  }

  return (
    <>
      <VRToggleButton />

      <div
        className="vr-canvas"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "linear-gradient(to bottom, #1a1a2e 0%, #16213e 100%)",
        }}
      >
        <Canvas
          ref={canvasRef}
          camera={{
            position: [0, 1.6, 0],
            fov: 75,
            near: 0.1,
            far: 1000,
          }}
          dpr={window.devicePixelRatio}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          onError={(error) => {
            console.error("Canvas error:", error);
            setCanvasError(`Canvas error: ${error}`);
          }}
        >
          <SceneContent
            userLocation={userLocation}
            flights={flights}
            selectedFlight={selectedFlight}
            onFlightSelect={onFlightSelect}
            config={config}
          />
        </Canvas>
      </div>
    </>
  );
}
