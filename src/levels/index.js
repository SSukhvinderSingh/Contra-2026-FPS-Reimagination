/**
 * levels/index.js
 * All 5 level definitions — geometry, enemy placement, and metadata.
 * Each level is a function that receives (World, scene, audio, gemini) and builds itself.
 */

import * as THREE from 'three';
import { Enemy } from '../game/Enemy.js';
import { BossEnemy } from '../game/BossEnemy.js';

// ─── Shared Material Factory ──────────────────────────────────────────────────

/**
 * @param {number} color
 * @param {number} [roughness=0.9]
 */
const mat = (color, roughness = 0.9) =>
  new THREE.MeshStandardMaterial({ color, roughness });

// ─── Level Metadata ───────────────────────────────────────────────────────────

export const LEVEL_META = [
  { number: 1, name: 'Jungle Outpost', theme: 'Dense jungle at dawn, Red Falcon foot soldiers guard a fortified outpost' },
  { number: 2, name: 'Underground Lab', theme: 'Dark underground research corridors, armed scientists and elite guards' },
  { number: 3, name: 'Commander Gorza', theme: 'War-room command centre, brutalist concrete, flickering lights' },
  { number: 4, name: 'Alien Hive', theme: 'Organic pulsing alien caverns, bioluminescent walls, drone swarms' },
  { number: 5, name: 'Red Falcon Core', theme: 'Alien reactor core, massive glowing pillars, end-of-world energy' },
];

// ─── Level Builders ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} LevelResult
 * @property {THREE.Vector3} spawnPos
 * @property {import('../game/Enemy.js').Enemy[]} enemies
 * @property {THREE.Vector3} exitPos  - player must reach this to complete level
 */

/**
 * Level 1 — Jungle Outpost
 * Open courtyard with jungle walls and 5 patrolling soldiers.
 * @param {import('../game/World.js').World} world
 * @param {THREE.Scene} scene
 * @param {import('../engine/AudioManager.js').AudioManager} audio
 * @param {import('../ai/GeminiService.js').GeminiService} gemini
 * @returns {LevelResult}
 */
export function buildLevel1(world, scene, audio, _gemini) {
  const FLOOR = mat(0x3a5a2a); // mossy green
  const WALL = mat(0x2d4422); // dark jungle wood
  const ROOF = mat(0x1a2a10);

  const SIZE = 40;
  world.addFloor(SIZE, SIZE, FLOOR);
  world.addCeiling(SIZE, SIZE, ROOF, 0, 0, 5);

  // Perimeter walls
  world.addWall(0, -SIZE / 2, SIZE, 1, 5, WALL); // north
  world.addWall(0, SIZE / 2, SIZE, 1, 5, WALL); // south
  world.addWall(-SIZE / 2, 0, 1, SIZE, 5, WALL); // west
  world.addWall(SIZE / 2, 0, 1, SIZE, 5, WALL); // east

  // Interior cover objects (jungle debris)
  world.addWall(-6, -5, 4, 1.5, 2, mat(0x4a3820)); // log barricade
  world.addWall(6, -5, 4, 1.5, 2, mat(0x4a3820));
  world.addWall(0, 5, 1.5, 4, 3, mat(0x2d4422)); // bunker pillar
  world.addWall(-8, 8, 3, 3, 2.5, mat(0x3a5a2a));  // crate stack
  world.addWall(8, 8, 3, 3, 2.5, mat(0x3a5a2a));

  // Exit marker — glowing green pillar
  const exitGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
  const exitMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.5,
  });
  const exitPillar = new THREE.Mesh(exitGeo, exitMat);
  exitPillar.position.set(0, 1.5, -17);
  scene.add(exitPillar);

  // Point lights for atmosphere
  const addLight = (x, z, col) => {
    const l = new THREE.PointLight(col, 1.5, 15);
    l.position.set(x, 3, z);
    scene.add(l);
  };
  addLight(-10, -10, 0x88ff44);
  addLight(10, 10, 0x44aa22);
  addLight(0, 0, 0xffee88);

  // Enemies — 5 foot soldiers with patrol routes
  const enemies = [
    new Enemy(scene, new THREE.Vector3(-10, 0, -5), [
      new THREE.Vector3(-10, 0, -5),
      new THREE.Vector3(-10, 0, 5),
    ], audio),
    new Enemy(scene, new THREE.Vector3(10, 0, -5), [
      new THREE.Vector3(10, 0, -5),
      new THREE.Vector3(10, 0, 5),
    ], audio),
    new Enemy(scene, new THREE.Vector3(0, 0, -10), [
      new THREE.Vector3(-5, 0, -10),
      new THREE.Vector3(5, 0, -10),
    ], audio),
    new Enemy(scene, new THREE.Vector3(-8, 0, 5), [
      new THREE.Vector3(-8, 0, 5),
      new THREE.Vector3(0, 0, 5),
    ], audio),
    new Enemy(scene, new THREE.Vector3(8, 0, 5), [
      new THREE.Vector3(8, 0, 5),
      new THREE.Vector3(8, 0, -5),
    ], audio),
  ];

  return {
    spawnPos: new THREE.Vector3(0, 1.7, 15),
    enemies,
    exitPos: new THREE.Vector3(0, 1.7, -17),
  };
}

