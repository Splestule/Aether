import { Suspense, useRef, useEffect, useState } from "react";
import {
  Interactive,
  useXR,
  ARCanvas,
  useController,
} from "@react-three/xr";
import { OrbitControls, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Vector3,
  Euler,
  Quaternion,
  BackSide,
  Raycaster,
  Line,
  BufferGeometry,
  LineBasicMaterial,
  BufferAttribute,
} from "three";
import { UserLocation, ProcessedFlight, VRConfig } from "@shared/src/types.js";
import { ARWaypoint } from "./ARWaypoint";
import { FlightTrajectory } from "./FlightTrajectory";
import { VRCompass } from "./VRCompass";
import {
  formatSpeed,
  formatAltitude,
  formatDistance,
} from "@shared/src/utils.js";
import React from "react";

interface VRSceneProps {
  userLocation: UserLocation;
  flights: ProcessedFlight[];
  selectedFlight: ProcessedFlight | null;
  onFlightSelect: (flight: ProcessedFlight | null) => void;
  config: VRConfig;
  heightCoefficient: number;
  distanceCoefficient: number;
  onHeightCoefficientChange: (value: number) => void;
  onDistanceCoefficientChange: (value: number) => void;
  onSaveDefaults: () => void;
}

// VR Flight Info Panel - 3D panel attached to left controller
function VRFlightInfoPanel({
  flight,
  onClose,
}: {
  flight: ProcessedFlight;
  onClose: () => void;
}) {
  const leftController = useController("left");
  const panelRef = useRef<any>(null);

  const formatHeading = (heading: number): string => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(heading / 45) % 8;
    return `${heading.toFixed(0)}° ${directions[index]}`;
  };

  const formatLastUpdate = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  // Attach panel to left controller
  useFrame(() => {
    if (panelRef.current && leftController) {
      // Get controller position and rotation
      const controller = leftController.controller;
      panelRef.current.position.copy(controller.position);
      panelRef.current.quaternion.copy(controller.quaternion);

      // Apply additional tilt backward (rotate around X axis) for better reading angle
      const tiltBackRotation = new Euler(-Math.PI / 6, 0, 0); // -30 degrees around X axis
      const tiltQuaternion = new Quaternion().setFromEuler(tiltBackRotation);
      panelRef.current.quaternion.multiply(tiltQuaternion);

      // Offset panel relative to controller (in front and slightly up, in controller's local space)
      // Convert local offset to world space
      const localOffset = new Vector3(0.08, 0.1, 0.12);
      localOffset.applyQuaternion(controller.quaternion);
      panelRef.current.position.add(localOffset);
    }
  });

  // Scale factor to make panel smaller (1.8x smaller than previous 0.4)
  const scale = 0.4 / 1.8;
  const baseWidth = 1.2;
  const baseHeight = 1.6;

  if (!leftController) return null;

  return (
    <group ref={panelRef}>
      <group scale={[scale, scale, scale]}>
        {/* Background panel */}
        <mesh>
          <planeGeometry args={[baseWidth, baseHeight]} />
          <meshBasicMaterial color="#1a1a1a" opacity={0.95} transparent />
        </mesh>

        {/* Border frame */}
        {/* Top border */}
        <mesh position={[0, baseHeight / 2, -0.001]}>
          <planeGeometry args={[baseWidth + 0.02, 0.02]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Bottom border */}
        <mesh position={[0, -baseHeight / 2, -0.001]}>
          <planeGeometry args={[baseWidth + 0.02, 0.02]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Left border */}
        <mesh position={[-baseWidth / 2 - 0.01, 0, -0.001]}>
          <planeGeometry args={[0.02, baseHeight + 0.02]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Right border */}
        <mesh position={[baseWidth / 2 + 0.01, 0, -0.001]}>
          <planeGeometry args={[0.02, baseHeight + 0.02]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Title */}
        <Text
          position={[0, baseHeight / 2 - 0.05, 0.01]}
          fontSize={0.08}
          color="#ffffff"
          anchorX="center"
          anchorY="top"
          maxWidth={baseWidth - 0.1}
          fontWeight="bold"
        >
          Flight Details
        </Text>

        {/* Close button */}
        <Interactive onSelect={onClose}>
          <mesh position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.05, 0.01]}>
            <planeGeometry args={[0.08, 0.08]} />
            <meshBasicMaterial color="#ffffff" opacity={0.8} transparent />
          </mesh>
          <Text
            position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.05, 0.02]}
            fontSize={0.06}
            color="#000000"
            anchorX="center"
            anchorY="middle"
          >
            ×
          </Text>
        </Interactive>

        {/* Callsign */}
        <Text
          position={[0, baseHeight / 2 - 0.15, 0.01]}
          fontSize={0.06}
          color="#ffffff"
          anchorX="center"
          anchorY="top"
          maxWidth={baseWidth - 0.1}
          fontWeight="bold"
        >
          {flight.callsign}
        </Text>

        {/* Airline */}
        <Text
          position={[0, baseHeight / 2 - 0.23, 0.01]}
          fontSize={0.04}
          color="#a0a0a0"
          anchorX="center"
          anchorY="top"
          maxWidth={baseWidth - 0.1}
        >
          {flight.airline}
        </Text>

        {/* ICAO */}
        <Text
          position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.31, 0.01]}
          fontSize={0.035}
          color="#a0a0a0"
          anchorX="left"
          anchorY="top"
        >
          ICAO:
        </Text>
        <Text
          position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.31, 0.01]}
          fontSize={0.035}
          color="#ffffff"
          anchorX="right"
          anchorY="top"
        >
          {flight.icao24}
        </Text>

        {/* Position */}
        <Text
          position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.39, 0.01]}
          fontSize={0.035}
          color="#a0a0a0"
          anchorX="left"
          anchorY="top"
        >
          Position:
        </Text>
        <Text
          position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.39, 0.01]}
          fontSize={0.03}
          color="#ffffff"
          anchorX="right"
          anchorY="top"
        >
          {flight.gps.latitude.toFixed(3)}, {flight.gps.longitude.toFixed(3)}
        </Text>

        {/* Altitude */}
        <Text
          position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.47, 0.01]}
          fontSize={0.035}
          color="#a0a0a0"
          anchorX="left"
          anchorY="top"
        >
          Altitude:
        </Text>
        <Text
          position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.47, 0.01]}
          fontSize={0.035}
          color="#ffffff"
          anchorX="right"
          anchorY="top"
        >
          {formatAltitude(flight.gps.altitude)}
        </Text>

        {/* Speed */}
        <Text
          position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.55, 0.01]}
          fontSize={0.035}
          color="#a0a0a0"
          anchorX="left"
          anchorY="top"
        >
          Speed:
        </Text>
        <Text
          position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.55, 0.01]}
          fontSize={0.035}
          color="#ffffff"
          anchorX="right"
          anchorY="top"
        >
          {formatSpeed(flight.velocity)}
        </Text>

        {/* Heading */}
        <Text
          position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.63, 0.01]}
          fontSize={0.035}
          color="#a0a0a0"
          anchorX="left"
          anchorY="top"
        >
          Heading:
        </Text>
        <Text
          position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.63, 0.01]}
          fontSize={0.035}
          color="#ffffff"
          anchorX="right"
          anchorY="top"
        >
          {formatHeading(flight.heading)}
        </Text>

        {/* Distance */}
        <Text
          position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.71, 0.01]}
          fontSize={0.035}
          color="#a0a0a0"
          anchorX="left"
          anchorY="top"
        >
          Distance:
        </Text>
        <Text
          position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.71, 0.01]}
          fontSize={0.035}
          color="#ffffff"
          anchorX="right"
          anchorY="top"
        >
          {formatDistance(flight.distance)}
        </Text>

        {/* Elevation */}
        <Text
          position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.79, 0.01]}
          fontSize={0.035}
          color="#a0a0a0"
          anchorX="left"
          anchorY="top"
        >
          Elevation:
        </Text>
        <Text
          position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.79, 0.01]}
          fontSize={0.035}
          color="#ffffff"
          anchorX="right"
          anchorY="top"
        >
          {flight.elevation.toFixed(1)}°
        </Text>

        {/* Status */}
        <Text
          position={[-baseWidth / 2 + 0.05, baseHeight / 2 - 0.87, 0.01]}
          fontSize={0.035}
          color="#a0a0a0"
          anchorX="left"
          anchorY="top"
        >
          Status:
        </Text>
        <Text
          position={[baseWidth / 2 - 0.05, baseHeight / 2 - 0.87, 0.01]}
          fontSize={0.035}
          color={flight.onGround ? "#808080" : "#c6a0e8"}
          anchorX="right"
          anchorY="top"
        >
          {flight.onGround ? "On Ground" : "In Flight"}
        </Text>

        {/* Last Update */}
        <Text
          position={[0, -baseHeight / 2 + 0.1, 0.01]}
          fontSize={0.03}
          color="#808080"
          anchorX="center"
          anchorY="top"
        >
          Updated {formatLastUpdate(flight.lastUpdate)}
        </Text>
      </group>
    </group>
  );
}

