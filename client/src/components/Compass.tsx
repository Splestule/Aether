import { useFrame, useThree } from "@react-three/fiber";
import { useState } from "react";
import { Vector3 } from "three";

export function Compass() {
  const { camera } = useThree();
  const [heading, setHeading] = useState<string>("N");

  useFrame(() => {
    // Get camera's forward direction in world space
    const forward = new Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);
    
    // Project forward vector onto horizontal plane (ignore Y component)
    const forwardHorizontal = new Vector3(forward.x, 0, forward.z).normalize();
    
    // Calculate heading angle from North (Z-axis positive = North)
    // In Three.js: Z+ is forward (North), X+ is right (East)
    // atan2 gives angle from positive X axis, so we need to adjust
    // North (Z+) = 0°, East (X+) = 90°, South (Z-) = 180°, West (X-) = 270°
    const angle = Math.atan2(forwardHorizontal.x, forwardHorizontal.z);
    const degrees = (angle * (180 / Math.PI) + 360) % 360;
    
    // Convert to compass direction
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(degrees / 45) % 8;
    const direction = directions[index];
    
    setHeading(direction);
  });

  // Only show compass when not in VR mode (in VR, it would be confusing)
  // Actually, let's show it in both modes as requested
  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10000,
        background: "rgba(26, 26, 26, 0.9)",
        border: "1px solid #ffffff",
        borderRadius: "8px",
        padding: "12px 24px",
        color: "#ffffff",
        fontSize: "24px",
        fontWeight: "bold",
        fontFamily: "monospace",
        letterSpacing: "2px",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {heading}
    </div>
  );
}

