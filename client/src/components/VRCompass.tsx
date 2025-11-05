import { useRef, useState } from "react";
import { useController } from "@react-three/xr";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Vector3, Euler, Quaternion, Group } from "three";

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
  const dialRef = useRef<Group>(null);
  const [isGrabbed, setIsGrabbed] = useState(false);
  const initialControllerRotationRef = useRef<number | null>(null);
  const initialAccumulatedRotationRef = useRef<number>(0);

  useFrame((state) => {
    // Hide compass when a flight is selected or no controller
    if (
      selectedFlight ||
      !leftController ||
      !leftController.controller ||
      !compassRef.current ||
      !dialRef.current
    ) {
      return;
    }

    try {
      const controller = leftController.controller;
      const { camera } = state;
      
      // Ensure sceneRotation is a valid number
      const safeSceneRotation = typeof sceneRotation === 'number' && !isNaN(sceneRotation) ? sceneRotation : 0;

      // Position compass directly on the controller (centered on controller)
      compassRef.current.position.copy(controller.position);
      
      // Small offset to position it on top of controller (in controller's local space)
      const localOffset = new Vector3(0, 0.02, 0); // Small upward offset
      localOffset.applyQuaternion(controller.quaternion);
      compassRef.current.position.add(localOffset);

      // Keep compass aligned with world (not rotating with controller)
      // Compass should always face up and be horizontal
      compassRef.current.quaternion.identity(); // Reset to world orientation
      // No rotation needed - we'll rotate the mesh itself to be horizontal
      
      // Calculate current heading from camera
      // We need to account for scene rotation when calculating camera heading
      const forward = new Vector3(0, 0, -1);
      forward.applyQuaternion(camera.quaternion);
      
      // Rotate the forward vector back by scene rotation to get world-space direction
      // This compensates for the scene rotation so compass shows true world North
      const sceneRotationQuat = new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        -safeSceneRotation
      );
      forward.applyQuaternion(sceneRotationQuat);
      
      // Project forward vector onto horizontal plane (ignore Y component)
      const forwardHorizontal = new Vector3(forward.x, 0, forward.z);
      const horizontalLength = forwardHorizontal.length();
      
      // Only update dial if we have a valid horizontal direction
      if (horizontalLength > 0.001) {
        forwardHorizontal.normalize();
        
        // Calculate heading angle from North
        // In our coordinate system: X+ = North, Z+ = East
        const angle = Math.atan2(forwardHorizontal.z, forwardHorizontal.x);
        
        // Rotate dial to show current heading
        // The dial should point North (angle 0) when camera faces North
        // Negative angle because we want dial to rotate opposite to camera rotation
        // Also account for scene rotation calibration so dial rotates with the scene
        dialRef.current.rotation.y = -angle + safeSceneRotation;
      }

      // Check if controller trigger or grip button is pressed (for grabbing)
      // Access inputSource through leftController, not controller.controller
      // Add safety check to prevent errors if inputSource is not available
      const inputSource = leftController?.inputSource;
      const isButtonPressed =
        (inputSource?.gamepad?.buttons?.[0]?.pressed === true) || // Trigger
        (inputSource?.gamepad?.buttons?.[1]?.pressed === true); // Grip

      // Handle rotation when grabbed (for calibration)
      if (isButtonPressed) {
        // Get controller's Y-axis rotation (around vertical axis)
        const controllerEuler = new Euler().setFromQuaternion(
          controller.quaternion
        );
        const controllerYRotation = controllerEuler.y;

        if (initialControllerRotationRef.current === null) {
          // First frame of grab - store initial controller rotation and current scene rotation
          const safeSceneRotation = typeof sceneRotation === 'number' && !isNaN(sceneRotation) ? sceneRotation : 0;
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
          const newAccumulated = initialAccumulatedRotationRef.current + rotationDelta;
          
          // Calculate incremental change since last frame
          const safeSceneRotation = typeof sceneRotation === 'number' && !isNaN(sceneRotation) ? sceneRotation : 0;
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
      console.warn('VRCompass error:', error);
    }
  });

  // Hide compass when a flight is selected or no controller
  if (selectedFlight || !leftController) return null;

  const compassRadius = 0.06;
  const compassHeight = 0.005;

  return (
    <group ref={compassRef}>
        <group>
          {/* Compass base (flat disc) - rotate to be horizontal */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[compassRadius, compassRadius, compassHeight, 32]}
            />
            <meshStandardMaterial
              color="#1a1a1a"
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>

          {/* Dial - rotates to show heading */}
          <group ref={dialRef}>
            {/* North indicator (red arrow pointing up) */}
            <mesh position={[0, compassRadius * 0.7, compassHeight / 2 + 0.002]} rotation={[0, 0, 0]}>
              <coneGeometry args={[0.008, compassRadius * 0.5, 8]} />
              <meshStandardMaterial color="#ff0000" />
            </mesh>

            {/* South indicator (white arrow pointing down) */}
            <mesh position={[0, -compassRadius * 0.7, compassHeight / 2 + 0.002]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.008, compassRadius * 0.5, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>

            {/* Center dot */}
            <mesh position={[0, 0, compassHeight / 2 + 0.003]}>
              <sphereGeometry args={[0.004, 16, 16]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>

            {/* N label */}
            <Text
              position={[0, compassRadius * 0.9, compassHeight / 2 + 0.004]}
              fontSize={0.012}
              color="#ff0000"
              anchorX="center"
              anchorY="middle"
            >
              N
            </Text>
          </group>

          {/* Fixed outer ring with cardinal directions */}
          <group>
            {/* N marker */}
            <Text
              position={[0, compassRadius + 0.015, compassHeight / 2 + 0.001]}
              fontSize={0.014}
              color="#ff0000"
              anchorX="center"
              anchorY="middle"
            >
              N
            </Text>

            {/* S marker */}
            <Text
              position={[0, -compassRadius - 0.015, compassHeight / 2 + 0.001]}
              fontSize={0.014}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              S
            </Text>

            {/* E marker */}
            <Text
              position={[compassRadius + 0.015, 0, compassHeight / 2 + 0.001]}
              fontSize={0.014}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              E
            </Text>

            {/* W marker */}
            <Text
              position={[-compassRadius - 0.015, 0, compassHeight / 2 + 0.001]}
              fontSize={0.014}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              W
            </Text>

            {/* Outer ring */}
            <mesh position={[0, 0, compassHeight / 2 + 0.001]}>
              <torusGeometry args={[compassRadius, 0.0015, 16, 32]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          </group>

          {/* Instruction text */}
          <Text
            position={[0, -compassRadius - 0.03, compassHeight / 2 + 0.002]}
            fontSize={0.008}
            color="#888888"
            anchorX="center"
            anchorY="middle"
            maxWidth={compassRadius * 2}
          >
            {isGrabbed ? "Rotate to calibrate" : "Hold trigger & rotate"}
          </Text>
        </group>
    </group>
  );
}
