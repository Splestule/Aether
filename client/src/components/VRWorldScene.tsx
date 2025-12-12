import { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TilesRenderer } from '3d-tiles-renderer';
import {
    Matrix4,
    Vector3,
    Quaternion,
    Euler,
    Mesh,
    MeshStandardMaterial,
    ShaderLib,
    UniformsUtils,
    Color
} from 'three';
import * as Cesium from 'cesium';
import { UserLocation } from '@shared/src/types';

interface VRWorldSceneProps {
    userLocation: UserLocation;
}

export function VRWorldScene({ userLocation }: VRWorldSceneProps) {
    const { scene, camera, gl } = useThree();
    const tilesRendererRef = useRef<TilesRenderer | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // 1. Initialize TilesRenderer
    useEffect(() => {
        const initTiles = async () => {
            try {
                // Fetch Google 3D Tiles URL from Cesium Ion
                const assetId = 96188; // Google Photorealistic 3D Tiles
                const token = import.meta.env.VITE_CESIUM_ION_TOKEN;

                if (!token) {
                    console.error("VRWorldScene: No Cesium Ion Token found!");
                    return;
                }

                const response = await fetch(`https://api.cesium.com/v1/assets/${assetId}/endpoint?access_token=${token}`);
                const data = await response.json();

                if (!data.url) {
                    console.error("VRWorldScene: Failed to get tileset URL", data);
                    return;
                }

                console.log("VRWorldScene: Loading tiles from", data.url);

                // Create Renderer
                const tilesRenderer = new TilesRenderer(data.url);
                tilesRenderer.setCamera(camera);
                tilesRenderer.setResolutionFromRenderer(camera, gl);

                // Optimization Settings
                tilesRenderer.errorTarget = 12.0; // Lower = Better quality, Higher = Better perf (Default ~6)
                tilesRenderer.maxDepth = 15;
                tilesRenderer.loadSiblings = true;
                tilesRenderer.displayActiveTiles = true;
                tilesRenderer.autoDisableRendererCulling = false;

                // Add to Scene
                scene.add(tilesRenderer.group);
                tilesRendererRef.current = tilesRenderer;

                // 2. Custom Shader Injection (Replicating CesiumScene look)
                tilesRenderer.onLoadModel = (scene) => {
                    scene.traverse((c) => {
                        if (c instanceof Mesh) {
                            // We want to modify the material to add the distance fade and purple tint
                            // We can't easily replace the whole shader, but we can hook into onBeforeCompile
                            const originalMaterial = c.material as MeshStandardMaterial;

                            // Clone to avoid sharing issues if needed, though usually unique per tile
                            c.material = originalMaterial.clone();

                            c.material.onBeforeCompile = (shader) => {
                                // Pass camera position and other uniforms if needed
                                // Three.js handles cameraPosition uniform automatically in standard materials

                                shader.uniforms.uCenter = { value: new Vector3(0, 0, 0) }; // Will be updated
                                shader.uniforms.uRadius = { value: 6000.0 }; // 6km cutoff

                                // Inject logic at the end of the fragment shader
                                shader.fragmentShader = shader.fragmentShader.replace(
                                    '#include <dithering_fragment>',
                                    `
                                    #include <dithering_fragment>
                                    
                                    // Custom VR Flight Tracker Logic
                                    
                                    // 1. Distance Cutoff
                                    // vViewPosition is view-space position. length(vViewPosition) is distance to camera.
                                    // Or use gl_FragCoord? 
                                    // Three.js provides vViewPosition in standard materials.
                                    
                                    float dist = length(vViewPosition);
                                    if (dist > 6000.0) {
                                        discard;
                                    }

                                    // 2. Styling: Pale Gradient (Gray -> Purple)
                                    vec3 paleGray = vec3(0.90, 0.90, 0.92);
                                    vec3 mildPurple = vec3(0.85, 0.80, 0.95);
                                    
                                    // Height Gradient (Approximate)
                                    // We need world position for height. 
                                    // Standard material doesn't always export vWorldPosition unless we ask.
                                    // But we can approximate with view position or just use a simple gradient.
                                    // Let's use a simple screen-space or view-space gradient for now to save complexity.
                                    // Or better: use the texture color (gl_FragColor) and desaturate it.

                                    vec3 texColor = gl_FragColor.rgb;
                                    
                                    // Grayscale
                                    float gray = dot(texColor, vec3(0.299, 0.587, 0.114));
                                    
                                    // Mix with purple based on... let's just use a constant mix for the "vibe"
                                    // In Cesium we used height. Here let's use a subtle radial gradient or just constant.
                                    vec3 gradientColor = mildPurple; 
                                    
                                    vec3 base = vec3(gray);
                                    vec3 finalColor = mix(base, gradientColor, 0.4); // 40% purple
                                    
                                    gl_FragColor = vec4(finalColor + 0.05, gl_FragColor.a);
                                    `
                                );
                            };
                        }
                    });
                };

                setIsLoaded(true);

            } catch (error) {
                console.error("VRWorldScene: Failed to init", error);
            }
        };

        initTiles();

        return () => {
            if (tilesRendererRef.current) {
                tilesRendererRef.current.dispose();
                scene.remove(tilesRendererRef.current.group);
            }
        };
    }, [scene, camera, gl]);

    // 3. Coordinate System Update (When User Location Changes)
    useEffect(() => {
        if (!tilesRendererRef.current || !userLocation) return;

        const renderer = tilesRendererRef.current;
        const group = renderer.group;

        // A. Calculate User's ECEF Position (Cesium)
        const userECEF = Cesium.Cartesian3.fromDegrees(
            userLocation.longitude,
            userLocation.latitude,
            userLocation.altitude || 0
        );

        // B. Calculate Rotation Matrix to align User's Up with Three.js Y+
        // Cesium ENU: X=East, Y=North, Z=Up
        const enuToFixed = Cesium.Transforms.eastNorthUpToFixedFrame(userECEF);

        // We want to transform the WORLD such that the User is at (0,0,0) and aligned.
        // World Matrix = Inverse(User ENU Matrix) * (Coordinate Swap Matrix)

        // 1. Get Inverse of ENU (ECEF -> ENU)
        const inverseEnu = Cesium.Matrix4.inverse(enuToFixed, new Cesium.Matrix4());

        // 2. Convert to Three.js Matrix4
        const m1 = new Matrix4();
        m1.set(
            inverseEnu[0], inverseEnu[4], inverseEnu[8], inverseEnu[12],
            inverseEnu[1], inverseEnu[5], inverseEnu[9], inverseEnu[13],
            inverseEnu[2], inverseEnu[6], inverseEnu[10], inverseEnu[14],
            inverseEnu[3], inverseEnu[7], inverseEnu[11], inverseEnu[15]
        );

        // 3. Coordinate Swap (Cesium ENU -> Three.js)
        // Cesium: X=East, Y=North, Z=Up
        // Three:  X=East, Y=Up,    Z=South (Right-handed Y-up)
        // Rotate -90 deg around X axis: (x, y, z) -> (x, z, -y)
        // Wait:
        // Cesium X (East) -> Three X (East)
        // Cesium Y (North) -> Three -Z (North is -Z)
        // Cesium Z (Up)    -> Three Y (Up)

        const swapMat = new Matrix4().makeRotationX(-Math.PI / 2);

        // Final Transform: Apply Inverse ENU (to center/align to ENU), then Swap (to align to Three)
        const finalMat = swapMat.multiply(m1);

        // Apply to Group
        group.matrixAutoUpdate = false;
        group.matrix.copy(finalMat);
        group.updateMatrixWorld(true);

        console.log("VRWorldScene: Updated World Position for", userLocation);

    }, [userLocation, isLoaded]);

    // 4. Render Loop
    useFrame(() => {
        if (tilesRendererRef.current) {
            tilesRendererRef.current.update();
        }
    });

    return null; // Renders nothing directly, manages the TilesRenderer
}
