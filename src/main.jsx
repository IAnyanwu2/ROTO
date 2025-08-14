//main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/App.css'
import App from './App.jsx'
import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Float32BufferAttribute, CatmullRomCurve3 } from 'three'

import {
  vertexShader,
  fragmentShader,
  atmosphereVertexShader,
  atmosphereFragmentShader
} from './shaders/shaders'
 

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const MainScene = () => {
  const containerRef = useRef();
  const mixers = useRef([]);
  const glbModels = useRef([]);
  const satelliteGroup = useRef(new THREE.Group());
  let aircraftProgress = 0;
  const aircraftSpeed = 0.00039;
  let aircraft = null;

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 15;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    const textureLoader = new THREE.TextureLoader();
    const globeTexture = textureLoader.load('/globe.jpeg');

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(5, 50, 50),
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          globeTexture: { value: globeTexture }
        }
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

    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff });
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = -Math.random() * 2000;
      starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    scene.add(satelliteGroup.current);

    const curve = new CatmullRomCurve3([
      new THREE.Vector3(-20, 0, 0), new THREE.Vector3(-18, 5, -10),
      new THREE.Vector3(-16, 6, -5), new THREE.Vector3(-14, 6, 0),
      new THREE.Vector3(-12, 4, 5), new THREE.Vector3(-9, 3, 5),
      new THREE.Vector3(-6, 5, 3), new THREE.Vector3(-3, 6, 2),
      new THREE.Vector3(3, 6, 3), new THREE.Vector3(8, 6, -5),
      new THREE.Vector3(12, 3, -4), new THREE.Vector3(15, -10, -7),
      new THREE.Vector3(12, -20, -8), new THREE.Vector3(6, -15, -5),
      new THREE.Vector3(2, -10, -3), new THREE.Vector3(-3, -5, -6),
      new THREE.Vector3(-5, -3, -9), new THREE.Vector3(-10, 0, -5)
    ], true);

    class GLBModel {
      constructor(url, position, scale, parentGroup = null, isAircraft = false) {
        this.url = url;
        this.position = position;
        this.scale = scale;
        this.mixer = null;
        this.model = null;
        this.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        );
        this.parentGroup = parentGroup;
        this.isAircraft = isAircraft;
        this.loadModel();
      }

      loadModel() {
        const loader = new GLTFLoader();
        loader.load(this.url, (gltf) => {
          this.model = gltf.scene;
          if (gltf.animations.length) {
            this.mixer = new THREE.AnimationMixer(this.model);
            gltf.animations.forEach((clip) => {
              this.mixer.clipAction(clip).play();
            });
            mixers.current.push(this.mixer);
          }

          this.model.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.5,
                metalness: 0.5
              });
            }
          });

          this.model.position.copy(this.position);
          this.model.scale.set(this.scale, this.scale, this.scale);

          if (this.parentGroup) {
            this.parentGroup.add(this.model);
          } else {
            scene.add(this.model);
          }

          if (this.isAircraft) {
            aircraft = this;
          }
        });
      }

      randomMove() {
        if (this.model) {
          this.model.position.add(this.velocity);
          const boundary = 10;
          if (this.model.position.x > boundary || this.model.position.x < -boundary) this.velocity.x *= -1;
          if (this.model.position.y > boundary || this.model.position.y < -boundary) this.velocity.y *= -1;
          if (this.model.position.z > boundary || this.model.position.z < -boundary) this.velocity.z *= -1;
        }
      }
    }

    glbModels.current.push(new GLBModel('/vertex/satellite.glb', new THREE.Vector3(6, 0, 0), 1.5, satelliteGroup.current));
    glbModels.current.push(new GLBModel('/vertex/mech_drone.glb', new THREE.Vector3(-10, 0, 0), 2.8));
    glbModels.current.push(new GLBModel('/vertex/spaceshuttle_explorer_1.glb', new THREE.Vector3(0, 10, 0), 0.22, null, true));

    const animate = () => {
      requestAnimationFrame(animate);

      mixers.current.forEach(mixer => mixer.update(0.01));

      satelliteGroup.current.rotation.y += 0.005;
      sphere.rotation.y += 0.001;

      glbModels.current.forEach(model => {
        if (!model.isAircraft && model.model !== null) {
          model.randomMove();
        }
      });

      if (aircraft && aircraft.model) {
        aircraftProgress += aircraftSpeed;
        if (aircraftProgress > 1) aircraftProgress -= 1;
        const point = curve.getPointAt(aircraftProgress);
        const tangent = curve.getTangentAt(aircraftProgress);
        aircraft.model.position.copy(point);
        aircraft.model.lookAt(point.clone().add(tangent));
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />;
};

export default MainScene;



