"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Vec3 = [number, number, number];

const BASE_HEIGHT = 1.16;

const SKIN = ["#f2c7a3", "#c88a65", "#9a6a4e"];
const HAIR = ["#171311", "#3a2a20", "#8c6239"];

export interface HumanCharacterProps {
  position?: Vec3;
  color?: string;
  height?: number;
  pace?: number;
  rotationY?: number;
  variant?: "resident" | "greeter" | "engineer";
}

function pick(seed: number, values: string[]) {
  return values[Math.abs(Math.floor(seed)) % values.length];
}

export default function HumanCharacter({
  position = [0, 0, 0],
  color = "#7fe7e0",
  height = 1,
  pace = 0,
  rotationY = 0,
  variant = "resident",
}: HumanCharacterProps) {
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const phase = useMemo(() => position[0] * 1.7 + position[2] * 2.3, [position]);
  const scale = height / BASE_HEIGHT;

  const palette = useMemo(() => {
    const seed = position[0] * 17 + position[2] * 31 + height * 11;
    return {
      skin: pick(seed, SKIN),
      hair: pick(seed + 1, HAIR),
      shirt: variant === "engineer" ? "#cfd8e3" : color,
      jacket: variant === "greeter" ? "#102a36" : "#203041",
      pants: variant === "greeter" ? "#172332" : "#26323d",
    };
  }, [color, height, position, variant]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const walk = pace > 0 ? Math.sin(t * 4.6 + phase) : Math.sin(t * 1.8 + phase) * 0.22;
    if (root.current) {
      root.current.position.y = position[1] + Math.abs(Math.sin(t * 2.4 + phase)) * 0.035;
      root.current.rotation.y = rotationY;
      if (pace > 0) {
        root.current.position.x = position[0] + Math.sin(t * 0.6 + phase) * pace;
        root.current.rotation.y =
          (Math.cos(t * 0.6 + phase) > 0 ? Math.PI * 0.5 : -Math.PI * 0.5) + rotationY;
      }
    }
    if (leftArm.current) leftArm.current.rotation.x = walk * 0.45;
    if (rightArm.current) rightArm.current.rotation.x = -walk * 0.45;
    if (leftLeg.current) leftLeg.current.rotation.x = -walk * 0.32;
    if (rightLeg.current) rightLeg.current.rotation.x = walk * 0.32;
  });

  return (
    <group ref={root} position={position} rotation={[0, rotationY, 0]}>
      <group scale={scale}>
        <group ref={leftLeg} position={[-0.075, 0.44, 0]}>
          <mesh position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.036, 0.046, 0.38, 10]} />
            <meshStandardMaterial color={palette.pants} roughness={0.72} />
          </mesh>
          <mesh position={[0, -0.405, 0.045]}>
            <boxGeometry args={[0.1, 0.045, 0.16]} />
            <meshStandardMaterial color="#0c1118" roughness={0.75} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.075, 0.44, 0]}>
          <mesh position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.036, 0.046, 0.38, 10]} />
            <meshStandardMaterial color={palette.pants} roughness={0.72} />
          </mesh>
          <mesh position={[0, -0.405, 0.045]}>
            <boxGeometry args={[0.1, 0.045, 0.16]} />
            <meshStandardMaterial color="#0c1118" roughness={0.75} />
          </mesh>
        </group>

        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.22, 0.1, 0.16]} />
          <meshStandardMaterial color={palette.pants} roughness={0.74} />
        </mesh>
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.14, 0.17, 0.36, 10]} />
          <meshStandardMaterial color={palette.shirt} roughness={0.65} />
        </mesh>
        {(variant === "greeter" || variant === "engineer") && (
          <mesh position={[0, 0.66, 0.093]}>
            <boxGeometry args={[0.2, 0.24, 0.018]} />
            <meshStandardMaterial
              color={variant === "engineer" ? "#f0b84f" : palette.jacket}
              roughness={0.62}
            />
          </mesh>
        )}

        <group ref={leftArm} position={[-0.18, 0.78, 0]} rotation={[0, 0, 0.2]}>
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.03, 0.038, 0.3, 10]} />
            <meshStandardMaterial color={palette.shirt} roughness={0.68} />
          </mesh>
          <mesh position={[0, -0.31, 0]}>
            <sphereGeometry args={[0.044, 12, 8]} />
            <meshStandardMaterial color={palette.skin} roughness={0.7} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.18, 0.78, 0]} rotation={[0, 0, -0.2]}>
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.03, 0.038, 0.3, 10]} />
            <meshStandardMaterial color={palette.shirt} roughness={0.68} />
          </mesh>
          <mesh position={[0, -0.31, 0]}>
            <sphereGeometry args={[0.044, 12, 8]} />
            <meshStandardMaterial color={palette.skin} roughness={0.7} />
          </mesh>
        </group>

        <mesh position={[0, 0.86, 0]}>
          <cylinderGeometry args={[0.045, 0.04, 0.08, 10]} />
          <meshStandardMaterial color={palette.skin} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.0, 0.005]}>
          <sphereGeometry args={[0.13, 18, 12]} />
          <meshStandardMaterial color={palette.skin} roughness={0.68} />
        </mesh>
        <mesh position={[0, 1.04, -0.012]}>
          <sphereGeometry args={[0.132, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={palette.hair} roughness={0.76} />
        </mesh>
        <mesh position={[-0.043, 1.01, 0.114]}>
          <sphereGeometry args={[0.011, 8, 6]} />
          <meshStandardMaterial color="#111827" roughness={0.4} />
        </mesh>
        <mesh position={[0.043, 1.01, 0.114]}>
          <sphereGeometry args={[0.011, 8, 6]} />
          <meshStandardMaterial color="#111827" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.965, 0.124]}>
          <boxGeometry args={[0.055, 0.009, 0.012]} />
          <meshStandardMaterial color="#7c3f34" roughness={0.7} />
        </mesh>

        {variant === "engineer" && (
          <mesh position={[0, 1.105, 0.012]}>
            <sphereGeometry args={[0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color="#f0b84f" roughness={0.55} metalness={0.02} />
          </mesh>
        )}
        {variant === "greeter" && (
          <mesh position={[0.15, 0.58, 0.13]} rotation={[0.18, 0.25, -0.14]}>
            <boxGeometry args={[0.16, 0.2, 0.018]} />
            <meshStandardMaterial color="#101923" roughness={0.55} metalness={0.2} />
          </mesh>
        )}
      </group>
    </group>
  );
}