// Scene Content Component
// Component to extend raycast distance for VR interactions
function ExtendedRaycastManager() {
  const { raycaster } = useThree();

  useEffect(() => {
    // Extend raycaster far distance to 250km for selecting distant planes
    // The InteractionManager in @react-three/xr uses this raycaster, so extending it
    // will make VR controller raycasts reach up to 250km
    if (raycaster) {
      raycaster.far = 250000; // 250 km in meters
      raycaster.near = 0.1;
    }
  }, [raycaster]);

  // Keep updating in case it gets reset
  useFrame(() => {
    if (raycaster && raycaster.far < 250000) {
      raycaster.far = 250000;
    }
  });

  return null;
}

// Component to hide VR controllers visually (they still work for input)
function HideControllers() {
  const { controllers } = useXR();
  const { scene } = useThree();

  // Hide controllers immediately when they're created
  useEffect(() => {
    const hideControllerObjects = () => {
      controllers.forEach((controller) => {
        if (controller.controller) {
          controller.controller.traverse((child: any) => {
            if (child.isMesh || child.isGroup || child.isLine || child.isPoints) {
              child.visible = false;
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat: any) => {
                    if (mat) {
                      mat.transparent = true;
                      mat.opacity = 0;
                    }
                  });
                } else if (child.material) {
                  child.material.transparent = true;
                  child.material.opacity = 0;
                }
              }
            }
          });
        }
      });

      // Also search the scene
      scene.traverse((child: any) => {
        const isControllerRelated =
          (child.userData &&
            (child.userData.controller ||
              child.userData.hand ||
              child.userData.xrController)) ||
          child.name?.toLowerCase().includes("controller") ||
          child.name?.toLowerCase().includes("hand") ||
          child.name?.toLowerCase().includes("xr");

        if (isControllerRelated) {
          if (child.isMesh || child.isGroup || child.isLine || child.isPoints) {
            child.visible = false;
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: any) => {
                  if (mat) {
                    mat.transparent = true;
                    mat.opacity = 0;
                  }
                });
              } else if (child.material) {
                child.material.transparent = true;
                child.material.opacity = 0;
              }
            }
          }
        }
      });
    };

    hideControllerObjects();
    // Also run periodically in case controllers are added later
    const interval = setInterval(hideControllerObjects, 100);
    return () => clearInterval(interval);
  }, [controllers, scene]);

  useFrame(() => {
    // Hide all controller meshes in the scene
    controllers.forEach((controller) => {
      if (controller.controller) {
        // Traverse the controller object and hide all meshes and groups
        controller.controller.traverse((child: any) => {
          if (child.isMesh || child.isGroup || child.isLine || child.isPoints) {
            child.visible = false;
            // Also try to make materials transparent
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: any) => {
                  if (mat) {
                    mat.transparent = true;
                    mat.opacity = 0;
                    mat.visible = false;
                  }
                });
              } else if (child.material) {
                child.material.transparent = true;
                child.material.opacity = 0;
                child.material.visible = false;
              }
            }
          }
        });
      }
    });

    // Also search the scene for any controller-related objects
    scene.traverse((child: any) => {
      // Hide objects that look like controllers (common patterns in react-three/xr)
      const isControllerRelated =
        (child.userData &&
          (child.userData.controller ||
            child.userData.hand ||
            child.userData.xrController)) ||
        child.name?.toLowerCase().includes("controller") ||
        child.name?.toLowerCase().includes("hand") ||
        child.name?.toLowerCase().includes("xr");

      if (isControllerRelated) {
        if (child.isMesh || child.isGroup || child.isLine || child.isPoints) {
          child.visible = false;
          // Also try to make materials transparent
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => {
                if (mat) {
                  mat.transparent = true;
                  mat.opacity = 0;
                  mat.visible = false;
                }
              });
            } else if (child.material) {
              child.material.transparent = true;
              child.material.opacity = 0;
              child.material.visible = false;
            }
          }
        }
      }
    });
  });

  return null;
}

