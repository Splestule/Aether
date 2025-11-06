import { useRef, useState } from "react";
import { useController } from "@react-three/xr";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Vector3, Euler, Group } from "three";

interface VRCompassProps {
  onRotationChange: (rotationY: number) => void;
  selectedFlight: any; // null when no flight selected
  sceneRotation: number; // Current scene rotation offset
}

export function VRCompass({
  onRotationChange,
  selectedFlight,
  sceneRotation,
}: VRCompassProps) {
  const leftController = useController("left");
  const compassRef = useRef<Group>(null);
  const [isGrabbed, setIsGrabbed] = useState(false);
  const initialControllerRotationRef = useRef<number | null>(null);
  const initialAccumulatedRotationRef = useRef<number>(0);

  useFrame((state) => {
    // Hide compass when a flight is selected or no controller
    if (
      selectedFlight ||
      !leftController ||
      !leftController.controller ||
      !compassRef.current
    ) {
      return;
    }

    try {
      const controller = leftController.controller;

      // Ensure sceneRotation is a valid number
      const safeSceneRotation =
        typeof sceneRotation === "number" && !isNaN(sceneRotation)
          ? sceneRotation
          : 0;

      // Position compass directly on the controller (centered on controller)
      compassRef.current.position.copy(controller.position);

      // Small offset to position it on top of controller (in controller's local space)
      const localOffset = new Vector3(0, 0.02, 0); // Small upward offset
      localOffset.applyQuaternion(controller.quaternion);
      compassRef.current.position.add(localOffset);

      // Keep compass aligned with world - always horizontal (water-leveled)
      // Reset to identity first, then apply scene rotation so compass rotates with scene
      compassRef.current.quaternion.identity();
      compassRef.current.rotation.y = safeSceneRotation;

      // Check if controller trigger or grip button is pressed (for grabbing)
      const inputSource = leftController?.inputSource;
      const isButtonPressed =
        inputSource?.gamepad?.buttons?.[0]?.pressed === true || // Trigger
        inputSource?.gamepad?.buttons?.[1]?.pressed === true; // Grip

      // Handle rotation when grabbed (for calibration)
      if (isButtonPressed) {
        // Get controller's Y-axis rotation (around vertical axis)
        const controllerEuler = new Euler().setFromQuaternion(
          controller.quaternion
        );
        const controllerYRotation = controllerEuler.y;

        if (initialControllerRotationRef.current === null) {
          // First frame of grab - store initial controller rotation and current scene rotation
          initialControllerRotationRef.current = controllerYRotation;
          initialAccumulatedRotationRef.current = safeSceneRotation;
          setIsGrabbed(true);
        } else {
          // Calculate rotation delta from initial grab position
          let rotationDelta =
            controllerYRotation - initialControllerRotationRef.current;

          // Normalize rotation delta to [-PI, PI] range
          while (rotationDelta > Math.PI) rotationDelta -= 2 * Math.PI;
          while (rotationDelta < -Math.PI) rotationDelta += 2 * Math.PI;

          // New accumulated rotation = initial scene rotation + rotation delta
          const newAccumulated =
            initialAccumulatedRotationRef.current + rotationDelta;

          // Calculate incremental change since last frame
          const incrementalDelta = newAccumulated - safeSceneRotation;

          // Normalize incremental delta to [-PI, PI]
          let normalizedDelta = incrementalDelta;
          while (normalizedDelta > Math.PI) normalizedDelta -= 2 * Math.PI;
          while (normalizedDelta < -Math.PI) normalizedDelta += 2 * Math.PI;

          // Notify parent of incremental rotation change (scene will rotate)
          if (Math.abs(normalizedDelta) > 0.001) {
            onRotationChange(normalizedDelta);
          }
        }
      } else {
        // Reset tracking when not grabbed (but keep accumulated rotation)
        if (initialControllerRotationRef.current !== null) {
          initialControllerRotationRef.current = null;
          setIsGrabbed(false);
        }
      }
    } catch (error) {
      // Silently handle any errors to prevent crashes
      console.warn("VRCompass error:", error);
    }
  });

  // Hide compass when a flight is selected or no controller
  if (selectedFlight || !leftController) return null;

  const compassRadius = 0.06;

  return (
    <group ref={compassRef}>
      {/* Compass base (flat disc) - horizontal plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[compassRadius * 0.85, compassRadius, 32]} />
        <meshStandardMaterial
          color="#1a1a1a"
          metalness={0.7}
          roughness={0.3}
          side={2}
        />
      </mesh>

      {/* Center disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[compassRadius * 0.85, 32]} />
        <meshStandardMaterial
          color="#0a0a0a"
          metalness={0.7}
          roughness={0.3}
          side={2}
        />
      </mesh>

      {/* N label - fixed, pointing to world North (X+ direction), oriented outward from center */}
      <Text
        position={[compassRadius * 0.85, 0.001, 0.006]}
        fontSize={0.016}
        color="#ff0000"
        anchorX="center"
        anchorY="middle"
        rotation={[Math.PI / 2, Math.PI, Math.PI / 2]}
      >
        N
      </Text>

      {/* Center dot */}
      <mesh position={[0, 0, 0.003]}>
        <sphereGeometry args={[0.004, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Outer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[compassRadius, compassRadius + 0.0015, 32]} />
        <meshStandardMaterial color="#ffffff" side={2} />
      </mesh>
    </group>
  );
}
