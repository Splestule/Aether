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

// VR Button Component - manual implementation with timeout detection
function VRToggleButton({
  rendererRef,
  onStatusChange,
  onError,
}: {
  rendererRef: React.RefObject<any>;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
}) {
  const [buttonText, setButtonText] = useState("Enter VR");
  const [isLoading, setIsLoading] = useState(false);
  const { isPresenting, session } = useXR();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    canvasRef.current = document.querySelector("canvas");
  }, []);

  useEffect(() => {
    setButtonText(isPresenting ? "Exit VR" : "Enter VR");
    setIsLoading(false);
    if (onStatusChange) {
      onStatusChange(isPresenting ? "VR Active" : "VR Inactive");
    }
  }, [isPresenting, onStatusChange]);

  const handleVRToggle = async () => {
    if (!canvasRef.current || !("xr" in navigator)) {
      const error = "WebXR not supported";
      if (onError) onError(error);
      if (onStatusChange) onStatusChange("Error: " + error);
      return;
    }

    if (isPresenting && session) {
      // Exit VR
      try {
        await session.end();
      } catch (err: any) {
        if (onError) onError(err?.message || "Failed to exit VR");
      }
      return;
    }

    // Enter VR with timeout
    setIsLoading(true);
    if (onStatusChange) onStatusChange("Starting VR...");

    const timeout = setTimeout(() => {
      setIsLoading(false);
      const error = "VR session timeout - taking too long to start";
      if (onError) onError(error);
      if (onStatusChange) onStatusChange("Timeout Error");
    }, 10000); // 10 second timeout

    try {
      const xr = (navigator as any).xr;
      const supported = await xr.isSessionSupported("immersive-vr");

      if (!supported) {
        clearTimeout(timeout);
        setIsLoading(false);
        const error = "VR not supported";
        if (onError) onError(error);
        if (onStatusChange) onStatusChange("Error: " + error);
        return;
      }

      const gl =
        canvasRef.current.getContext("webgl2") ||
        canvasRef.current.getContext("webgl");

      if (!gl) {
        clearTimeout(timeout);
        setIsLoading(false);
        const error = "Failed to get WebGL context";
        if (onError) onError(error);
        if (onStatusChange) onStatusChange("Error: " + error);
        return;
      }

      // Make XR compatible
      if ((gl as any).makeXRCompatible) {
        await (gl as any).makeXRCompatible();
      }

      const vrSession = await xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor", "bounded-floor"],
      });

      clearTimeout(timeout);

      // Connect session to Three.js renderer's XR manager
      const renderer = rendererRef.current;
      if (renderer && renderer.xr) {
        // Set the session on Three.js XR manager - this is the key!
        renderer.xr.setSession(vrSession);

        vrSession.addEventListener("end", () => {
          setIsLoading(false);
          if (onStatusChange) onStatusChange("VR Session Ended");
        });

        setIsLoading(false);
        if (onStatusChange) onStatusChange("VR Active");
        return;
      }

      // Fallback: update render state manually (shouldn't reach here usually)
      const layer = new (window as any).XRWebGLLayer(vrSession, gl);
      await vrSession.updateRenderState({ baseLayer: layer });

      vrSession.addEventListener("end", () => {
        setIsLoading(false);
        if (onStatusChange) onStatusChange("VR Session Ended");
      });

      setIsLoading(false);
      if (onStatusChange) onStatusChange("VR Active");
    } catch (err: any) {
      clearTimeout(timeout);
      setIsLoading(false);
      const error = err?.message || "Failed to start VR session";
      if (onError) onError(error);
      if (onStatusChange) onStatusChange("Error: " + error);
    }
  };

  return (
    <button
      onClick={handleVRToggle}
      disabled={isLoading}
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        background: isLoading
          ? "rgba(100, 100, 100, 0.8)"
          : "rgba(0, 0, 0, 0.8)",
        color: "white",
        border: "2px solid white",
        borderRadius: "8px",
        padding: "12px 24px",
        fontWeight: "bold",
        cursor: isLoading ? "wait" : "pointer",
        zIndex: 1000,
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      {isLoading ? "Loading..." : buttonText}
    </button>
  );
}

// Scene Content Component
function SceneContent({
  flights,
  selectedFlight,
  onFlightSelect,
  config,
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
  config,
}: VRSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<any>(null);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [vrStatus, setVrStatus] = useState<string>("Not checked");
  const [vrError, setVrError] = useState<string | null>(null);

  useEffect(() => {
    // Check WebGL support
    const testCanvas = document.createElement("canvas");
    const gl =
      testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");

    if (!gl) {
      setCanvasError("WebGL is not supported on this device/browser");
      return;
    }

    // Check WebXR support and update status
    const checkXRSupport = async () => {
      if ("xr" in navigator) {
        try {
          const xr = (navigator as any).xr;
          const supported = await xr.isSessionSupported("immersive-vr");
          setVrStatus(supported ? "WebXR Supported" : "WebXR Not Supported");
          if (!supported) {
            setVrError("VR mode is not supported on this device/browser");
          }
        } catch (err: any) {
          setVrStatus("WebXR Check Failed");
          setVrError(err?.message || "Unknown error checking WebXR support");
        }
      } else {
        setVrStatus("WebXR Not Available");
        setVrError("WebXR API not found in browser");
      }
    };

    checkXRSupport();
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
      {/* On-screen debug info */}
      {(vrError || vrStatus !== "Not checked") && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            left: "24px",
            background: vrError ? "rgba(255, 0, 0, 0.9)" : "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "12px",
            borderRadius: "8px",
            zIndex: 10001,
            maxWidth: "300px",
            fontSize: "12px",
            fontFamily: "monospace",
          }}
        >
          <div>VR Status: {vrStatus}</div>
          {vrError && (
            <div style={{ marginTop: "8px", color: "#ffcccc" }}>
              Error: {vrError}
            </div>
          )}
        </div>
      )}

      <VRToggleButton
        rendererRef={rendererRef}
        onStatusChange={(status) => setVrStatus(status)}
        onError={(error) => {
          setVrError(error);
          setVrStatus("VR Error");
        }}
      />

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
          dpr={Math.min(window.devicePixelRatio, 2)}
          frameloop="always"
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
            preserveDrawingBuffer: false,
          }}
          onCreated={(state) => {
            // Store renderer reference for VR session management
            rendererRef.current = state.gl;

            // Store debug info
            const hasXR = !!state.gl.xr;
            setVrStatus((prev) =>
              prev === "Not checked"
                ? hasXR
                  ? "Canvas Ready (XR Available)"
                  : "Canvas Ready (No XR)"
                : prev
            );
          }}
          onError={(error) => {
            const errorMsg = String(error);
            setCanvasError(`Canvas error: ${errorMsg}`);
            setVrError(errorMsg);
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
