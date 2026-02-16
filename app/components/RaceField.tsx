"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const HORSE_URL = "https://threejs.org/examples/models/gltf/Horse.glb";

// ========== テレメトリーベースのレースデータ型定義 ==========

/**
 * チェックポイント情報
 */
type Checkpoint = {
  distance: number; // 距離（メートル）
  time: number; // 通過時刻（秒）
  position: number; // 順位（1着、2着など）
  lane?: number; // レーン（0=内側、1=中間、2=外側）省略時は馬の初期レーン
};

/**
 * レーステレメトリーデータ
 * 各馬の詳細な走行データを定義
 */
type RaceTelemetry = {
  id: number;
  name: string;
  color: string; // 馬の体の色
  bibNumber?: number; // ゼッケン番号（省略時はidを使用）
  bibColor?: string; // ゼッケンの背景色（省略時は赤系）
  lane: number; // 枠番（0=内枠、1=中枠、2=外枠）
  checkpoints: Checkpoint[]; // 距離・時刻・順位のチェックポイント
};

// ========== テストデータ：2頭のレース ==========
const RACE_TELEMETRIES: RaceTelemetry[] = [
  {
    id: 1,
    name: "サンプル馬A",
    color: "#8B4513", // 馬の体の色（茶色）
    bibNumber: 3, // ゼッケン番号
    bibColor: "#FF1744", // ゼッケンの背景色（赤）
    lane: 0, // 内枠
    checkpoints: [
      { distance: 0, time: 0, position: 2, lane: 0 }, // スタート（内側）
      { distance: 200, time: 12, position: 2, lane: 0 }, // 200m通過（内側）
      { distance: 400, time: 24, position: 2, lane: 0 }, // 第1コーナー付近（内側）
      { distance: 500, time: 30, position: 2, lane: 1 }, // 追い抜きのため外側へ移動開始
      { distance: 600, time: 36, position: 1, lane: 1 }, // 第2コーナー（中間レーンで1位に）
      { distance: 700, time: 42, position: 1, lane: 0 }, // 追い抜き後、内側に戻る
      { distance: 800, time: 48, position: 1, lane: 0 }, // 第3コーナー（内側）
      { distance: 1000, time: 60, position: 1, lane: 0 }, // 第4コーナー（内側）
      { distance: 1200, time: 70, position: 1, lane: 0 }, // ゴール（内側）
    ],
  },
  {
    id: 2,
    name: "サンプル馬B",
    color: "#2F4F4F", // 馬の体の色（濃い灰色）
    bibNumber: 7, // ゼッケン番号
    bibColor: "#2196F3", // ゼッケンの背景色（青）
    lane: 2, // 外枠
    checkpoints: [
      { distance: 0, time: 0, position: 1, lane: 2 }, // スタート（外枠）
      { distance: 100, time: 6, position: 1, lane: 1 }, // 100m地点で内側に寄せる
      { distance: 200, time: 11.5, position: 1, lane: 0 }, // 200m地点で内側に入る
      { distance: 400, time: 23, position: 1, lane: 0 }, // 第1コーナー（内側）
      { distance: 600, time: 35, position: 2, lane: 0 }, // 第2コーナー（内側）
      { distance: 800, time: 48, position: 2, lane: 0 }, // 第3コーナー（内側）
      { distance: 1000, time: 61, position: 2, lane: 0 }, // 第4コーナー（内側）
      { distance: 1200, time: 72, position: 2, lane: 0 }, // ゴール（内側）
    ],
  },
];

type HorseConfig = {
  id: number;
  name: string;
  color: string; // 馬の体の色
  bibNumber: number; // ゼッケン番号
  bibColor: string; // ゼッケンの背景色
  lane: number;
  checkpoints: Checkpoint[];
};

type RaceFieldProps = {
  cameraAutoRotate?: boolean;
  numberOfHorses?: number;
};

