"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const CRIMSON = new THREE.Color("#DA3633");
const CYAN = new THREE.Color("#00C8D7");
const INK = new THREE.Color("#F3F6FA");

function Ring({ radius, tube = 0.006, color, speed, tilt }: { radius: number; tube?: number; color: THREE.Color; speed: [number, number, number]; tilt: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.x += speed[0] * dt;
    ref.current.rotation.y += speed[1] * dt;
    ref.current.rotation.z += speed[2] * dt;
  });
  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, tube, 8, 160]} />
      <meshBasicMaterial color={color} transparent opacity={0.75} />
    </mesh>
  );
}

/** Tick ring: short radial segments like an instrument bezel. */
function Bezel({ radius, count, color }: { radius: number; count: number; color: THREE.Color }) {
  const ref = useRef<THREE.LineSegments>(null);
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const len = i % 5 === 0 ? 0.09 : 0.04;
      pts.push(Math.cos(a) * radius, Math.sin(a) * radius, 0, Math.cos(a) * (radius + len), Math.sin(a) * (radius + len), 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [radius, count]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z -= 0.04 * dt;
  });
  return (
    <lineSegments ref={ref} geometry={geo}>
      <lineBasicMaterial color={color} transparent opacity={0.35} />
    </lineSegments>
  );
}

/** Particles streaming from left (crimson) and right (cyan) into the core. */
function Streams({ count = 420 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      seeds[i * 3] = side;
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = (Math.random() - 0.5) * 1.6;
      const c = side < 0 ? CRIMSON : CYAN;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    return { positions, colors, seeds };
  }, [count]);

  useFrame(({ clock }) => {
    const pts = ref.current;
    if (!pts) return;
    const t = clock.getElapsedTime();
    const arr = pts.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const side = seeds[i * 3];
      const p = (seeds[i * 3 + 1] + t * 0.12) % 1; // 0 → 1 progress toward core
      const lane = seeds[i * 3 + 2];
      const x = side * (2.6 * (1 - p) + 0.18);
      const y = lane * (1 - p) * (1 - p) + Math.sin(t * 1.4 + i) * 0.01;
      const z = Math.sin(p * Math.PI) * 0.25 * lane;
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.022} vertexColors transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

function Nucleus({ pointer }: { pointer: PointerRef }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const p = pointer.current ?? { x: 0, y: 0 };
    if (group.current) {
      group.current.rotation.y += (p.x * 0.45 - group.current.rotation.y) * 0.04;
      group.current.rotation.x += (p.y * 0.3 - group.current.rotation.x) * 0.04;
    }
    if (inner.current) {
      inner.current.rotation.y += dt * 0.35;
      inner.current.rotation.x += dt * 0.12;
      const s = 1 + Math.sin(t * 2.2) * 0.035;
      inner.current.scale.setScalar(s);
    }
  });
  return (
    <group ref={group}>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.36, 1]} />
        <meshBasicMaterial color={INK} wireframe transparent opacity={0.55} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.13, 24, 24]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <Ring radius={0.62} color={CRIMSON} speed={[0.12, 0.2, 0]} tilt={[1.2, 0.2, 0]} />
      <Ring radius={0.74} color={CYAN} speed={[-0.08, 0.14, 0.05]} tilt={[0.4, 1.1, 0]} />
      <Ring radius={0.9} tube={0.003} color={INK} speed={[0.05, -0.06, 0.02]} tilt={[1.5, 0, 0.6]} />
      <Bezel radius={1.06} count={120} color={INK} />
    </group>
  );
}

export type PointerRef = React.RefObject<{ x: number; y: number }>;

function FirstFrame({ onReady }: { onReady: () => void }) {
  const called = useRef(false);
  useFrame(() => {
    if (!called.current) {
      called.current = true;
      queueMicrotask(onReady);
    }
  });
  return null;
}

export default function CoreScene({ active, pointer, onReady }: { active: boolean; pointer: PointerRef; onReady: () => void }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <FirstFrame onReady={onReady} />
      <Streams />
      <Nucleus pointer={pointer} />
    </Canvas>
  );
}