/**
 * Level 2 — Underground Lab
 * Corridor maze with 7 guards. Enemies taunt the player via Gemini.
 */
export function buildLevel2(world, scene, audio, _gemini) {
  const FLOOR = mat(0x1a1a2a);
  const WALL = mat(0x2a2a3e);
  const CEIL = mat(0x0d0d18);

  const W = 50, D = 50;
  world.addFloor(W, D, FLOOR);
  world.addCeiling(W, D, CEIL, 0, 0, 4);

  // Outer walls
  world.addWall(0, -D / 2, W, 1, 4, WALL);
  world.addWall(0, D / 2, W, 1, 4, WALL);
  world.addWall(-W / 2, 0, 1, D, 4, WALL);
  world.addWall(W / 2, 0, 1, D, 4, WALL);

  // Corridor dividers — creates an L-shaped maze feel
  world.addWall(-10, -8, 1, 16, 4, WALL);
  world.addWall(10, -8, 1, 16, 4, WALL);
  world.addWall(0, 0, 20, 1, 4, WALL);
  world.addWall(-15, 8, 1, 14, 4, WALL);
  world.addWall(15, 8, 1, 14, 4, WALL);

  // Lab equipment props (no collision, visual only)
  const addProp = (x, y, z, w, h, d, col) =>
    world.addProp(x, y, z, w, h, d, mat(col, 0.4));
  addProp(-5, 0.75, -12, 1.5, 1.5, 1, 0x225599); // server rack
  addProp(5, 0.75, -12, 1.5, 1.5, 1, 0x225599);
  addProp(-5, 0.75, 12, 1, 1, 2, 0x334466); // console
  addProp(5, 0.75, 12, 1, 1, 2, 0x334466);

  // Flickering strip lights (point lights)
  for (let i = -20; i <= 20; i += 10) {
    const l = new THREE.PointLight(0x8899ff, 1.2, 18);
    l.position.set(i, 3.5, 0);
    scene.add(l);
  }

  // Exit
  const exitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.5 })
  );
  exitMesh.position.set(0, 1.5, -23);
  scene.add(exitMesh);

  // 7 guards in corridor positions
  const mkEnemy = (x, z, wp) => new Enemy(scene, new THREE.Vector3(x, 0, z), wp.map(([a, b]) => new THREE.Vector3(a, 0, b)), audio);
  const enemies = [
    mkEnemy(-5, -15, [[-5, -15], [-5, -5]]),
    mkEnemy(5, -15, [[5, -15], [5, -5]]),
    mkEnemy(0, -5, [[-5, -5], [5, -5]]),
    mkEnemy(-18, 0, [[-18, 0], [-18, 10]]),
    mkEnemy(18, 0, [[18, 0], [18, 10]]),
    mkEnemy(-5, 15, [[-5, 15], [5, 15]]),
    mkEnemy(5, 15, [[5, 15], [-5, 15]]),
  ];

  return {
    spawnPos: new THREE.Vector3(0, 1.7, 22),
    enemies,
    exitPos: new THREE.Vector3(0, 1.7, -23),
  };
}

