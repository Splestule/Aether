import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import { Mesh, Vector3, Raycaster } from "three";
import { ProcessedFlight } from "@shared/src/types.js";

interface VRPointerProps {
  onFlightSelect: (flight: ProcessedFlight | null) => void;
  flights: ProcessedFlight[];
}

export function VRPointer({ onFlightSelect, flights }: VRPointerProps) {
  const pointerRef = useRef<Mesh>(null);
  const { controllers } = useXR();

  useFrame(() => {
    if (pointerRef.current && controllers.length > 0) {
      const controller = controllers[0];
      const controllerPosition = controller.controller.position;
      const controllerDirection = controller.controller.getWorldDirection(
        new Vector3()
      );

      // Update pointer position and rotation
      pointerRef.current.position.copy(controllerPosition);
      const targetPosition = new Vector3(
        controllerPosition.x + controllerDirection.x,
        controllerPosition.y + controllerDirection.y,
        controllerPosition.z + controllerDirection.z
      );
      pointerRef.current.lookAt(targetPosition);

      // Check for flight intersections
      const raycaster = new Raycaster();
      raycaster.set(controllerPosition, controllerDirection);

      // Simple intersection check with flight spheres
      let closestFlight: ProcessedFlight | null = null;
      let closestDistance = Infinity;

      flights.forEach((flight) => {
        const distance = controllerPosition.distanceTo(
          new Vector3(flight.position.x, flight.position.y, flight.position.z)
        );

        if (distance < 2 && distance < closestDistance) {
          // 2 unit radius
          closestDistance = distance;
          closestFlight = flight;
        }
      });

      // Handle controller button press
      if (controller.inputSource.gamepad?.buttons[0]?.pressed) {
        onFlightSelect(closestFlight);
      }
    }
  });

  return (
    <mesh ref={pointerRef} visible={false}>
      <cylinderGeometry args={[0.01, 0.01, 10]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
    </mesh>
  );
}