// Visible raycast line from VR controller (for a single controller)
function SingleControllerRaycast({
  controller,
  flights,
}: {
  controller: any;
  flights: ProcessedFlight[];
}) {
  const geometryRef = useRef(new BufferGeometry());
  const materialRef = useRef(
    new LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
    })
  );
  const lineRef = useRef(new Line(geometryRef.current, materialRef.current));
  const raycaster = useRef(new Raycaster());

  useFrame(() => {
    if (
      !lineRef.current ||
      !geometryRef.current ||
      !materialRef.current ||
      !controller
    ) {
      if (lineRef.current) {
        lineRef.current.visible = false;
      }
      return;
    }

    const controllerObject = controller.controller;
    if (!controllerObject) {
      lineRef.current.visible = false;
      return;
    }

    const controllerPosition = new Vector3();
    const controllerDirection = new Vector3();

    controllerObject.getWorldPosition(controllerPosition);
    controllerObject.getWorldDirection(controllerDirection);
    controllerDirection.normalize();
    controllerDirection.multiplyScalar(-1);

    // Offset start point slightly forward to avoid intersecting controller-attached UI (compass, etc.)
    const rayOrigin = controllerPosition.clone().add(controllerDirection.clone().multiplyScalar(0.02));

    // Set up raycaster
    raycaster.current.set(rayOrigin, controllerDirection);
    raycaster.current.far = 250000; // 250km

    // Check for intersections with waypoint collision meshes
    const waypointMeshes: any[] = [];
    flights.forEach((flight) => {
      // Calculate collision sphere size (matching ARWaypoint calculation)
      const distanceFromUser = Math.sqrt(
        flight.position.x * flight.position.x +
          flight.position.y * flight.position.y +
          flight.position.z * flight.position.z
      );
      const distanceKm = distanceFromUser / 1000;
      const baseSize = 50;
      const distanceMultiplier = Math.max(1, Math.sqrt(distanceKm / 5));
      const altitudeMultiplier = Math.max(
        1,
        Math.sqrt(Math.abs(flight.position.y) / 2000)
      );
      const sphereSize = baseSize * distanceMultiplier * altitudeMultiplier;

      // Check if ray passes close enough to the waypoint (within collision sphere radius * 3)
      const waypointPos = new Vector3(
        flight.position.x,
        flight.position.y,
        flight.position.z
      );
      const waypointToController = rayOrigin.clone().sub(waypointPos);
      const t =
        -waypointToController.dot(controllerDirection) /
        controllerDirection.dot(controllerDirection);

      if (t > 0 && t <= 250000) {
        const closestPoint = rayOrigin
          .clone()
          .add(controllerDirection.clone().multiplyScalar(t));
        const distanceToWaypoint = closestPoint.distanceTo(waypointPos);

        if (distanceToWaypoint <= sphereSize * 3) {
          waypointMeshes.push({ flight, distance: t });
        }
      }
    });

    // Find closest intersection
    const closestIntersection = waypointMeshes.sort(
      (a, b) => a.distance - b.distance
    )[0];
    const hasHit = !!closestIntersection;

    // Calculate line end point
    const maxDistance = 250000; // 250km
    const hitDistance = closestIntersection
      ? closestIntersection.distance
      : maxDistance;
    const endPoint = rayOrigin
      .clone()
      .add(controllerDirection.clone().multiplyScalar(hitDistance));

    // Update line geometry
    const positions = new Float32Array([
      rayOrigin.x,
      rayOrigin.y,
      rayOrigin.z,
      endPoint.x,
      endPoint.y,
      endPoint.z,
    ]);
    geometryRef.current.setAttribute(
      "position",
      new BufferAttribute(positions, 3)
    );
    geometryRef.current.setDrawRange(0, 2);

    // Update line visibility and color
    lineRef.current.visible = true;
    const color = hasHit ? 0x00ff00 : 0xffffff;
    materialRef.current.color.setHex(color);
  });

  return <primitive ref={lineRef} object={lineRef.current} />;
}