/**
 * Level 3 — Commander Gorza (Boss)
 * War room with mini-boss. Gemini boss monologue on encounter.
 */
export function buildLevel3(world, scene, audio, gemini) {
  const FLOOR = mat(0x1c1c1c);
  const WALL = mat(0x2a2a2a);
  const CEIL = mat(0x141414);

  const SZ = 35;
  world.addFloor(SZ, SZ, FLOOR);
  world.addCeiling(SZ, SZ, CEIL, 0, 0, 5);

  world.addWall(0, -SZ / 2, SZ, 1, 5, WALL);
  world.addWall(0, SZ / 2, SZ, 1, 5, WALL);
  world.addWall(-SZ / 2, 0, 1, SZ, 5, WALL);
  world.addWall(SZ / 2, 0, 1, SZ, 5, WALL);

  // War-room desks / cover
  world.addWall(-6, 4, 4, 1.5, 1.2, mat(0x3a3020));
  world.addWall(6, 4, 4, 1.5, 1.2, mat(0x3a3020));
  world.addWall(0, 0, 2, 2, 1.5, mat(0x1a1a1a));

  // Red accent lights
  const addRed = (x, z) => {
    const l = new THREE.PointLight(0xff2233, 2.5, 20);
    l.position.set(x, 4, z);
    scene.add(l);
  };
  addRed(-12, -12);
  addRed(12, -12);
  addRed(0, 0);

  // Exit — behind the boss
  const exitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.5 })
  );
  exitMesh.position.set(0, 1.5, -15);
  scene.add(exitMesh);

  // Boss — Commander Gorza + 2 guarding foot soldiers
  const boss = new BossEnemy(
    scene,
    new THREE.Vector3(0, 0, -10),
    'Commander Gorza',
    LEVEL_META[2].theme,
    audio,
    gemini
  );

  const guard1 = new Enemy(scene, new THREE.Vector3(-5, 0, -8), [new THREE.Vector3(-5, 0, -8), new THREE.Vector3(-5, 0, -2)], audio);
  const guard2 = new Enemy(scene, new THREE.Vector3(5, 0, -8), [new THREE.Vector3(5, 0, -8), new THREE.Vector3(5, 0, -2)], audio);

  return {
    spawnPos: new THREE.Vector3(0, 1.7, 14),
    enemies: [boss, guard1, guard2],
    exitPos: new THREE.Vector3(0, 1.7, -15),
  };
}

/**
 * Level 4 — Alien Hive
 * Organic cavern with 8 alien drones. Adaptive hints from Gemini.
 */
export function buildLevel4(world, scene, audio, _gemini) {
  const FLOOR = mat(0x0a1a0f);
  const WALL = mat(0x0d2a14);
  const CEIL = mat(0x070f08);

  const W = 45, D = 45;
  world.addFloor(W, D, FLOOR);
  world.addCeiling(W, D, CEIL, 0, 0, 5);

  world.addWall(0, -D / 2, W, 1, 5, WALL);
  world.addWall(0, D / 2, W, 1, 5, WALL);
  world.addWall(-W / 2, 0, 1, D, 5, WALL);
  world.addWall(W / 2, 0, 1, D, 5, WALL);

  // Organic pillars (alien growths)
  const pillarMat = mat(0x1a3a20, 0.6);
  world.addWall(-12, -8, 2.5, 2.5, 5, pillarMat);
  world.addWall(12, -8, 2.5, 2.5, 5, pillarMat);
  world.addWall(-12, 8, 2.5, 2.5, 5, pillarMat);
  world.addWall(12, 8, 2.5, 2.5, 5, pillarMat);
  world.addWall(0, 0, 2, 2, 5, pillarMat);

  // Bioluminescent point lights
  const colors = [0x00ff88, 0x44ff44, 0x88ffaa];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight(colors[i % 3], 1.8, 20);
    const angle = (i / 6) * Math.PI * 2;
    l.position.set(Math.cos(angle) * 15, 3, Math.sin(angle) * 15);
    scene.add(l);
  }

  // Exit
  const exitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.5 })
  );
  exitMesh.position.set(0, 1.5, -20);
  scene.add(exitMesh);

  // 8 alien drones (teal-coloured enemies)
  const mkDrone = (x, z, wp) => {
    const e = new Enemy(scene, new THREE.Vector3(x, 0, z), wp.map(([a, b]) => new THREE.Vector3(a, 0, b)), audio);
    // Tint alien
    e.mesh.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.color.set(0x005533); } });
    return e;
  };

  const enemies = [
    mkDrone(-15, -10, [[-15, -10], [-15, 0]]),
    mkDrone(15, -10, [[15, -10], [15, 0]]),
    mkDrone(-15, 10, [[-15, 10], [-15, 0]]),
    mkDrone(15, 10, [[15, 10], [15, 0]]),
    mkDrone(0, -15, [[-5, -15], [5, -15]]),
    mkDrone(0, 15, [[-5, 15], [5, 15]]),
    mkDrone(-8, 0, [[-8, 0], [-8, -8]]),
    mkDrone(8, 0, [[8, 0], [8, -8]]),
  ];

  return {
    spawnPos: new THREE.Vector3(0, 1.7, 19),
    enemies,
    exitPos: new THREE.Vector3(0, 1.7, -20),
  };
}

