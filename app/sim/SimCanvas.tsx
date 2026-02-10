"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { HorseConfig } from "./types";
import "./sim.css";

const HORSE_URL = "https://threejs.org/examples/models/gltf/Horse.glb";

type SimCanvasProps = {
  horses: HorseConfig[];
};

export default function SimCanvas({ horses }: SimCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const configRef = useRef<HorseConfig[]>(horses);

  useEffect(() => {
    configRef.current = horses;
  }, [horses]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb9e6ff);
    scene.fog = new THREE.Fog(0xb9e6ff, 45, 110);

    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 18, 34);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    scene.add(sun);

    const groundGeo = new THREE.PlaneGeometry(160, 120);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2f7d3d });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const trackOuter = new THREE.RingGeometry(9.5, 12.2, 96, 1);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0xb78655,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const track = new THREE.Mesh(trackOuter, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.scale.set(2.4, 1, 1.25);
    track.receiveShadow = true;
    track.position.y = 0.01;
    scene.add(track);

    const infieldGeo = new THREE.CircleGeometry(9.5, 96);
    const infieldMat = new THREE.MeshStandardMaterial({
      color: 0x3f9b4b,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const infield = new THREE.Mesh(infieldGeo, infieldMat);
    infield.rotation.x = -Math.PI / 2;
    infield.scale.set(2.4, 1, 1.25);
    infield.receiveShadow = true;
    infield.position.y = 0.015;
    scene.add(infield);

    const railGeo = new THREE.TorusGeometry(12.4, 0.08, 12, 96);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const outerRail = new THREE.Mesh(railGeo, railMat);
    outerRail.rotation.x = -Math.PI / 2;
    outerRail.scale.set(2.4, 1, 1.25);
    outerRail.position.y = 0.08;
    scene.add(outerRail);

    const innerRailGeo = new THREE.TorusGeometry(9.2, 0.06, 12, 96);
    const innerRail = new THREE.Mesh(innerRailGeo, railMat);
    innerRail.rotation.x = -Math.PI / 2;
    innerRail.scale.set(2.4, 1, 1.25);
    innerRail.position.y = 0.06;
    scene.add(innerRail);

    const laneMaterial = new THREE.LineBasicMaterial({ color: 0xf5f5f5 });
    const laneRadii = [10.1, 10.8, 11.5];
    for (const radius of laneRadii) {
      const curve = new THREE.EllipseCurve(0, 0, radius * 2.4, radius * 1.25);
      const points = curve.getPoints(240);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.LineLoop(geometry, laneMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.y = 0.03;
      scene.add(line);
    }

    const gateGeo = new THREE.BoxGeometry(3.2, 1.4, 0.4);
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x1f5c8c });
    const gate = new THREE.Mesh(gateGeo, gateMat);
    gate.position.set(0, 0.7, -14);
    gate.castShadow = true;
    scene.add(gate);

    const standMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    for (let i = 0; i < 3; i += 1) {
      const standGeo = new THREE.BoxGeometry(10, 3, 2);
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(-18 + i * 12, 1.5, 18);
      stand.castShadow = true;
      scene.add(stand);
    }

    const loader = new GLTFLoader();
    const horseNodes: { root: THREE.Group; offset: number; lane: number }[] = [];
    const mixers: THREE.AnimationMixer[] = [];

    const MODEL_SCALE = 0.005;
    const MODEL_FORWARD = Math.PI / 2;

    let isDisposed = false;

    const createNumberTexture = (label: string, color: string) => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 12;
      ctx.strokeRect(6, 6, size - 12, size - 12);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 120px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, size / 2, size / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    loader.load(
      HORSE_URL,
      (gltf) => {
        if (isDisposed) return;
        const template = gltf.scene;
        template.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });

        const horseClip = gltf.animations[0] ?? null;
        const initialConfigs = configRef.current;

        for (let i = 0; i < initialConfigs.length; i += 1) {
          const config = initialConfigs[i];
          const clone = cloneSkeleton(template) as THREE.Group;
          clone.scale.setScalar(MODEL_SCALE);
          clone.rotation.y = MODEL_FORWARD;

          const root = new THREE.Group();
          root.add(clone);
          scene.add(root);

          const labelTexture = createNumberTexture(
            String(config.id),
            config.color
          );
          if (labelTexture) {
            const bbox = new THREE.Box3().setFromObject(clone);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            bbox.getSize(size);
            bbox.getCenter(center);

            const tagWidth = size.z * 0.7;
            const tagHeight = size.y * 0.35;
            const tagGeo = new THREE.PlaneGeometry(tagWidth, tagHeight);
            const tagMat = new THREE.MeshBasicMaterial({
              map: labelTexture,
              transparent: true,
              side: THREE.DoubleSide,
            });

            const offsetY = size.y * 0.15;
            const offsetZ = size.z * 0.55;

            const leftTag = new THREE.Mesh(tagGeo, tagMat);
            leftTag.position.set(center.x, center.y + offsetY, center.z + offsetZ);
            leftTag.rotation.y = Math.PI / 2;
            clone.add(leftTag);

            const rightTag = new THREE.Mesh(tagGeo, tagMat);
            rightTag.position.set(center.x, center.y + offsetY, center.z - offsetZ);
            rightTag.rotation.y = -Math.PI / 2;
            clone.add(rightTag);
          }

          if (horseClip) {
            const mixer = new THREE.AnimationMixer(clone);
            mixer.clipAction(horseClip).setEffectiveWeight(1).play();
            mixers.push(mixer);
          }

          horseNodes.push({
            root,
            offset: (i / initialConfigs.length) * Math.PI * 2,
            lane: i % laneRadii.length,
          });
        }
      },
      undefined,
      (error) => {
        console.error("Failed to load horse model", error);
      }
    );

    const clock = new THREE.Clock();
    let elapsed = 0;

    const tick = () => {
      const delta = clock.getDelta();
      elapsed += delta;

      if (mixers.length > 0) {
        for (const mixer of mixers) mixer.update(delta);
      }

      const configs = configRef.current;
      for (let i = 0; i < horseNodes.length; i += 1) {
        const horse = horseNodes[i];
        const config = configs[i];
        if (!config) continue;

        const speed = config.speed;
        const accel = config.accel;
        const theta =
          horse.offset + speed * elapsed + 0.5 * accel * elapsed * elapsed;

        const baseRadius = laneRadii[horse.lane] ?? laneRadii[0];
        const majorRadius = baseRadius * 2.4;
        const minorRadius = baseRadius * 1.25;

        const x = majorRadius * Math.cos(theta);
        const z = minorRadius * Math.sin(theta);
        const dx = -majorRadius * Math.sin(theta);
        const dz = minorRadius * Math.cos(theta);
        const heading = Math.atan2(dz, dx);

        horse.root.position.set(x, 0.08, z);
        horse.root.rotation.y = heading;
      }

      const camAngle = elapsed * 0.05;
      camera.position.x = Math.cos(camAngle) * 4;
      camera.position.z = 34 + Math.sin(camAngle) * 4;
      camera.lookAt(0, 2, 0);

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(tick);
    };

    let animationId = requestAnimationFrame(tick);

    const handleResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isDisposed = true;
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      groundGeo.dispose();
      trackOuter.dispose();
      infieldGeo.dispose();
      railGeo.dispose();
      innerRailGeo.dispose();
      gateGeo.dispose();
    };
  }, []);

  return <div ref={mountRef} className="sim-canvas" />;
}