// Visible raycast line from all VR controllers
function VRRaycastLine({ flights }: { flights: ProcessedFlight[] }) {
  const { controllers } = useXR();

  if (controllers.length === 0) {
    return null;
  }

  return (
    <>
      {controllers.map((controller, index) => (
        <SingleControllerRaycast
          key={index}
          controller={controller}
          flights={flights}
        />
      ))}
    </>
  );
}

// Button coefficient adjuster - reads button input to adjust coefficients
// Left controller: X = decrease height, Y = increase height
// Right controller: A = decrease distance, B = increase distance
// Right controller trigger = save current coefficients as defaults
function JoystickCoefficientAdjuster({
  heightCoefficient,
  distanceCoefficient,
  onHeightCoefficientChange,
  onDistanceCoefficientChange,
  onSaveDefaults,
}: {
  heightCoefficient: number;
  distanceCoefficient: number;
  onHeightCoefficientChange: (value: number) => void;
  onDistanceCoefficientChange: (value: number) => void;
  onSaveDefaults: () => void;
}) {
  const { controllers, session } = useXR();
  const leftController = useController("left");
  const rightController = useController("right");
  const heightCoeffRef = useRef(heightCoefficient);
  const distanceCoeffRef = useRef(distanceCoefficient);
  const debugLoggedRef = useRef(false);
  const frameCountRef = useRef(0);
  const rightTriggerPressedRef = useRef(false);

  // Update refs when props change
  useEffect(() => {
    heightCoeffRef.current = heightCoefficient;
    distanceCoeffRef.current = distanceCoefficient;
  }, [heightCoefficient, distanceCoefficient]);

  useFrame((_state, _delta, xrFrame) => {
    frameCountRef.current++;
    
    // Try multiple methods to access gamepad input
    
    // Method 1: Through useController hook
    let leftGamepad = leftController?.inputSource?.gamepad;
    let rightGamepad = rightController?.inputSource?.gamepad;
    
    // Method 2: Through XR frame's input sources (if available)
    if (xrFrame && session) {
      const inputSources = session.inputSources;
      if (inputSources && inputSources.length > 0) {
        for (const inputSource of inputSources) {
          if (inputSource.handedness === 'left' && !leftGamepad) {
            leftGamepad = inputSource.gamepad;
          }
          if (inputSource.handedness === 'right' && !rightGamepad) {
            rightGamepad = inputSource.gamepad;
          }
        }
      }
    }
    
    // Method 3: Through controllers array from useXR
    if (!leftGamepad || !rightGamepad) {
      for (const controller of controllers) {
        const inputSource = controller.inputSource;
        if (inputSource?.handedness === 'left' && !leftGamepad) {
          leftGamepad = inputSource.gamepad;
        }
        if (inputSource?.handedness === 'right' && !rightGamepad) {
          rightGamepad = inputSource.gamepad;
        }
      }
    }
    
    // Debug logging (once at frame 60)
    if (frameCountRef.current === 60 && !debugLoggedRef.current) {
      console.log('Button Debug Info:', {
        hasSession: !!session,
        hasXRFrame: !!xrFrame,
        controllersCount: controllers.length,
        leftController: !!leftController,
        rightController: !!rightController,
        leftGamepad: leftGamepad ? {
          id: leftGamepad.id,
          connected: leftGamepad.connected,
          buttonsLength: leftGamepad.buttons?.length,
          buttons: leftGamepad.buttons ? Array.from(leftGamepad.buttons).map((btn, idx) => ({
            index: idx,
            pressed: btn.pressed,
            touched: btn.touched,
            value: btn.value
          })) : []
        } : null,
        rightGamepad: rightGamepad ? {
          id: rightGamepad.id,
          connected: rightGamepad.connected,
          buttonsLength: rightGamepad.buttons?.length,
          buttons: rightGamepad.buttons ? Array.from(rightGamepad.buttons).map((btn, idx) => ({
            index: idx,
            pressed: btn.pressed,
            touched: btn.touched,
            value: btn.value
          })) : []
        } : null
      });
      debugLoggedRef.current = true;
    }

    // Quest controller button mapping:
    // Left: X = button 4, Y = button 5
    // Right: A = button 4, B = button 5
    // But we'll check all buttons and identify by index
    
    // Left controller: X (decrease height) and Y (increase height)
    if (leftGamepad && leftGamepad.connected && leftGamepad.buttons) {
      const buttons = leftGamepad.buttons;
      
      // Button 4 = X (decrease height)
      if (buttons[4] && buttons[4].pressed) {
        // Continuous adjustment while button is held
        const newValue = Math.max(0.1, heightCoeffRef.current - 0.01);
        if (Math.abs(newValue - heightCoeffRef.current) > 0.001) {
          heightCoeffRef.current = newValue;
          onHeightCoefficientChange(newValue);
        }
      }
      
      // Button 5 = Y (increase height)
      if (buttons[5] && buttons[5].pressed) {
        // Continuous adjustment while button is held
        const newValue = Math.min(2.0, heightCoeffRef.current + 0.01);
        if (Math.abs(newValue - heightCoeffRef.current) > 0.001) {
          heightCoeffRef.current = newValue;
          onHeightCoefficientChange(newValue);
        }
      }
    }

    // Right controller: A (decrease distance) and B (increase distance)
    if (rightGamepad && rightGamepad.connected && rightGamepad.buttons) {
      const buttons = rightGamepad.buttons;
      
      // Button 0 = Trigger (save defaults)
      if (buttons[0] && buttons[0].pressed) {
        // Only trigger once when button is first pressed
        if (!rightTriggerPressedRef.current) {
          rightTriggerPressedRef.current = true;
          onSaveDefaults();
          console.log('Right trigger pressed - Coefficients saved as defaults');
        }
      } else {
        rightTriggerPressedRef.current = false;
      }
      
      // Button 4 = A (decrease distance)
      if (buttons[4] && buttons[4].pressed) {
        // Continuous adjustment while button is held
        const newValue = Math.max(0.1, distanceCoeffRef.current - 0.01);
        if (Math.abs(newValue - distanceCoeffRef.current) > 0.001) {
          distanceCoeffRef.current = newValue;
          onDistanceCoefficientChange(newValue);
        }
      }
      
      // Button 5 = B (increase distance)
      if (buttons[5] && buttons[5].pressed) {
        // Continuous adjustment while button is held
        const newValue = Math.min(2.0, distanceCoeffRef.current + 0.01);
        if (Math.abs(newValue - distanceCoeffRef.current) > 0.001) {
          distanceCoeffRef.current = newValue;
          onDistanceCoefficientChange(newValue);
        }
      }
    }
  });

  return null;
}