/**
 * Level 5 — Red Falcon Core (Final Boss)
 * Massive reactor room with Red Falcon + 4 alien guards.
 */
export function buildLevel5(world, scene, audio, gemini) {
  const FLOOR = mat(0x0a0008);
  const WALL = mat(0x160014);
  const CEIL = mat(0x080006);

  const SZ = 50;
  world.addFloor(SZ, SZ, FLOOR);
  world.addCeiling(SZ, SZ, CEIL, 0, 0, 8);

  world.addWall(0, -SZ / 2, SZ, 1, 8, WALL);
  world.addWall(0, SZ / 2, SZ, 1, 8, WALL);
  world.addWall(-SZ / 2, 0, 1, SZ, 8, WALL);
  world.addWall(SZ / 2, 0, 1, SZ, 8, WALL);

  // Reactor pillar arcs
  const reactorMat = new THREE.MeshStandardMaterial({
    color: 0xff0033, emissive: 0xff0033, emissiveIntensity: 0.4, roughness: 0.3,
  });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.cos(angle) * 14;
    const z = Math.sin(angle) * 14;
    world.addWall(x, z, 1.5, 1.5, 8, reactorMat);
  }

  // Central reactor core (visual prop)
  world.addProp(0, 3, 0, 3, 6, 3, new THREE.MeshStandardMaterial({
    color: 0xff0033, emissive: 0xff0033, emissiveIntensity: 1.5, roughness: 0.2,
  }));

  // Dramatic lighting
  const core = new THREE.PointLight(0xff0033, 5, 50);
  core.position.set(0, 5, 0);
  scene.add(core);

  [[-20, -20], [20, -20], [-20, 20], [20, 20]].forEach(([x, z]) => {
    const l = new THREE.PointLight(0x9900ff, 2, 25);
    l.position.set(x, 5, z);
    scene.add(l);
  });

  // Exit (appears after boss dies — handled by LevelManager)
  const exitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 2 })
  );
  exitMesh.position.set(0, 2, -22);
  scene.add(exitMesh);

  // Final Boss — Red Falcon
  const boss = new BossEnemy(
    scene,
    new THREE.Vector3(0, 0, -15),
    'Red Falcon',
    LEVEL_META[4].theme,
    audio,
    gemini
  );
  // Red Falcon is MASSIVE
  boss.mesh.scale.set(2.5, 2.5, 2.5);
  boss.maxHealth = 250;
  boss.health = 250;

  // 4 alien guards at corners
  const mkAlien = (x, z) => {
    const e = new Enemy(scene, new THREE.Vector3(x, 0, z), [new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 0, z - 5)], audio);
    e.mesh.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.color.set(0x330022); } });
    return e;
  };

  const enemies = [boss, mkAlien(-10, -10), mkAlien(10, -10), mkAlien(-10, 0), mkAlien(10, 0)];

  return {
    spawnPos: new THREE.Vector3(0, 1.7, 20),
    enemies,
    exitPos: new THREE.Vector3(0, 1.7, -22),
  };
}

export const LEVEL_BUILDERS = [buildLevel1, buildLevel2, buildLevel3, buildLevel4, buildLevel5];
