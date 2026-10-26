import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Book } from '../db/types';
import { Book3D, bookDims } from './Book3D';

/** Spin state shared with the DOM drag layer: angle in radians, velocity in rad/s. */
export interface Spin { angle: number; vel: number; dragging: boolean; dir: number; touched?: boolean }

const DIST = 0.6;

/**
 * The picked book, big and centred in front of the camera. Drag spins it all the way round;
 * when the book changes it slides in from the side it came from.
 */
export function Viewer({ book, spin, untitled }: { book: Book | null; spin: React.MutableRefObject<Spin>; untitled: string }) {
  const { camera } = useThree();
  const group = useRef<THREE.Group>(null);
  const shade = useRef<THREE.Mesh>(null);
  const st = useRef({ show: 0, enter: 1, key: '' });
  const shadeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, depthWrite: false }), []);
  const dims = book ? bookDims(book) : null;

  useEffect(() => {
    if (book && st.current.key !== book.id) { st.current.key = book.id; st.current.enter = 0; spin.current.angle = -0.5; spin.current.touched = false; spin.current.vel = 0; }
  }, [book?.id]);

  useFrame((_, dt) => {
    const g = group.current;
    const s = st.current;
    const sp = spin.current;
    s.show += ((book ? 1 : 0) - s.show) * Math.min(1, dt * 8);
    s.enter += (1 - s.enter) * Math.min(1, dt * 7);
    if (!sp.dragging) {
      sp.angle += sp.vel * dt;
      sp.vel *= Math.pow(0.04, dt); // friction
      if (!sp.touched) {
        // before the first drag: rest three-quarters on, so both cover and spine show, with a slow sway
        const rest = -0.5 + Math.sin(performance.now() / 1500) * 0.12;
        sp.angle += (rest - sp.angle) * Math.min(1, dt * 2.5);
      }
    }
    shadeMat.opacity = 0.55 * s.show;
    const cam = camera as THREE.PerspectiveCamera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    if (shade.current) {
      shade.current.position.copy(cam.position).addScaledVector(fwd, DIST + 0.25);
      shade.current.quaternion.copy(cam.quaternion);
      shade.current.visible = s.show > 0.01;
    }
    if (!g || !dims) return;
    const viewH = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const scale = (viewH * 0.33) / dims.h;
    const slide = (1 - s.enter) * sp.dir * 0.25;
    g.position.copy(cam.position).addScaledVector(fwd, DIST).addScaledVector(up, viewH * 0.08 - (dims.h * scale) / 2).addScaledVector(right, slide);
    g.quaternion.copy(cam.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, -Math.PI / 2 + sp.angle, 0)));
    g.scale.setScalar(scale * (0.85 + 0.15 * s.show) * (0.8 + 0.2 * s.enter));
    g.visible = s.show > 0.01;
  });

  return (
    <>
      <mesh ref={shade} material={shadeMat} renderOrder={10}>
        <planeGeometry args={[20, 20]} />
      </mesh>
      {book && (
        <group ref={group} renderOrder={11}>
          <Book3D key={book.id} book={book} untitled={untitled} position={[0, 0, 0]} rotationY={0} />
          <pointLight position={[0.3, 0.3, 0.6]} intensity={1.2} distance={2} />
          <pointLight position={[-0.4, 0.1, 0.3]} intensity={0.5} distance={2} color="#c9d6ff" />
        </group>
      )}
    </>
  );
}
