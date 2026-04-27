//main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/App.css'
import App from './App.jsx'
import React, { useRef, useEffect, useState } from 'react'
import YieldDashboard from './components/YieldDashboard.jsx'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Float32BufferAttribute, CatmullRomCurve3 } from 'three'

import {
    vertexShader,
    fragmentShader,
    atmosphereVertexShader,
    atmosphereFragmentShader
} from './shaders/shaders'

// --- AUDITED RESEARCH GRID ---
const allCounties = [
    { name: "Boone ISU Research", lat: 42.0220, lon: -93.7790 },
    { name: "Story ISU Research", lat: 41.9960, lon: -93.6610 },
    { name: "Polk Rural North", lat: 41.8050, lon: -93.5350 },
    { name: "Polk Rural East", lat: 41.8054, lon: -93.5231 },
    { name: "Jasper Rural West", lat: 41.7204, lon: -93.0989 },
    { name: "Jasper Rural East", lat: 41.7220, lon: -92.9900 },
    { name: "Marshall Rural South", lat: 41.9830, lon: -92.9846 },
    { name: "Story Rural Nevada", lat: 41.9968, lon: -93.5404 },
    { name: "Dallas Rural North", lat: 41.7162, lon: -94.0243 },
    { name: "Tama Rural Field", lat: 42.0963, lon: -92.5681 },
    { name: "Black Hawk Rural", lat: 42.4692, lon: -92.6390 },
    { name: "Benton Rural Field", lat: 42.0145, lon: -92.2067 },
    { name: "Linn Rural North", lat: 42.2102, lon: -91.7407 },
    { name: "Johnson Rural South", lat: 41.5106, lon: -91.7415 },
    { name: "Clinton Rural West", lat: 41.8801, lon: -90.6610 },
    { name: "Scott Rural North", lat: 41.6464, lon: -91.0293 },
    { name: "Muscatine Rural", lat: 41.3050, lon: -91.5000 },
    { name: "Cedar Rural Field", lat: 41.9364, lon: -91.0870 },
    { name: "Jones Rural Field", lat: 42.1544, lon: -91.1430 },
    { name: "Dubuque Rural West", lat: 42.5825, lon: -90.7588 },
    { name: "Hardin Rural Field", lat: 42.5134, lon: -93.3921 }
];

const rootElement = document.getElementById('root');
if (!window.reactRoot) {
    window.reactRoot = createRoot(rootElement);
}
window.reactRoot.render(
    <StrictMode>
        <App />
    </StrictMode>,
)