function SceneContent({
  userLocation,
  flights,
  selectedFlight,
  onFlightSelect,
  config,
  heightCoefficient,
  distanceCoefficient,
  onHeightCoefficientChange,
  onDistanceCoefficientChange,
  onSaveDefaults,
}: VRSceneProps) {
  const { isPresenting } = useXR();
  const [sceneRotation, setSceneRotation] = useState(0);

  const filteredFlights = flights.filter(
    (flight) => flight.distance <= config.maxDistance
  );

  const handleCompassRotation = (rotationDelta: number) => {
    // Accumulate rotation delta into scene rotation
    setSceneRotation((prev) => prev + rotationDelta);
  };

  return (
    <>
      {/* Extend raycast distance for VR interactions */}
      <ExtendedRaycastManager />

      {/* Enhanced lighting for AR - brighter and more visible */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[100, 100, 50]} intensity={1.5} castShadow />
      <hemisphereLight color="#ffffff" groundColor="#888888" intensity={0.8} />
      <directionalLight position={[-50, 50, -50]} intensity={0.8} />

      {/* VR Controllers - hidden to avoid blocking UI (input still works) */}
      {/* {isPresenting && <DefaultXRControllers />} */}
      {isPresenting && <HideControllers />}

      {/* VR Compass - attached to left controller, controls scene rotation */}
      {isPresenting && (
        <VRCompass
          onRotationChange={handleCompassRotation}
          selectedFlight={selectedFlight}
          sceneRotation={sceneRotation}
        />
      )}

      {/* Visible raycast line from controller */}
      {isPresenting && <VRRaycastLine flights={filteredFlights} />}

      {/* Joystick coefficient adjuster - only active in VR */}
      {isPresenting && (
        <JoystickCoefficientAdjuster
          heightCoefficient={heightCoefficient}
          distanceCoefficient={distanceCoefficient}
          onHeightCoefficientChange={onHeightCoefficientChange}
          onDistanceCoefficientChange={onDistanceCoefficientChange}
          onSaveDefaults={onSaveDefaults}
        />
      )}

      {/* Dark background sphere for PC mode - replaces Sky */}
      {!isPresenting && (
        <mesh>
          <sphereGeometry args={[500000, 32, 16]} />
          <meshBasicMaterial color="#0a0a0f" side={BackSide} />
        </mesh>
      )}

      {/* Scene rotation wrapper - rotates all flight content based on compass rotation */}
      <group rotation={[0, sceneRotation, 0]}>
        {/* Flight trajectory - show for selected flight */}
        {selectedFlight && (
          <FlightTrajectory
            flight={selectedFlight}
            userLocation={userLocation}
            isVR={isPresenting}
          />
        )}

        {/* Compass heading tracker - updates the compass display */}
        <CompassHeading />

        {/* Flight objects - make them interactive in VR and desktop */}
        {filteredFlights.map((flight) => {
          const handleSelect = () => {
            console.log("Flight selected:", flight.callsign);
            // Toggle selection - click same flight to deselect
            if (selectedFlight?.id === flight.id) {
              onFlightSelect(null);
            } else {
              onFlightSelect(flight);
            }
          };

          return (
            <React.Fragment key={flight.id}>
              {/* Render waypoint - Interactive wraps individual meshes in VR mode */}
              <ARWaypoint
                flight={flight}
                isSelected={selectedFlight?.id === flight.id}
                onClick={handleSelect}
                isVR={isPresenting}
              />
              {/* Trajectories disabled - they often disconnect from planes */}
              {/* {config.enableTrajectories && <FlightTrajectory flight={flight} />} */}
            </React.Fragment>
          );
        })}
      </group>

      {/* VR Info Panel - 3D panel visible in VR mode (not rotated with scene) */}
      {isPresenting && selectedFlight && (
        <VRFlightInfoPanel
          flight={selectedFlight}
          onClose={() => onFlightSelect(null)}
        />
      )}

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
  heightCoefficient,
  distanceCoefficient,
  onHeightCoefficientChange,
  onDistanceCoefficientChange,
  onSaveDefaults,
}: VRSceneProps) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "linear-gradient(to bottom, #1a1a2e 0%, #16213e 100%)",
        }}
      >
        <ARCanvas
          camera={{
            position: [0, 1.6, 0],
            fov: 75,
            near: 0.1,
            far: 250000, // 250 km to see planes up to 200 km away
          }}
          gl={{
            alpha: false,
            antialias: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            // Set dark background color for PC mode
            gl.setClearColor(0x0a0a0f, 1);
          }}
          sessionInit={{
            requiredFeatures: ["local-floor"],
            optionalFeatures: ["bounded-floor", "hand-tracking"],
          }}
        >
          <Suspense fallback={null}>
            <SceneContent
              userLocation={userLocation}
              flights={flights}
              selectedFlight={selectedFlight}
              onFlightSelect={onFlightSelect}
              config={config}
              heightCoefficient={heightCoefficient}
              distanceCoefficient={distanceCoefficient}
              onHeightCoefficientChange={onHeightCoefficientChange}
              onDistanceCoefficientChange={onDistanceCoefficientChange}
              onSaveDefaults={onSaveDefaults}
            />
          </Suspense>
        </ARCanvas>
        <div
          className="absolute top-2 right-4 sm:top-6 sm:right-6 pointer-events-none z-[4]"
        >
          <div className="vr-panel flex items-center gap-3 sm:gap-5 px-3 py-2 sm:px-5 sm:py-4">
            <img
              src="/aether-logo.png"
              alt="Aether logo"
              className="h-8 w-8 sm:h-[58px] sm:w-[58px] object-contain"
              style={{
                filter: "drop-shadow(0 18px 32px rgba(56, 189, 248, 0.32))",
              }}
              draggable={false}
            />
            <span
              className="hidden sm:inline-block"
              style={{
                fontFamily: '"Unbounded", "Stack Sans Notch", "Gabarito", sans-serif',
                fontSize: "1.75rem",
                letterSpacing: "0.12em",
                textTransform: "none",
                color: "#ffffff",
                textShadow: "0 8px 24px rgba(15, 23, 42, 0.85)",
                lineHeight: 1,
              }}
            >
              Aether
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// Compass component that reads camera direction from SceneContent
function CompassHeading() {
  const { camera } = useThree();

  useFrame(() => {
    // Get camera's forward direction in world space
    const forward = new Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);

    // Project forward vector onto horizontal plane (ignore Y component)
    const forwardHorizontal = new Vector3(forward.x, 0, forward.z).normalize();

    // Calculate heading angle from North
    // In our coordinate system after swap: X = North-South, Z = East-West
    // X+ = North (cos gives North), Z+ = East (sin gives East)
    const angle = Math.atan2(forwardHorizontal.z, forwardHorizontal.x);
    const degrees = (angle * (180 / Math.PI) + 360) % 360;

    // Convert to compass direction
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(degrees / 45) % 8;
    const direction = directions[index];

    // Update the compass display element
    const compassEl = document.getElementById("compass-display");
    if (compassEl) {
      compassEl.textContent = direction;
    }
  });

  return null;
}
