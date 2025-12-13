import { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TilesRenderer } from '3d-tiles-renderer';
import {
    Matrix4,
    BoxGeometry,
    MeshBasicMaterial,
    Mesh,
    Color,
    AmbientLight,
    DirectionalLight,
    PMREMGenerator,
    Scene,
    Box3,
    Sphere
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
    Cartesian3,
    Matrix4 as CesiumMatrix4,
    Transforms,
    Math as CesiumMath
} from 'cesium';

interface VRWorldSceneProps {
    userLocation: {
        latitude: number;
        longitude: number;
        altitude?: number;
    } | null;
}

export function VRWorldScene({ userLocation }: VRWorldSceneProps) {
    const { scene, camera, gl } = useThree();
    const tilesRendererRef = useRef<TilesRenderer | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // 1. Setup Environment & Lighting (Critical for PBR)
    useEffect(() => {
        // Sky Blue Background for horizon reference
        scene.background = new Color(0x99ccff);

        // Generate a high-quality Environment Map using PMREM
        // This simulates indirect lighting and reflections, preventing "Black" textures
        const pmremGenerator = new PMREMGenerator(gl);
        pmremGenerator.compileEquirectangularShader();
        const roomEnvironment = new RoomEnvironment();
        scene.environment = pmremGenerator.fromScene(roomEnvironment).texture;

        // Clean up
        return () => {
            scene.environment = null;
            pmremGenerator.dispose();
            roomEnvironment.dispose();
        };
    }, [scene, gl]);

    // 2. Add Sun & Ambient Light
    useEffect(() => {
        const ambientLight = new AmbientLight(0xffffff, 1.5); // Boost ambient visibility
        scene.add(ambientLight);

        const dirLight = new DirectionalLight(0xffffff, 3.0);
        dirLight.position.set(0, 5000, 0); // Sun high overhead
        scene.add(dirLight);

        return () => {
            scene.remove(ambientLight);
            scene.remove(dirLight);
        };
    }, [scene]);

    // 3. Initialize TilesRenderer
    useEffect(() => {
        const initTiles = async () => {
            try {
                const assetId = 96188; // Google Photorealistic 3D Tiles
                const token = import.meta.env.VITE_CESIUM_ION_TOKEN;

                if (!token) {
                    console.error("VRWorldScene: No Token");
                    return;
                }

                console.log("VRWorldScene: Fetching tileset...");
                const response = await fetch(`https://api.cesium.com/v1/assets/${assetId}/endpoint?access_token=${token}`);
                // TEST: USE PUBLIC NASA TILESET
                const tilesetUrl = 'https://raw.githubusercontent.com/NASA-AMMOS/3DTilesSampleData/master/msl-dingo-gap/0528_0260184_to_s64244_v1/0528_0260184_to_s64244_v1.json';
                console.log("VRWorldScene: DEBUG MODE - Using NASA Mars Tileset");

                const tilesRenderer = new TilesRenderer(tilesetUrl);
                tilesRenderer.setCamera(camera);
                tilesRenderer.setResolutionFromRenderer(camera, gl);

                // No Auth needed for Public GitHub
                tilesRenderer.fetchOptions = { mode: 'cors' };

                // Visualization & Performance Settings
                tilesRenderer.errorTarget = 12.0; // Standard

                (tilesRenderer as any).addEventListener('load-tile-set', () => {
                    console.log("VRWorldScene: Tileset JSON Loaded!");
                    // Visual Feedback: Turn Cube CYAN
                    const statusMesh = scene.getObjectByName("status-cube") as Mesh;
                    if (statusMesh) (statusMesh.material as MeshBasicMaterial).color.setHex(0x00ffff);

                    // Center the model roughly at 0,0,0
                    const box = new Box3();
                    const sphere = new Sphere();
                    (tilesRenderer as any).getBoundingBox(box);
                    box.getBoundingSphere(sphere);
                    tilesRenderer.group.position.copy(sphere.center).multiplyScalar(-1);
                    tilesRenderer.group.position.y -= sphere.radius * 0.5; // Move down a bit
                });

                (tilesRenderer as any).addEventListener('load-model', (e: any) => {
                    // Tile geometry loaded
                    console.log("VRWorldScene: Model Loaded", e);
                    const statusMesh = scene.getObjectByName("status-cube") as Mesh;
                    // Dark Blue = Model Loaded but maybe not active yet
                    if (statusMesh) (statusMesh.material as MeshBasicMaterial).color.setHex(0x00008b);
                });

                (tilesRenderer as any).addEventListener('load-error', (e: any) => {
                    console.error("VRWorldScene: LOAD ERROR", e);
                    const statusMesh = scene.getObjectByName("status-cube") as Mesh;
                    if (statusMesh) (statusMesh.material as MeshBasicMaterial).color.setHex(0xff0000); // RED
                });

                (tilesRenderer as any).addEventListener('tile-error', (e: any) => {
                    console.error("VRWorldScene: TILE ERROR", e);
                    const statusMesh = scene.getObjectByName("status-cube") as Mesh;
                    if (statusMesh) (statusMesh.material as MeshBasicMaterial).color.setHex(0xffa500); // ORANGE
                });

                // FORCE GROUP RE-RENDER
                tilesRenderer.group.frustumCulled = false;

                // All debugging flags
                tilesRenderer.autoDisableRendererCulling = true;
                (tilesRenderer as any).displayActiveTiles = true;
                (tilesRenderer as any).loadSiblings = true;

                // Add to Scene
                scene.add(tilesRenderer.group);
                tilesRendererRef.current = tilesRenderer;

                setIsLoaded(true);

            } catch (error) {
                console.error("VRWorldScene: Init failed", error);
                // Visual Error Feedback: Turn Status Cube RED
                const statusMesh = scene.getObjectByName("status-cube") as Mesh;
                if (statusMesh) (statusMesh.material as MeshBasicMaterial).color.setHex(0xff0000);
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

    // 4. Floating Origin: Move the World to the User
    useEffect(() => {
        if (!tilesRendererRef.current || !userLocation) return;

        const group = tilesRendererRef.current.group;

        // 1. Calculate Target ECEF Position (Where the user is on Earth)
        // Add 1000m altitude to ensure we are above terrain/buildings
        const userPositionCartographic = Cartesian3.fromDegrees(
            userLocation.longitude,
            userLocation.latitude,
            (userLocation.altitude || 0) + 1000
        );

        // 2. Compute "East-North-Up" Matrix at this location
        // This matrix describes a local coordinate system where:
        // Origin = User Position
        // Z axis = Computed Up (Normal to ellipsoid)
        // X axis = East
        // Y axis = North
        // Note: Cesium's "EastNorthUp" actually produces:
        // X=East, Y=North, Z=Up.
        const enuToFixed = Transforms.eastNorthUpToFixedFrame(userPositionCartographic);

        // 3. We want the INVERSE.
        // We want to transform the Earth (Fixed Frame) INTO the User's Local Frame.
        // So that the User is at (0,0,0) looking along the local axes.
        const fixedToEnu = CesiumMatrix4.inverse(enuToFixed, new CesiumMatrix4());

        // 4. Convert to Three.js Matrix4
        // Cesium is Column-Major, Three.js is Column-Major. Direct copy works.
        const invArray = CesiumMatrix4.toArray(fixedToEnu);
        const m1 = new Matrix4();
        m1.set(
            invArray[0], invArray[4], invArray[8], invArray[12],
            invArray[1], invArray[5], invArray[9], invArray[13],
            invArray[2], invArray[6], invArray[10], invArray[14],
            invArray[3], invArray[7], invArray[11], invArray[15]
        );

        // 5. Coordinate Interface Match
        // Cesium ENU: X=East, Y=North, Z=Up
        // Three.js: X=Right, Y=Up, Z=Back (Right-Handed)
        // In WebXR (Y-Up), we want:
        // Cesium Z (Up) -> Three Y (Up)
        // Cesium Y (North) -> Three -Z (Forward/North)
        // Cesium X (East) -> Three X (Right)
        // Rotation X = -90 degrees (-PI/2) achieves: Z->Y, Y->-Z.
        const swapMat = new Matrix4().makeRotationX(-Math.PI / 2);

        // Final = Swap * InverseENU
        const finalMat = swapMat.multiply(m1);

        group.matrixAutoUpdate = false;

        // Debug: Log the simplified matrix to check for sanity
        console.log("VRWorldScene: Matrix Elements", finalMat.elements);

        group.matrixAutoUpdate = true; // Use standard posiiton
        // group.matrix.copy(finalMat);
        // group.updateMatrixWorld(true);

        console.log("VRWorldScene: Floating Origin TEMPORARILY DISABLED (Mars Mode)");

    }, [userLocation, isLoaded]);

    // 5. Render Loop
    const frameRef = useRef(0);
    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        const statusMesh = scene.getObjectByName("status-cube") as Mesh;
        if (statusMesh && tilesRendererRef.current) {
            // Pulse Effect
            const scale = 1 + Math.sin(time * 5) * 0.2;
            statusMesh.scale.set(scale, scale, scale);

            const r = tilesRendererRef.current;
            const mat = statusMesh.material as MeshBasicMaterial;

            // Stats Analysis
            const stats = (r as any).stats;

            // Console Heartbeat (Every 60 frames)
            frameRef.current++;
            if (frameRef.current % 120 === 0) {
                console.log("VRWorldScene: Status", {
                    active: (r as any).activeTiles.size,
                    downloading: stats.downloading,
                    parsing: stats.parsing,
                    visible: (r as any).visibleTiles.size,
                    camera: camera.position.toArray()
                });
            }

            // COLOR LOGIC
            // BLUE = Visible Content
            if ((r as any).activeTiles.size > 0) mat.color.setHex(0x0000ff);
            // PURPLE = Busy Downloading (Good sign!)
            else if (stats.downloading > 0) mat.color.setHex(0x800080);
            // CYAN = Parse in progress
            else if (stats.parsing > 0) mat.color.setHex(0x00ffff);
            // GREEN = Idle / Initialized (Bad if stuck here)
            else if (isLoaded) mat.color.setHex(0x00ff00);
            // YELLOW = Loading Start
            else mat.color.setHex(0xffff00);
        }

        // CRITICAL: ACTUALLY UPDATE RENDERER
        if (tilesRendererRef.current) {
            // Force Resolution (VR sometimes reports 0/weird sizes initially)
            tilesRendererRef.current.setResolution(1920, 1080);
            // Aggressive Quality to force load
            tilesRendererRef.current.errorTarget = 0.5;

            tilesRendererRef.current.setCamera(camera);
            tilesRendererRef.current.update();
        }
    });

    // 6. DEBUG: Safety Sphere & Status Cube
    useEffect(() => {
        // Red Sphere = Scene is Alive
        const geom = new BoxGeometry(0.5, 0.5, 0.5);
        const mat = new MeshBasicMaterial({ color: 0xff0000 });
        const mesh = new Mesh(geom, mat);
        mesh.position.set(0, 1, -2); // Center
        scene.add(mesh);

        // Status Cube (Right)
        // Blue = Tiles Loaded, Yellow = Error, Green = Init
        const statusGeom = new BoxGeometry(0.3, 0.3, 0.3);
        const statusMat = new MeshBasicMaterial({ color: 0xffff00 }); // Start Yellow
        const statusMesh = new Mesh(statusGeom, statusMat);
        statusMesh.position.set(1, 1, -2); // 1m to the right
        statusMesh.name = "status-cube";
        scene.add(statusMesh);

        // Ground Plane Reference (Green Wireframe)
        // To see where Y=0 is
        const planeGeom = new BoxGeometry(100, 0.1, 100);
        const planeMat = new MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
        const plane = new Mesh(planeGeom, planeMat);
        plane.position.set(0, -1, 0); // 1m below eye? No, user is at Y=0 usually in WebXR? 
        // Actually WebXR camera is at Y=Height. Ground should be at Y=0.
        plane.position.y = 0;
        scene.add(plane);

        return () => {
            scene.remove(mesh); scene.remove(statusMesh); scene.remove(plane);
            geom.dispose(); mat.dispose();
            statusGeom.dispose(); statusMat.dispose();
            planeGeom.dispose(); planeMat.dispose();
        };
    }, [scene]);

    // Update Status Cube Color & Pulse
    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        const statusMesh = scene.getObjectByName("status-cube") as Mesh;
        if (statusMesh && tilesRendererRef.current) {
            // Pulse Effect (Heartbeat) to prove loop is running
            const scale = 1 + Math.sin(time * 5) * 0.2;
            statusMesh.scale.set(scale, scale, scale);

            const r = tilesRendererRef.current;
            const mat = statusMesh.material as MeshBasicMaterial;

            // Check Active TIles
            if ((r as any).activeTiles.size > 0) mat.color.setHex(0x0000ff); // BLUE = VISIBLE
            else if (isLoaded) mat.color.setHex(0x00ff00); // GREEN = INITIALIZED
            else mat.color.setHex(0xffff00); // YELLOW = LOADING/ERROR
        }
    });

    return null;
} // Renders nothing directly, manages the TilesRenderer
