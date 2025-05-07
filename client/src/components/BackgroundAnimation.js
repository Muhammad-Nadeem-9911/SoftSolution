import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Component for the animated points
function AnimatedPoints() {
  const pointsRef = useRef();

  // Generate random points in a sphere
  const particles = useMemo(() => {
    const count = 5000; // Number of points
    const positions = new Float32Array(count * 3);
    const radius = 5; // Radius of the sphere
    for (let i = 0; i < count * 3; i++) {
      // Distribute points somewhat evenly in a sphere volume
      const r = radius * Math.cbrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    return positions;
  }, []);

  // Animation loop
  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.x += delta * 0.02;
      pointsRef.current.rotation.y += delta * 0.03;
    }
  });

  return (
    <Points ref={pointsRef} positions={particles} stride={3} frustumCulled={false}>
      <PointMaterial transparent color="#555555" size={0.015} sizeAttenuation={true} depthWrite={false} />
    </Points>
  );
}

// Main background component using Canvas
const BackgroundAnimation = () => {
  return (
    <Canvas camera={{ position: [0, 0, 1] }} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}>
      <ambientLight intensity={0.5} />
      <AnimatedPoints />
    </Canvas>
  );
};

export default BackgroundAnimation;