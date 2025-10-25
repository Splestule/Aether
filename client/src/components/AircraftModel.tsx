import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'

interface AircraftModelProps {
  color?: string
  scale?: number
  animated?: boolean
}

export function AircraftModel({ 
  color = '#ffffff', 
  scale = 1, 
  animated = true 
}: AircraftModelProps) {
  const groupRef = useRef<Group>(null)

  useFrame((state) => {
    if (groupRef.current && animated) {
      // Gentle floating animation
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1
    }
  })

  return (
    <group ref={groupRef} scale={scale}>
      {/* Main fuselage */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.1, 0.15, 2, 8]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Nose cone */}
      <mesh position={[1, 0, 0]} castShadow>
        <coneGeometry args={[0.1, 0.3, 8]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Wings */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.05, 0.3, 1.5]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Tail */}
      <mesh position={[-0.8, 0.2, 0]} castShadow>
        <boxGeometry args={[0.05, 0.4, 0.2]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Vertical stabilizer */}
      <mesh position={[-0.8, 0.4, 0]} castShadow>
        <boxGeometry args={[0.05, 0.2, 0.1]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Engines */}
      <mesh position={[0.3, 0, 0.4]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 8]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.3, 0, -0.4]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 8]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Landing gear (when on ground) */}
      <mesh position={[0.2, -0.2, 0.2]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 6]} />
        <meshStandardMaterial color="#666666" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0.2, -0.2, -0.2]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 6]} />
        <meshStandardMaterial color="#666666" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[-0.5, -0.2, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 6]} />
        <meshStandardMaterial color="#666666" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
}
