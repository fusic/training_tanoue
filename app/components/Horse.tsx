"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const HORSE_URL = "https://threejs.org/examples/models/gltf/Horse.glb";

type HorseProps = {
  width?: number;
  height?: number;
};

export default function Horse({ width = 800, height = 600 }: HorseProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ========== シーン設定 ==========
    const scene = new THREE.Scene();

    // 空のグラデーション背景
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

    // ========== カメラ設定 ==========
    const camera = new THREE.PerspectiveCamera(
      50,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 3, 6);
    camera.lookAt(0, 1.5, 0);

    // ========== レンダラー設定（高品質） ==========
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // ソフトシャドウ
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // 映画的なトーンマッピング
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // ========== ライティング（リアルな照明） ==========

    // 1. 環境光（全体を柔らかく照らす）
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // 2. 半球光（空と地面の色を反映）
    const hemisphereLight = new THREE.HemisphereLight(
      0x87ceeb, // 空の色（青）
      0x8b7355, // 地面の色（茶）
      0.6
    );
    scene.add(hemisphereLight);

    // 3. メインの太陽光（強い影を作る）
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.5);
    sunLight.position.set(10, 15, 8);
    sunLight.castShadow = true;

    // 影の品質を高める
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -15;
    sunLight.shadow.camera.right = 15;
    sunLight.shadow.camera.top = 15;
    sunLight.shadow.camera.bottom = -15;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    // 4. リムライト（輪郭を強調する逆光）
    const rimLight = new THREE.DirectionalLight(0xadd8e6, 1.2);
    rimLight.position.set(-8, 5, -5);
    scene.add(rimLight);

    // 5. フィルライト（影を柔らかくする補助光）
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 3, 5);
    scene.add(fillLight);

    // ========== 地面（高品質な芝生） ==========
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a8a3a, // 芝生の緑
      roughness: 0.9,  // 粗さ（光沢を抑える）
      metalness: 0.0,  // 金属感なし
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // 地面のテクスチャ感を出すために簡易的なノイズを追加
    const grassDetail = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100, 50, 50),
      new THREE.MeshStandardMaterial({
        color: 0x4a7a2a,
        roughness: 0.95,
        metalness: 0.0,
        wireframe: false,
      })
    );
    grassDetail.rotation.x = -Math.PI / 2;
    grassDetail.position.y = 0.001;
    grassDetail.receiveShadow = true;

    // 頂点をランダムに揺らして草の質感を出す
    const positionAttribute = grassDetail.geometry.getAttribute('position');
    for (let i = 0; i < positionAttribute.count; i++) {
      const y = positionAttribute.getY(i);
      positionAttribute.setY(i, y + Math.random() * 0.02);
    }
    positionAttribute.needsUpdate = true;
    grassDetail.geometry.computeVertexNormals();
    scene.add(grassDetail);

    // ========== 馬のモデルをロード ==========
    const loader = new GLTFLoader();
    let horseMesh: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;

    loader.load(
      HORSE_URL,
      (gltf) => {
        horseMesh = gltf.scene.children[0];
        if (!horseMesh) return;

        // モデルのスケールと位置調整
        horseMesh.scale.set(0.015, 0.015, 0.015);
        horseMesh.position.y = 0;

        // すべてのメッシュに影を設定
        horseMesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // マテリアルの品質向上
            if (child.material) {
              child.material.needsUpdate = true;

              // もしMeshStandardMaterialなら、よりリアルな設定に
              if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.roughness = 0.7;
                child.material.metalness = 0.1;
              }
            }
          }
        });

        scene.add(horseMesh);

        // アニメーション設定
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(horseMesh);
          const action = mixer.clipAction(gltf.animations[0]);
          action.setDuration(1); // 1秒でループ
          action.play();
        }
      },
      undefined,
      (error) => {
        console.error("Failed to load horse model:", error);
      }
    );

    // ========== アニメーションループ ==========
    const clock = new THREE.Clock();
    let cameraAngle = 0;

    function animate() {
      const delta = clock.getDelta();

      // アニメーションを更新
      if (mixer) {
        mixer.update(delta);
      }

      // カメラを円周上で回転させる
      cameraAngle += delta * 0.3; // 回転速度
      const radius = 6;
      camera.position.x = radius * Math.sin(cameraAngle);
      camera.position.z = radius * Math.cos(cameraAngle);
      camera.position.y = 3;
      camera.lookAt(0, 1.5, 0); // 馬の中心を見る

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    }

    let animationId = requestAnimationFrame(animate);

    // ========== リサイズ対応 ==========
    const handleResize = () => {
      const newWidth = mount.clientWidth;
      const newHeight = mount.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    // ========== クリーンアップ ==========
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);

      if (horseMesh) {
        scene.remove(horseMesh);
      }

      renderer.dispose();
      groundGeometry.dispose();
      groundMaterial.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [width, height]);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: height,
        position: "relative",
        overflow: "hidden",
      }}
    />
  );
}