const MainScene = () => {
    const containerRef = useRef();
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [activeCounties, setActiveCounties] = useState(allCounties.slice(0, 10).map(c => c.name));

    // Persistent refs
    const sceneRef = useRef(null);
    const markerGroupRef = useRef(new THREE.Group());
    const satelliteGroupRef = useRef(new THREE.Group());
    const moonGroupRef = useRef(new THREE.Group());
    const aircraftRef = useRef({ progress: 0, model: null, speed: 0.00039 });
    const freeModelsRef = useRef([]);

    const toggleCounty = (name) => {
        setActiveCounties(prev =>
            prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
        );
    };

    useEffect(() => {
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
        camera.position.z = 20;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        const textureLoader = new THREE.TextureLoader();

        // --- 1. DEEP SPACE BACKGROUND ---
        textureLoader.load('/space.jfif', (texture) => {
            scene.background = texture;
        });

        // --- 2. LIGHTING ---
        const ambientLight = new THREE.AmbientLight(0x666666); 
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(1, 1, 1).normalize();
        scene.add(directionalLight);

        // --- 3. THE EARTH & ATMOSPHERE ---
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(5, 50, 50),
            new THREE.ShaderMaterial({
                vertexShader,
                fragmentShader,
                uniforms: { globeTexture: { value: textureLoader.load('/2k_earth_daymap.jpg') } }
            })
        );
        scene.add(sphere);

        const atmosphere = new THREE.Mesh(
            new THREE.SphereGeometry(5.8, 50, 50),
            new THREE.ShaderMaterial({
                vertexShader: atmosphereVertexShader,
                fragmentShader: atmosphereFragmentShader,
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide,
                transparent: true
            })
        );
        scene.add(atmosphere);

        // --- 4. THE MOON ---
        scene.add(moonGroupRef.current);
        const loader = new GLTFLoader();
        loader.load('/vertex/moon_2k.glb', (gltf) => {
            const model = gltf.scene;
            model.scale.set(0.009, 0.009, 0.009); 
            model.position.set(22, 5, 0); 
            moonGroupRef.current.add(model);
        });

        // --- 5. THE FLEET ---
        scene.add(satelliteGroupRef.current);
        scene.add(markerGroupRef.current);

        // Satellite
        loader.load('/vertex/satellite.glb', (gltf) => {
            const model = gltf.scene;
            model.scale.set(1.5, 1.5, 1.5);
            model.position.set(6.5, 0, 0);
            satelliteGroupRef.current.add(model);
        });

        // Drone Alpha (GOLD)
        loader.load('/vertex/mech_drone.glb', (gltf) => {
            const model = gltf.scene;
            model.scale.set(2.8, 2.8, 2.8);
            model.traverse(c => { if (c.isMesh) c.material.color.setHex(0xFFD700); });
            scene.add(model);
            freeModelsRef.current.push({ model, velocity: new THREE.Vector3(0.04, 0.03, 0.02) });
        });

        // Drone Beta (RED)
        loader.load('/vertex/mech_drone.glb', (gltf) => {
            const model = gltf.scene;
            model.scale.set(2.8, 2.8, 2.8);
            model.traverse(c => { if (c.isMesh) c.material.color.setHex(0xFF0000); });
            scene.add(model);
            freeModelsRef.current.push({ model, velocity: new THREE.Vector3(-0.03, -0.04, -0.05) });
        });

        // Spaceship (DEEP BLUE)
        const curve = new CatmullRomCurve3([
            new THREE.Vector3(-25, 0, 10), new THREE.Vector3(-15, 12, -15),
            new THREE.Vector3(15, -12, 10), new THREE.Vector3(25, 0, -10)
        ], true);
        loader.load('/vertex/spaceshuttle_explorer_1.glb', (gltf) => {
            const model = gltf.scene;
            model.scale.set(0.22, 0.22, 0.22);
            model.traverse(c => { if (c.isMesh) c.material.color.setHex(0x00008B); });
            scene.add(model);
            aircraftRef.current = { model, curve, progress: 0, speed: 0.0004 };
        });

        // --- 6. THE EXPANSE BELT (22 Clones Spreading Around the Globe) ---
        const asteroidFiles = ['asteroid.glb', 'asteroid_01.glb'];
        asteroidFiles.forEach((file) => {
            loader.load(`/vertex/${file}`, (gltf) => {
                const baseModel = gltf.scene;
                baseModel.scale.set(0.012, 0.012, 0.012);
                
                for (let i = 0; i < 11; i++) {
                    const clone = baseModel.clone();
                    
                    // Spread X, Y, Z randomly
                    let x = (Math.random() - 0.5) * 250;
                    let y = (Math.random() - 0.5) * 150;
                    let z = (Math.random() - 0.5) * 300;
                    
                    // Safety: If spawns too close to Earth (radius 5), push it out
                    if (Math.abs(x) < 15 && Math.abs(y) < 15 && Math.abs(z) < 15) {
                        x += 20; z += 20;
                    }

                    clone.position.set(x, y, z);
                    clone.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
                    scene.add(clone);
                    freeModelsRef.current.push({ 
                        model: clone, 
                        velocity: new THREE.Vector3((Math.random()-0.5)*0.01, (Math.random()-0.5)*0.01, (Math.random()-0.5)*0.01),
                        isClonedAsteroid: true 
                    });
                }
            });
        });

        const animate = (time) => {
            const animId = requestAnimationFrame(animate);
            controls.update();

            satelliteGroupRef.current.rotation.y += 0.005;
            moonGroupRef.current.rotation.y += 0.001;

            freeModelsRef.current.forEach(item => {
                item.model.position.add(item.velocity);
                const boundaryX = item.isClonedAsteroid ? 200 : 35;
                const boundaryY = item.isClonedAsteroid ? 150 : 25;
                
                if (Math.abs(item.model.position.x) > boundaryX) item.velocity.x *= -1;
                if (Math.abs(item.model.position.y) > boundaryY) item.velocity.y *= -1;
                
                if(item.isClonedAsteroid) {
                    item.model.rotation.x += 0.001;
                    item.model.rotation.y += 0.002;
                }
            });

            if (aircraftRef.current.model) {
                aircraftRef.current.progress += aircraftRef.current.speed;
                const point = aircraftRef.current.curve.getPointAt(aircraftRef.current.progress % 1);
                const tangent = aircraftRef.current.curve.getTangentAt(aircraftRef.current.progress % 1);
                aircraftRef.current.model.position.copy(point);
                aircraftRef.current.model.lookAt(point.clone().add(tangent));
            }

            renderer.render(scene, camera);
            sceneRef.current.animId = animId;
        };
        animate(0);

        const onPointerUp = (event) => {
            const rect = renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects([sphere, ...markerGroupRef.current.children]);
            if (intersects.length > 0) {
                const marker = intersects.find(i => i.object.userData && i.object.userData.lat);
                if (marker) setSelectedLocation(marker.object.userData);
            }
        };
        window.addEventListener('pointerup', onPointerUp);

        return () => {
            window.removeEventListener('pointerup', onPointerUp);
            if (sceneRef.current && sceneRef.current.animId) cancelAnimationFrame(sceneRef.current.animId);
            renderer.dispose();
            if (containerRef.current) containerRef.current.innerHTML = '';
        };
    }, []);

    // Update markers only
    useEffect(() => {
        if (!sceneRef.current) return;
        while (markerGroupRef.current.children.length > 0) { markerGroupRef.current.remove(markerGroupRef.current.children[0]); }
        allCounties.forEach(county => {
            if (!activeCounties.includes(county.name)) return;
            const phi = (90 - county.lat) * (Math.PI / 180);
            const theta = (county.lon + 185) * (Math.PI / 180);
            const marker = new THREE.Mesh(
                new THREE.SphereGeometry(0.12, 16, 16),
                new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.9 })
            );
            marker.position.set(5.03 * Math.sin(phi) * Math.cos(theta), 5.03 * Math.cos(phi), 5.03 * Math.sin(phi) * Math.sin(theta));
            marker.userData = county;
            markerGroupRef.current.add(marker);
        });
    }, [activeCounties]);

    return (
        <>
            <div ref={containerRef} style={{ width: '100vw', height: '100vh', position: 'relative' }} />
            <div style={sidebarStyles.container}>
                <h3 style={sidebarStyles.title}>ROTO GALAXY CONTROL</h3>
                <div style={sidebarStyles.list}>
                    {allCounties.map(c => (
                        <div key={c.name} style={sidebarStyles.item} onClick={() => toggleCounty(c.name)}>
                            <input type="checkbox" readOnly checked={activeCounties.includes(c.name)} style={sidebarStyles.checkbox} />
                            <span style={{ color: activeCounties.includes(c.name) ? '#4ade80' : '#64748b' }}>{c.name}</span>
                        </div>
                    ))}
                </div>
            </div>
            {selectedLocation && (
                <YieldDashboard lat={selectedLocation.lat} lon={selectedLocation.lon} county={selectedLocation.name} availableCounties={allCounties.filter(c => activeCounties.includes(c.name))} onClose={() => setSelectedLocation(null)} />
            )}
        </>
    );
};

const sidebarStyles = {
    container: { position: 'absolute', top: '20px', left: '20px', width: '230px', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '16px', padding: '15px', maxHeight: '85vh', overflowY: 'auto', zIndex: 100, boxShadow: '0 20px 40px rgba(0,0,0,0.7)' },
    title: { fontSize: '10px', fontWeight: '800', color: '#facc15', letterSpacing: '1.5px', marginBottom: '12px', borderBottom: '1px solid rgba(250,204,21,0.2)', paddingBottom: '8px', textTransform: 'uppercase' },
    list: { display: 'flex', flexDirection: 'column', gap: '5px' },
    item: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', cursor: 'pointer', padding: '3px 0' },
    checkbox: { cursor: 'pointer', accentColor: '#4ade80' }
};

export default MainScene;
