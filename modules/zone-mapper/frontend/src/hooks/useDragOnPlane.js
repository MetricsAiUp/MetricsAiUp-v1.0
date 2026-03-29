import { useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();
const _intersection = new THREE.Vector3();

export default function useDragOnPlane({
  planeNormal = new THREE.Vector3(0, 1, 0),
  planeConstant = 0,
  onDragStart,
  onDrag,
  onDragEnd,
  enabled = true,
  orbitControlsRef,
}) {
  const { camera, gl } = useThree();
  const dragging = useRef(false);
  const startPoint = useRef(new THREE.Vector3());
  const startValue = useRef(null);
  const didDrag = useRef(false);
  const plane = useRef(new THREE.Plane());

  const getIntersection = useCallback((e) => {
    const rect = gl.domElement.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_pointer, camera);
    const hit = _raycaster.ray.intersectPlane(plane.current, _intersection);
    return hit ? _intersection.clone() : null;
  }, [camera, gl]);

  const onPointerDown = useCallback((e) => {
    if (!enabled || e.button !== 0) return;
    e.stopPropagation();

    plane.current.set(planeNormal, planeConstant);

    const point = getIntersection(e.nativeEvent || e);
    if (!point) return;

    dragging.current = true;
    didDrag.current = false;
    startPoint.current.copy(point);

    if (onDragStart) {
      startValue.current = onDragStart(point);
    }

    if (orbitControlsRef?.current) {
      orbitControlsRef.current.enabled = false;
    }

    gl.domElement.setPointerCapture(e.pointerId);
  }, [enabled, planeNormal, planeConstant, getIntersection, onDragStart, orbitControlsRef, gl]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    e.stopPropagation();

    const point = getIntersection(e.nativeEvent || e);
    if (!point) return;

    const delta = point.clone().sub(startPoint.current);
    if (delta.length() > 0.01) didDrag.current = true;

    if (onDrag) {
      onDrag(delta, startValue.current, point);
    }
  }, [getIntersection, onDrag]);

  const onPointerUp = useCallback((e) => {
    if (!dragging.current) return;
    e.stopPropagation();
    dragging.current = false;

    if (orbitControlsRef?.current) {
      orbitControlsRef.current.enabled = true;
    }

    try { gl.domElement.releasePointerCapture(e.pointerId); } catch {}

    if (didDrag.current && onDragEnd) {
      onDragEnd();
    }
  }, [orbitControlsRef, gl, onDragEnd]);

  return { onPointerDown, onPointerMove, onPointerUp, didDrag };
}
