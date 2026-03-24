/**
 * World.js
 * Manages the static geometry of the current level (walls, floor, ceiling).
 * Provides collision detection for Player movement.
 */

import * as THREE from 'three';

/** AABB-style wall record used for collision. */
class Wall {
  /**
   * @param {number} minX
   * @param {number} maxX
   * @param {number} minZ
   * @param {number} maxZ
   */
  constructor(minX, maxX, minZ, maxZ) {
    this.minX = minX; this.maxX = maxX;
    this.minZ = minZ; this.maxZ = maxZ;
  }

  /** @param {THREE.Vector3} pos @param {number} radius */
  intersects(pos, radius) {
    return pos.x - radius < this.maxX &&
           pos.x + radius > this.minX &&
           pos.z - radius < this.maxZ &&
           pos.z + radius > this.minZ;
  }
}

export class World {
  /** @type {THREE.Scene} */
  _scene;
  /** @type {Wall[]} */
  _walls = [];
  /** @type {THREE.Object3D[]} */
  _objects = [];
  /** @type {THREE.Mesh[]} wall meshes only — used for enemy LOS raycasting */
  _wallMeshList = [];

  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this._scene = scene;
  }

  /** Remove all world geometry (for level transitions). */
  clear() {
    for (const obj of this._objects) {
      this._scene.remove(obj);
    }
    this._objects = [];
    this._walls   = [];
    this._wallMeshList = [];
  }

  // ─── Geometry Helpers ─────────────────────────────────────────────────────

  /**
   * Add a floor plane.
   * @param {number} width
   * @param {number} depth
   * @param {THREE.MeshStandardMaterial} material
   * @param {number} [cx=0] @param {number} [cz=0]
   */
  addFloor(width, depth, material, cx = 0, cz = 0) {
    const geo  = new THREE.PlaneGeometry(width, depth);
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, 0, cz);
    mesh.receiveShadow = true;
    this._add(mesh);
  }

  /**
   * Add a ceiling plane.
   */
  addCeiling(width, depth, material, cx = 0, cz = 0, height = 4) {
    const geo  = new THREE.PlaneGeometry(width, depth);
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(cx, height, cz);
    mesh.receiveShadow = true;
    this._add(mesh);
  }

  /**
   * Add an axis-aligned wall box and register its AABB for collision.
   * @param {number} cx @param {number} cz  centre
   * @param {number} w  @param {number} d   width / depth
   * @param {number} h  height
   * @param {THREE.MeshStandardMaterial} material
   */
  addWall(cx, cz, w, d, h, material) {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    this._add(mesh);
    this._wallMeshList.push(mesh); // track for LOS raycasting

    // Register AABB
    this._walls.push(new Wall(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2));
  }

  /**
   * Wall meshes only — used by enemies for line-of-sight raycasting.
   * @returns {THREE.Mesh[]}
   */
  get wallMeshes() { return this._wallMeshList; }

  /**
   * Add a decorative static prop (box, no collision).
   */
  addProp(cx, cy, cz, w, h, d, material) {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    this._add(mesh);
    return mesh;
  }

  // ─── Collision ─────────────────────────────────────────────────────────────

  /**
   * Returns true if the position (with given radius) overlaps any wall.
   * @param {THREE.Vector3} pos
   * @param {number} radius
   */
  isBlocked(pos, radius) {
    return this._walls.some((w) => w.intersects(pos, radius));
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** @private */
  _add(obj) {
    this._scene.add(obj);
    this._objects.push(obj);
  }
}