export default function RaceField({
  cameraAutoRotate = false,
  numberOfHorses = 2, // テレメトリーデータに基づく2頭のレース
}: RaceFieldProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isRacing, setIsRacing] = useState(false);
  const [raceTime, setRaceTime] = useState(0);
  const [cameraMode, setCameraMode] = useState<"overview" | number>("overview"); // カメラモード: "overview" または馬のインデックス
  const isRacingRef = useRef(false);
  const elapsedRef = useRef(0); // Three.js内で管理する実際の経過時間
  const lastUpdateRef = useRef(0); // 最後にstateを更新した時刻
  const startTimeRef = useRef(0); // レース開始時刻（performance.now()）
  const isTimerRunningRef = useRef(false); // タイマーが動いているかどうか
  const horseNodesRef = useRef<
    {
      root: THREE.Group;
      config: HorseConfig;
      offset: number;
      goalCrossingTime: number | null;
    }[]
  >([]); // 馬のノードを保持するref
  const cameraModeRef = useRef<"overview" | number>("overview"); // カメラモードのref

  // Update ref when state changes
  useEffect(() => {
    isRacingRef.current = isRacing;
  }, [isRacing]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // コンテナのサイズを取得
    const containerWidth = mount.clientWidth;
    const containerHeight = mount.clientHeight;

    // ========== シーン設定 ==========
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // 空色
    scene.fog = new THREE.Fog(0x87ceeb, 600, 1800);

    // ========== カメラ設定 ==========
    const camera = new THREE.PerspectiveCamera(
      75,
      containerWidth / containerHeight,
      0.1,
      5000,
    );
    // ゴールライン（上側直線の左端 = 1200m地点）が見える位置に初期配置
    // straightLength = 300, cornerRadius ≈ 95.5
    camera.position.set(-50, 150, 150);
    camera.lookAt(-1000, 0, 95.5);

    // ========== レンダラー設定（高品質） ==========
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerWidth, containerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // ========== カメラコントロール（拡大縮小・回転） ==========
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 50;
    controls.maxDistance = 800;
    controls.maxPolarAngle = Math.PI / 2.2; // 地面下に行かないように制限

    // ========== ライティング ==========

    // 環境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // 半球光（空と地面の色）
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x6b8e23, 0.8);
    scene.add(hemisphereLight);

    // 太陽光（メインライト）
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.0);
    sunLight.position.set(350, 500, 200);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.left = -500;
    sunLight.shadow.camera.right = 500;
    sunLight.shadow.camera.top = 500;
    sunLight.shadow.camera.bottom = -500;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 1200;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    // リムライト
    const rimLight = new THREE.DirectionalLight(0xadd8e6, 0.8);
    rimLight.position.set(-250, 200, -250);
    scene.add(rimLight);

    // ========== 地面（外側の芝生エリア） ==========
    const outerGroundGeometry = new THREE.PlaneGeometry(1000, 700);
    const outerGroundMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a7a2a,
      roughness: 0.95,
      metalness: 0.0,
    });
    const outerGround = new THREE.Mesh(
      outerGroundGeometry,
      outerGroundMaterial,
    );
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.receiveShadow = true;
    scene.add(outerGround);

    // ========== 競馬トラック（直線×2 + コーナー×2） ==========

    // トラックのサイズ設定（1周1600m想定: 直線400m×2 + カーブ400m×2）
    // スタートからゴールまで1200m（3/4周）
    // フィールドを大幅に拡大
    const straightLength = 300; // 直線部分の長さ（400m想定）
    const cornerRadius = 300 / Math.PI; // カーブ400m → 半円なので r ≈ 95.5unit
    const trackWidth = 22; // トラックの幅（30m想定）

    // トラック形状を作成する関数（横長スタジアム型）
    const createRaceTrackShape = (
      straight: number,
      radius: number,
      width: number,
      isOuter: boolean,
    ) => {
      const points: THREE.Vector2[] = [];
      const r = isOuter ? radius + width / 2 : radius - width / 2;
      const halfStraight = straight / 2;

      // 上側の直線（左から右）
      points.push(new THREE.Vector2(-halfStraight, r));
      points.push(new THREE.Vector2(halfStraight, r));

      // 右側のコーナー（上から下へ）
      for (let i = 0; i <= 50; i++) {
        const angle = (i / 50) * Math.PI; // 0 to π
        const x = halfStraight + r * Math.sin(angle);
        const z = r * Math.cos(angle);
        points.push(new THREE.Vector2(x, z));
      }

      // 下側の直線（右から左）
      points.push(new THREE.Vector2(halfStraight, -r));
      points.push(new THREE.Vector2(-halfStraight, -r));

      // 左側のコーナー（下から上へ）
      for (let i = 0; i <= 50; i++) {
        const angle = Math.PI + (i / 50) * Math.PI; // π to 2π
        const x = -halfStraight + r * Math.sin(angle);
        const z = r * Math.cos(angle);
        points.push(new THREE.Vector2(x, z));
      }

      return points;
    };

    // ダートトラック（茶色）
    const trackShape = new THREE.Shape();
    const outerPoints = createRaceTrackShape(
      straightLength,
      cornerRadius,
      trackWidth,
      true,
    );
    const innerPoints = createRaceTrackShape(
      straightLength,
      cornerRadius,
      trackWidth,
      false,
    ).reverse();

    trackShape.setFromPoints(outerPoints);
    const holePath = new THREE.Path();
    holePath.setFromPoints(innerPoints);
    trackShape.holes.push(holePath);

    const trackGeometry = new THREE.ShapeGeometry(trackShape);
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: 0xc19a6b, // ダートの色
      roughness: 0.9,
      metalness: 0.0,
    });

    const track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0.12;
    track.receiveShadow = true;
    scene.add(track);

    // トラックに質感を追加（細かいノイズ）
    const trackDetailWidth = straightLength + cornerRadius * 2 + trackWidth * 2;
    const trackDetailHeight = cornerRadius * 2 + trackWidth * 2;
    const trackDetailGeometry = new THREE.PlaneGeometry(
      trackDetailWidth,
      trackDetailHeight,
      300,
      300,
    );
    const posAttr = trackDetailGeometry.getAttribute("position");
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getY(i);
      // トラック範囲内のみにノイズを追加
      const isOnTrack =
        Math.abs(x) < straightLength / 2 + cornerRadius + trackWidth &&
        Math.abs(z) < cornerRadius + trackWidth;
      if (isOnTrack) {
        posAttr.setZ(i, Math.random() * 0.18);
      }
    }
    posAttr.needsUpdate = true;
    trackDetailGeometry.computeVertexNormals();

    const trackDetail = new THREE.Mesh(
      trackDetailGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xb8956a,
        roughness: 0.95,
        metalness: 0.0,
      }),
    );
    trackDetail.rotation.x = -Math.PI / 2;
    trackDetail.position.y = 0.15;
    trackDetail.receiveShadow = true;
    scene.add(trackDetail);

    // ========== 内側の芝生（インフィールド） ==========
    // スタジアム形状のインフィールドを作成
    const infieldRadius = cornerRadius - trackWidth / 2 - 3;
    const infieldPoints: THREE.Vector2[] = [];
    const halfStraightInfield = straightLength / 2;

    // 上側
    infieldPoints.push(new THREE.Vector2(-halfStraightInfield, infieldRadius));
    infieldPoints.push(new THREE.Vector2(halfStraightInfield, infieldRadius));

    // 右側コーナー
    for (let i = 0; i <= 50; i++) {
      const angle = (i / 50) * Math.PI;
      const x = halfStraightInfield + infieldRadius * Math.sin(angle);
      const z = infieldRadius * Math.cos(angle);
      infieldPoints.push(new THREE.Vector2(x, z));
    }

    // 下側
    infieldPoints.push(new THREE.Vector2(halfStraightInfield, -infieldRadius));
    infieldPoints.push(new THREE.Vector2(-halfStraightInfield, -infieldRadius));

    // 左側コーナー
    for (let i = 0; i <= 50; i++) {
      const angle = Math.PI + (i / 50) * Math.PI;
      const x = -halfStraightInfield + infieldRadius * Math.sin(angle);
      const z = infieldRadius * Math.cos(angle);
      infieldPoints.push(new THREE.Vector2(x, z));
    }

    const infieldShape = new THREE.Shape(infieldPoints);
    const infieldGeometry = new THREE.ShapeGeometry(infieldShape);
    const infieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a8a3a,
      roughness: 0.9,
      metalness: 0.0,
    });
    const infield = new THREE.Mesh(infieldGeometry, infieldMaterial);
    infield.rotation.x = -Math.PI / 2;
    infield.position.y = 0.06;
    infield.receiveShadow = true;
    scene.add(infield);

    // ========== 柵（レール） ==========

    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.2,
    });

    // 外側の柵
    const outerRailPoints2D = createRaceTrackShape(
      straightLength,
      cornerRadius,
      trackWidth + 4.5,
      true,
    );
    const outerRailPoints = outerRailPoints2D.map(
      (p) => new THREE.Vector3(p.x, 5, p.y),
    );
    const outerRailPath = new THREE.CatmullRomCurve3(outerRailPoints, true);
    const outerRailTube = new THREE.Mesh(
      new THREE.TubeGeometry(outerRailPath, 1000, 0.5, 8, true),
      railMaterial,
    );
    outerRailTube.castShadow = true;
    scene.add(outerRailTube);

    // 内側の柵
    const innerRailPoints2D = createRaceTrackShape(
      straightLength,
      cornerRadius,
      trackWidth + 4.5,
      false,
    );
    const innerRailPoints = innerRailPoints2D.map(
      (p) => new THREE.Vector3(p.x, 5, p.y),
    );
    const innerRailPath = new THREE.CatmullRomCurve3(innerRailPoints, true);
    const innerRailTube = new THREE.Mesh(
      new THREE.TubeGeometry(innerRailPath, 1000, 0.5, 8, true),
      railMaterial,
    );
    innerRailTube.castShadow = true;
    scene.add(innerRailTube);

    // 柵の支柱を追加
    const postGeometry = new THREE.CylinderGeometry(0.4, 0.4, 5, 8);
    const postMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0e0e0,
      roughness: 0.4,
      metalness: 0.1,
    });

    // 外側の柵の支柱
    for (let i = 0; i < outerRailPoints.length; i += 5) {
      const point = outerRailPoints[i];
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(point.x, 2.5, point.z);
      post.castShadow = true;
      scene.add(post);
    }

    // 内側の柵の支柱
    for (let i = 0; i < innerRailPoints.length; i += 5) {
      const point = innerRailPoints[i];
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(point.x, 2.5, point.z);
      post.castShadow = true;
      scene.add(post);
    }

    // ========== レーンマーカー（白線） ==========
    const laneLineMaterial = new THREE.LineBasicMaterial({
      color: 0xf0f0f0,
      linewidth: 2,
    });

    // レーンを作成する関数
    const createLaneShape = (laneOffset: number) => {
      const points: THREE.Vector2[] = [];
      const r = cornerRadius - trackWidth / 2 + laneOffset;
      const halfStraight = straightLength / 2;

      // 上側の直線
      points.push(new THREE.Vector2(-halfStraight, r));
      points.push(new THREE.Vector2(halfStraight, r));

      // 右側のコーナー
      for (let i = 0; i <= 50; i++) {
        const angle = (i / 50) * Math.PI;
        const x = halfStraight + r * Math.sin(angle);
        const z = r * Math.cos(angle);
        points.push(new THREE.Vector2(x, z));
      }

      // 下側の直線
      points.push(new THREE.Vector2(halfStraight, -r));
      points.push(new THREE.Vector2(-halfStraight, -r));

      // 左側のコーナー
      for (let i = 0; i <= 50; i++) {
        const angle = Math.PI + (i / 50) * Math.PI;
        const x = -halfStraight + r * Math.sin(angle);
        const z = r * Math.cos(angle);
        points.push(new THREE.Vector2(x, z));
      }

      return points;
    };

    for (let lane = 0; lane < 3; lane++) {
      const laneOffset = (lane + 1) * (trackWidth / 4);
      const lanePoints2D = createLaneShape(laneOffset);
      const lanePoints = lanePoints2D.map(
        (p) => new THREE.Vector3(p.x, 0.3, p.y),
      );
      const laneGeometry = new THREE.BufferGeometry().setFromPoints(lanePoints);
      const laneLine = new THREE.LineLoop(laneGeometry, laneLineMaterial);
      scene.add(laneLine);
    }

    // ========== スタート/ゴールライン ==========

    // スタートライン（地面）- 下側直線の左端、柵と柵の間
    const startLineGeometry = new THREE.PlaneGeometry(2, trackWidth);
    const startLineMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      roughness: 0.8,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
    });
    const startLine = new THREE.Mesh(startLineGeometry, startLineMaterial);
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(-straightLength / 2, 0.35, -cornerRadius);
    scene.add(startLine);

    // ゴールライン（地面）- 1200m地点（上側直線の左端）
    // 位置: (-straightLength/2, 0, cornerRadius) = (-150, 0, 95.5)
    const goalLineGeometry = new THREE.PlaneGeometry(3, trackWidth);
    const goalLineMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      roughness: 0.8,
      emissive: 0x00ff00,
      emissiveIntensity: 0.5,
    });
    const goalLine = new THREE.Mesh(goalLineGeometry, goalLineMaterial);
    goalLine.rotation.x = -Math.PI / 2;
    goalLine.position.set(-straightLength / 2, 0.35, cornerRadius);
    scene.add(goalLine);

    // ========== スタンド作成関数 ==========
    const createStand = (x: number, z: number, rotation: number) => {
      const standGroup = new THREE.Group();

      // スタンドの段数
      const tiers = 5;
      const tierHeight = 3;
      const tierDepth = 4;
      const standWidth = 60;

      for (let i = 0; i < tiers; i++) {
        const tierGeometry = new THREE.BoxGeometry(
          standWidth,
          tierHeight,
          tierDepth,
        );
        const tierMaterial = new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0x4a5568 : 0x64748b,
          roughness: 0.7,
          metalness: 0.1,
        });
        const tier = new THREE.Mesh(tierGeometry, tierMaterial);
        tier.position.set(
          0,
          tierHeight / 2 + i * tierHeight,
          (-i * tierDepth) / 2,
        );
        tier.castShadow = true;
        tier.receiveShadow = true;
        standGroup.add(tier);
      }

      standGroup.position.set(x, 0, z);
      standGroup.rotation.y = rotation;
      return standGroup;
    };

    // ========== 距離標識 ==========
    // 距離標識を配置（200m刻み）
    // 横長スタジアム形状のトラック周りに配置
    const distances = [200, 400, 600, 800, 1000, 1200];
    const markerRadius = cornerRadius + trackWidth / 2 + 12;
    const halfStraightMarker = straightLength / 2;

    distances.forEach((dist) => {
      let x: number, z: number, lookAtAngle: number;
      // 実際のトラック上の距離計算に使用する半径（標識配置位置ではなく）
      const actualCornerLen = Math.PI * cornerRadius;
      // 実際の距離(m)をunitに変換（1unit = 4/3 m、フィールド大幅拡大）
      const distInUnits = (dist * 3) / 4;

      // トラック構成: 下側直線(0-300unit=400m) → 右側コーナー(300-600unit=400m) → 上側直線(600-900unit=400m)
      if (distInUnits <= straightLength) {
        // 下側直線（左から右）
        const progress = distInUnits / straightLength;
        x = -halfStraightMarker + straightLength * progress;
        z = -markerRadius;
        lookAtAngle = Math.PI / 2; // トラックの内側を向く
      } else if (distInUnits <= straightLength + actualCornerLen) {
        // 右側コーナー（下から上）
        const distInCorner = distInUnits - straightLength;
        const angle = (distInCorner / actualCornerLen) * Math.PI;
        x = halfStraightMarker + markerRadius * Math.sin(angle);
        z = -markerRadius * Math.cos(angle);
        lookAtAngle = -Math.PI - angle; // トラックの内側を向く
      } else {
        // 上側直線（右から左）
        const distInStraight = distInUnits - straightLength - actualCornerLen;
        const progress = distInStraight / straightLength;
        x = halfStraightMarker - straightLength * progress;
        z = markerRadius;
        lookAtAngle = -Math.PI / 2; // トラックの内側を向く
      }

      const markerGroup = new THREE.Group();

      // 支柱
      const poleGeometry = new THREE.CylinderGeometry(0.6, 0.6, 15, 8);
      const poleMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.4,
      });
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.y = 7.5;
      pole.castShadow = true;
      markerGroup.add(pole);

      // 標識板
      const signGeometry = new THREE.BoxGeometry(9, 6, 0.6);
      const signMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c3e50,
        roughness: 0.5,
      });
      const sign = new THREE.Mesh(signGeometry, signMaterial);
      sign.position.y = 18;
      sign.castShadow = true;
      markerGroup.add(sign);

      // テキスト
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 120px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${dist}m`, 256, 128);
      }
      const textTexture = new THREE.CanvasTexture(canvas);
      const textMaterial = new THREE.MeshBasicMaterial({ map: textTexture });
      const textPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(8.4, 5.4),
        textMaterial,
      );
      textPlane.position.set(0, 18, 0.35);
      markerGroup.add(textPlane);

      markerGroup.position.set(x, 0, z);
      markerGroup.rotation.y = lookAtAngle;
      scene.add(markerGroup);

      // 各距離標識の位置にスタンドを配置
      // スタンドはトラックの外側（標識のさらに外側）に配置
      const standOffsetDistance = 20; // 標識からスタンドまでの距離
      let standX: number, standZ: number, standRotation: number;

      // lookAtAngleから適切な位置とrotationを計算
      // lookAtAngleはトラックの内側を向いているので、スタンドは逆向き
      if (distInUnits <= straightLength) {
        // 下側直線
        standX = x;
        standZ = z - standOffsetDistance;
        standRotation = 0; // 北向き（トラックを見る）
      } else if (distInUnits <= straightLength + actualCornerLen) {
        // 右側コーナー
        const distInCorner = distInUnits - straightLength;
        const angle = (distInCorner / actualCornerLen) * Math.PI;
        const standRadius = markerRadius + standOffsetDistance;
        standX = halfStraightMarker + standRadius * Math.sin(angle);
        standZ = -standRadius * Math.cos(angle);
        standRotation = -Math.PI - angle; // トラックの方を向く
      } else {
        // 上側直線
        standX = x;
        standZ = z + standOffsetDistance;
        standRotation = Math.PI; // 南向き（トラックを見る）
      }

      const stand = createStand(standX, standZ, standRotation);
      scene.add(stand);
    });

    // ========== 馬のロードと配置 ==========

    // テレメトリーデータから馬の設定を生成
    const horseConfigs: HorseConfig[] = RACE_TELEMETRIES.map((telemetry) => ({
      id: telemetry.id,
      name: telemetry.name,
      color: telemetry.color,
      bibNumber: telemetry.bibNumber ?? telemetry.id, // 省略時はidを使用
      bibColor: telemetry.bibColor ?? "#DC143C", // 省略時はクリムゾン（赤）
      lane: telemetry.lane,
      checkpoints: telemetry.checkpoints,
    }));

    /**
     * チェックポイントに基づいて現在の走行距離を計算
     * @param checkpoints チェックポイント配列
     * @param elapsedTime 経過時間（秒）
     * @returns 走行距離（メートル）
     */
    const getDistanceFromCheckpoints = (
      checkpoints: Checkpoint[],
      elapsedTime: number,
    ): number => {
      // 最初のチェックポイント以前
      if (elapsedTime <= checkpoints[0].time) {
        return checkpoints[0].distance;
      }

      // 最後のチェックポイント以降
      const lastCheckpoint = checkpoints[checkpoints.length - 1];
      if (elapsedTime >= lastCheckpoint.time) {
        return lastCheckpoint.distance;
      }

      // チェックポイント間を線形補間
      for (let i = 0; i < checkpoints.length - 1; i++) {
        const current = checkpoints[i];
        const next = checkpoints[i + 1];

        if (elapsedTime >= current.time && elapsedTime <= next.time) {
          const progress =
            (elapsedTime - current.time) / (next.time - current.time);
          return (
            current.distance + (next.distance - current.distance) * progress
          );
        }
      }

      return lastCheckpoint.distance;
    };

    /**
     * チェックポイントに基づいて現在のレーンを計算
     * @param checkpoints チェックポイント配列
     * @param defaultLane 初期レーン
     * @param elapsedTime 経過時間（秒）
     * @returns レーン（0=内側、1=中間、2=外側）
     */
    const getLaneFromCheckpoints = (
      checkpoints: Checkpoint[],
      defaultLane: number,
      elapsedTime: number,
    ): number => {
      // 最初のチェックポイント以前
      if (elapsedTime <= checkpoints[0].time) {
        return checkpoints[0].lane ?? defaultLane;
      }

      // 最後のチェックポイント以降
      const lastCheckpoint = checkpoints[checkpoints.length - 1];
      if (elapsedTime >= lastCheckpoint.time) {
        return lastCheckpoint.lane ?? defaultLane;
      }

      // チェックポイント間を線形補間
      for (let i = 0; i < checkpoints.length - 1; i++) {
        const current = checkpoints[i];
        const next = checkpoints[i + 1];

        if (elapsedTime >= current.time && elapsedTime <= next.time) {
          const currentLane = current.lane ?? defaultLane;
          const nextLane = next.lane ?? defaultLane;

          const progress =
            (elapsedTime - current.time) / (next.time - current.time);
          return currentLane + (nextLane - currentLane) * progress;
        }
      }

      return lastCheckpoint.lane ?? defaultLane;
    };

    const mixers: THREE.AnimationMixer[] = [];
    // 馬のスケール: 実際の馬の体高約1.6m、トラック幅30m（22unit）に対して適切なサイズに調整
    const MODEL_SCALE = 0.02;
    const MODEL_FORWARD = Math.PI / 2;

    // 馬のモデルをロード
    const loader = new GLTFLoader();
    let isDisposed = false;

    loader.load(
      HORSE_URL,
      (gltf) => {
        if (isDisposed) return;
        const template = gltf.scene;
        template.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;

            // マテリアルの品質向上
            if (obj.material instanceof THREE.MeshStandardMaterial) {
              obj.material.roughness = 0.7;
              obj.material.metalness = 0.1;
            }
          }
        });

        const horseClip = gltf.animations[0] ?? null;

        for (let i = 0; i < horseConfigs.length; i++) {
          const config = horseConfigs[i];
          const clone = cloneSkeleton(template) as THREE.Group;
          clone.scale.setScalar(MODEL_SCALE);
          // 初期回転は設定せず、アニメーションループで動的に設定

          // 馬の体の色を設定
          clone.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (child.material instanceof THREE.MeshStandardMaterial) {
                // マテリアルをクローンして個別の色を適用
                child.material = child.material.clone();
                child.material.color.set(config.color);
              }
            }
          });

          const root = new THREE.Group();
          root.add(clone);
          scene.add(root);

          // 番号表示は一旦スキップ（馬のモデルが外部のため難しい）

          // アニメーションを設定
          if (horseClip) {
            const mixer = new THREE.AnimationMixer(clone);
            const action = mixer.clipAction(horseClip);
            action.setEffectiveWeight(1).play();
            mixers.push(mixer);
          }

          // スタート位置: 下直線の始まり（左側）- 右回り
          const startDistance = 0; // 右回りトラックの開始位置
          horseNodesRef.current.push({
            root,
            config,
            offset: startDistance, // 全ての馬をスタート位置に配置
            goalCrossingTime: null, // ゴール未通過
          });
        }
      },
      undefined,
      (error) => {
        console.error("Failed to load horse model", error);
      },
    );

    // ========== アニメーションループ ==========
    const clock = new THREE.Clock();
    let cameraAngle = 0;

    function animate() {
      const delta = clock.getDelta();

      // レース中のみ時間を進める
      if (isRacingRef.current && isTimerRunningRef.current) {
        // レース開始時刻を記録（初回のみ）
        if (startTimeRef.current === 0) {
          startTimeRef.current = performance.now();
        }

        // performance.now()で実際の経過時間を正確に測定
        const currentTime = performance.now();
        elapsedRef.current = (currentTime - startTimeRef.current) / 1000; // ミリ秒→秒

        // 表示用のstateは0.05秒ごとに更新（更新頻度を制限してパフォーマンス向上）
        if (elapsedRef.current - lastUpdateRef.current >= 0.05) {
          setRaceTime(elapsedRef.current);
          lastUpdateRef.current = elapsedRef.current;
        }
      }

      // 馬のアニメーションを更新（レース中のみ）
      if (isRacingRef.current && mixers.length > 0) {
        for (const mixer of mixers) {
          mixer.update(delta);
        }
      }

      // トラック上の位置を計算する関数（横長トラック用・右回り）
      const getTrackPosition = (
        distance: number,
        laneRadius: number,
      ): { x: number; z: number; heading: number } => {
        const halfStraight = straightLength / 2;
        const straightLen = straightLength;
        const cornerLen = Math.PI * laneRadius;
        const totalLen = straightLen * 2 + cornerLen * 2;

        // ゴール地点（上側直線の左端）
        const goalDist = straightLen * 2 + cornerLen;

        // ゴールを超えた場合は、上側直線をそのまま左に進み続ける
        if (distance >= goalDist) {
          const overGoal = distance - goalDist;
          return {
            x: -halfStraight - overGoal,
            z: laneRadius,
            heading: Math.PI, // 左向き
          };
        }

        // 距離を正規化（0～totalLen）
        const normalizedDist = ((distance % totalLen) + totalLen) % totalLen;

        // 下側直線（左から右）: 0 ~ straightLen - 右回りのスタート
        if (normalizedDist < straightLen) {
          const t = normalizedDist / straightLen;
          return {
            x: -halfStraight + straightLen * t,
            z: -laneRadius,
            heading: 0, // 右向き
          };
        }

        // 右側コーナー（下から上）: straightLen ~ straightLen + cornerLen
        const dist1 = normalizedDist - straightLen;
        if (dist1 < cornerLen) {
          const angle = (dist1 / cornerLen) * Math.PI;
          return {
            x: halfStraight + laneRadius * Math.sin(angle),
            z: -laneRadius * Math.cos(angle),
            heading: angle,
          };
        }

        // 上側直線（右から左）: straightLen + cornerLen ~ straightLen*2 + cornerLen
        const dist2 = dist1 - cornerLen;
        if (dist2 < straightLen) {
          const t = dist2 / straightLen;
          return {
            x: halfStraight - straightLen * t,
            z: laneRadius,
            heading: Math.PI, // 左向き
          };
        }

        // 左側コーナー（上から下）: straightLen*2 + cornerLen ~ totalLen
        const dist3 = dist2 - straightLen;
        const angle = Math.PI + (dist3 / cornerLen) * Math.PI;
        return {
          x: -halfStraight + laneRadius * Math.sin(angle),
          z: laneRadius * Math.cos(angle),
          heading: angle,
        };
      };

      // 馬の位置を更新（新しいトラック形状に沿って移動）
      for (let i = 0; i < horseNodesRef.current.length; i++) {
        const horse = horseNodesRef.current[i];
        const config = horse.config;

        // 現在のレーンを取得（チェックポイント間で補間）
        const currentLane = getLaneFromCheckpoints(
          config.checkpoints,
          config.lane,
          elapsedRef.current,
        );

        // レーンに応じた半径を計算（0=内側、1=中間、2=外側）
        // currentLaneは0-2の範囲で補間される
        const laneR =
          cornerRadius - trackWidth / 2 + trackWidth * ((currentLane + 1) / 4);

        // チェックポイントに基づいて現在の走行距離を計算（メートル）
        let distanceInMeters = getDistanceFromCheckpoints(
          config.checkpoints,
          elapsedRef.current,
        );

        // ゴール通過後の追加移動を計算
        const lastCheckpoint =
          config.checkpoints[config.checkpoints.length - 1];
        const secondLastCheckpoint =
          config.checkpoints[config.checkpoints.length - 2];

        // 最後の区間の平均速度を計算（m/s）
        const finalVelocity =
          secondLastCheckpoint && lastCheckpoint
            ? (lastCheckpoint.distance - secondLastCheckpoint.distance) /
              (lastCheckpoint.time - secondLastCheckpoint.time)
            : 0;

        // ゴール（1200m）を超えた場合、2秒間は走り続ける
        if (elapsedRef.current >= lastCheckpoint.time) {
          const timeAfterGoal = elapsedRef.current - lastCheckpoint.time;

          // ゴール通過時刻を記録（初回のみ）
          if (horse.goalCrossingTime === null) {
            horse.goalCrossingTime = elapsedRef.current;
          }

          // ゴール後2秒間は最後の速度で走り続ける
          if (timeAfterGoal < 2.0) {
            distanceInMeters =
              lastCheckpoint.distance + finalVelocity * timeAfterGoal;
          } else {
            // 2秒経過したら停止（ゴール + 2秒分の距離で固定）
            distanceInMeters = lastCheckpoint.distance + finalVelocity * 2.0;
          }
        }

        // 全ての馬がゴール後2秒経過したかチェック
        const allHorsesFinished = horseNodesRef.current.every(
          (h) =>
            h.goalCrossingTime !== null &&
            elapsedRef.current - h.goalCrossingTime >= 2.0,
        );

        // 全馬が完全に終了したらタイマーを停止
        if (allHorsesFinished && isTimerRunningRef.current) {
          isTimerRunningRef.current = false;
        }

        // メートルをunitsに変換（1unit = 4/3 m → メートル × 3/4 = units）
        const distance = horse.offset + (distanceInMeters * 3) / 4;

        const pos = getTrackPosition(distance, laneR);

        horse.root.position.set(pos.x, 0.3, pos.z);
        horse.root.rotation.y = pos.heading + MODEL_FORWARD;
      }

      // カメラモードに応じてカメラを制御
      if (
        typeof cameraModeRef.current === "number" &&
        horseNodesRef.current.length > 0
      ) {
        // 騎手目線モード：指定された馬を追跡
        const targetHorse = horseNodesRef.current[cameraModeRef.current];
        if (targetHorse && targetHorse.root) {
          // 馬の位置と向きを取得
          const horsePos = targetHorse.root.position;
          const horseRotation = targetHorse.root.rotation.y;

          // 馬の進行方向ベクトル（heading=0で右向き=X軸正の方向）
          // horseRotationはMODEL_FORWARDオフセット済みなので、実際の進行方向を得るために補正
          const actualHeading = horseRotation - MODEL_FORWARD;
          const forwardX = Math.cos(actualHeading);
          const forwardZ = Math.sin(actualHeading);

          // カメラを馬の後ろ上方に配置
          const cameraBackOffset = 2; // 後ろ方向のオフセット（馬に近づける）
          const cameraHeight = 5; // 高さ（馬より上）

          // カメラを馬の後方に配置（符号を逆に）
          const cameraX = horsePos.x - forwardX * cameraBackOffset;
          const cameraY = horsePos.y + cameraHeight;
          const cameraZ = horsePos.z - forwardZ * cameraBackOffset;

          camera.position.set(cameraX, cameraY, cameraZ);

          // 馬の前方を見る（符号を逆に）
          const lookAtDistance = 20;
          const lookAtX = horsePos.x + forwardX * lookAtDistance;
          const lookAtY = horsePos.y + 1.0;
          const lookAtZ = horsePos.z + forwardZ * lookAtDistance;

          camera.lookAt(lookAtX, lookAtY, lookAtZ);

          // コントロールを無効化
          controls.enabled = false;
        }
      } else {
        // 俯瞰モード：通常のOrbitControlsを使用
        controls.enabled = true;
        controls.update();

        // カメラの自動回転（cameraAutoRotateがtrueの場合のみ）
        if (cameraAutoRotate) {
          cameraAngle += 0.002;
          const radius = 380;
          camera.position.x = radius * Math.sin(cameraAngle);
          camera.position.z = radius * Math.cos(cameraAngle);
          camera.position.y = 250 + Math.sin(cameraAngle * 0.5) * 30;
          camera.lookAt(0, 0, 0);
        }
      }

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
      isDisposed = true;
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      controls.dispose();
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [cameraAutoRotate, numberOfHorses]);

  const handleStartRace = () => {
    setIsRacing(true);
    setRaceTime(0);
    elapsedRef.current = 0;
    lastUpdateRef.current = 0;
    startTimeRef.current = 0; // performance.now()の開始時刻をリセット
    isTimerRunningRef.current = true; // タイマーを開始

    // 全ての馬のゴール通過時刻をリセット
    for (const horse of horseNodesRef.current) {
      horse.goalCrossingTime = null;
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        ref={mountRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
      {!isRacing && (
        <button
          onClick={handleStartRace}
          style={{
            position: "absolute",
            top: "15%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            padding: "20px 40px",
            fontSize: "24px",
            fontWeight: "bold",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
          }}
        >
          スタート
        </button>
      )}
      {isRacing && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: "12px 30px",
            fontSize: "28px",
            fontWeight: "bold",
            borderRadius: "8px",
            fontFamily: "monospace",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
          }}
        >
          {raceTime.toFixed(2)}秒
        </div>
      )}
      {/* 視点切り替えボタン */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <button
          onClick={() => setCameraMode("overview")}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            fontWeight: "bold",
            backgroundColor: cameraMode === "overview" ? "#2196F3" : "#757575",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            transition: "background-color 0.3s",
          }}
        >
          俯瞰視点
        </button>
        <button
          onClick={() => setCameraMode(0)}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            fontWeight: "bold",
            backgroundColor: cameraMode === 0 ? "#2196F3" : "#757575",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            transition: "background-color 0.3s",
          }}
        >
          騎手目線 (馬A)
        </button>
        <button
          onClick={() => setCameraMode(1)}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            fontWeight: "bold",
            backgroundColor: cameraMode === 1 ? "#2196F3" : "#757575",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            transition: "background-color 0.3s",
          }}
        >
          騎手目線 (馬B)
        </button>
      </div>
    </div>
  );
}
