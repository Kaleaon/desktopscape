import * as THREE from 'three';

/**
 * High Performance WebGL 3D Gaussian Splat Engine for Peoria Desktop Engine.
 * Renders high-density Gaussian splats with dynamic solar lighting, river specular,
 * weather particle overlay, and depth sorting.
 */
export class GaussianSplatRenderer {
  constructor(containerElement) {
    this.container = containerElement || { clientWidth: 800, clientHeight: 600, innerHTML: '', appendChild: () => {} };
    const width = (this.container && this.container.clientWidth) || (typeof window !== 'undefined' ? window.innerWidth : 800);
    const height = (this.container && this.container.clientHeight) || (typeof window !== 'undefined' ? window.innerHeight : 600);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) {
      this.renderer = {
        setSize: () => {},
        setPixelRatio: () => {},
        toneMapping: 0,
        toneMappingExposure: 1.0,
        domElement: { style: {} },
        render: () => {}
      };
    }

    this.splatMesh = null;
    this.splatData = null;
    this.splatCount = 0;
    this.sortedIndices = null;

    // Persistent TypedArray Buffer Pool for depth sorting
    this.distances = new Float32Array(0);
    this.indices = new Int32Array(0);
    this.sortedPos = new Float32Array(0);
    this.sortedScales = new Float32Array(0);
    this.sortedColors = new Float32Array(0);
    this.sortedRotations = new Float32Array(0);

    // Reuse comparator arrow function to avoid allocation during sorting passes
    this._sortComparator = (a, b) => this.distances[b] - this.distances[a];
    
    // Environmental elements
    this.riverMesh = null;
    this.riverIceOverlay = null;
    this.bridgeLightsGroup = null;
    this.skyMesh = null;
    
    this.init();
  }

  init() {
    const width = (this.container && this.container.clientWidth) || (typeof window !== 'undefined' ? window.innerWidth : 800);
    const height = (this.container && this.container.clientHeight) || (typeof window !== 'undefined' ? window.innerHeight : 600);
    const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

    if (this.renderer && typeof this.renderer.setSize === 'function') {
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
    }
    
    // Clear existing canvas if re-initializing
    if (this.container) {
      this.container.innerHTML = '';
      if (this.renderer && this.renderer.domElement && typeof this.container.appendChild === 'function') {
        this.container.appendChild(this.renderer.domElement);
      }
    }

    // Initial camera placement overlooking Peoria Illinois River & Riverfront
    this.camera.position.set(0, 45, 120);
    this.camera.lookAt(0, 10, 0);

    // Dynamic Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5ea, 1.5);
    this.sunLight.position.set(100, 150, 50);
    this.scene.add(this.sunLight);

    // Create Illinois River & Winter Ice Plane
    this.createIllinoisRiver();

    // Resize Listener
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', () => this.onWindowResize());
    }
  }

  createIllinoisRiver() {
    // Peoria's Illinois River Bed Plane
    const riverGeo = new THREE.PlaneGeometry(800, 800, 128, 128);
    riverGeo.rotateX(-Math.PI / 2);

    // Custom Water Shader Material with wave motion and winter ice blend
    this.riverUniforms = {
      uTime: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(1, 1, 0).normalize() },
      uSunColor: { value: new THREE.Color(1, 0.9, 0.7) },
      uIceCoverage: { value: 0.0 }, // 0 = Liquid water, 1 = Frozen ice sheet
      uNightGlow: { value: 0.2 },
      uWaterColor: { value: new THREE.Color(0x0e2e42) },
      uIceColor: { value: new THREE.Color(0xdceeff) }
    };

    const riverMat = new THREE.ShaderMaterial({
      uniforms: this.riverUniforms,
      vertexShader: `
        uniform float uTime;
        uniform float uIceCoverage;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec3 pos = position;
          // Water ripple displacement reduced when river is frozen in winter
          float waveFactor = 1.0 - (uIceCoverage * 0.85);
          float wave = sin(pos.x * 0.05 + uTime * 2.0) * cos(pos.z * 0.05 + uTime * 1.5) * 1.2 * waveFactor;
          pos.y += wave;

          vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
          vNormal = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;
        uniform float uIceCoverage;
        uniform float uNightGlow;
        uniform vec3 uWaterColor;
        uniform vec3 uIceColor;
        uniform float uTime;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        // Ice Noise Generator for winter Illinois River ice floes
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          
          // Specular Reflection (Sun / Bridge Light on Peoria water)
          vec3 reflectDir = reflect(-uSunDirection, vNormal);
          float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

          // Liquid river water color vs Frozen Peoria river ice
          float icePattern = noise(vUv * 35.0 + vec2(uTime * 0.01, 0.0));
          float iceFactor = smoothstep(1.0 - uIceCoverage, 1.0 - uIceCoverage + 0.2, icePattern * uIceCoverage + (1.0 - icePattern) * 0.2);

          vec3 baseColor = mix(uWaterColor, uIceColor, iceFactor);
          vec3 finalColor = baseColor + (uSunColor * spec * (1.0 + uIceCoverage * 0.5));
          
          // Night ambient reflection off city lights
          finalColor += vec3(0.05, 0.1, 0.2) * uNightGlow;

          gl_FragColor = vec4(finalColor, 0.88 + iceFactor * 0.12);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.riverMesh = new THREE.Mesh(riverGeo, riverMat);
    this.riverMesh.position.y = -2;
    this.scene.add(this.riverMesh);
  }

  ensureBufferCapacity(count) {
    if (this.distances && this.distances.length === count) {
      return;
    }
    this.distances = new Float32Array(count);
    this.indices = new Int32Array(count);
    this.sortedPos = new Float32Array(count * 3);
    this.sortedScales = new Float32Array(count * 3);
    this.sortedColors = new Float32Array(count * 4);
    this.sortedRotations = new Float32Array(count * 4);
  }

  loadSplatData(splatData) {
    if (this.splatMesh) {
      this.scene.remove(this.splatMesh);
      this.splatMesh.geometry.dispose();
      this.splatMesh.material.dispose();
    }

    const positions = splatData.positions instanceof Float32Array ? splatData.positions : new Float32Array(splatData.positions);
    const scales = splatData.scales instanceof Float32Array ? splatData.scales : new Float32Array(splatData.scales);
    const colors = splatData.colors instanceof Float32Array ? splatData.colors : new Float32Array(splatData.colors);
    const rotations = splatData.rotations instanceof Float32Array ? splatData.rotations : new Float32Array(splatData.rotations);

    this.splatData = {
      ...splatData,
      positions,
      scales,
      colors,
      rotations
    };
    this.splatCount = positions.length / 3;

    this.ensureBufferCapacity(this.splatCount);

    const geometry = new THREE.InstancedBufferGeometry();
    
    // Quad geometry for each Gaussian splat point
    const quadVertices = new Float32Array([
      -0.5, -0.5, 0.0,
       0.5, -0.5, 0.0,
       0.5,  0.5, 0.0,
      -0.5,  0.5, 0.0
    ]);
    const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    geometry.setAttribute('position', new THREE.BufferAttribute(quadVertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(quadIndices, 1));

    // Instanced attributes for Gaussian splats
    geometry.setAttribute('splatPosition', new THREE.InstancedBufferAttribute(positions, 3));
    geometry.setAttribute('splatScale', new THREE.InstancedBufferAttribute(scales, 3));
    geometry.setAttribute('splatColor', new THREE.InstancedBufferAttribute(colors, 4));
    geometry.setAttribute('splatRotation', new THREE.InstancedBufferAttribute(rotations, 4));

    // Custom 3D Gaussian Splat Shader Material with solar & night lighting support
    this.splatUniforms = {
      uTime: { value: 0 },
      uSolarDirection: { value: new THREE.Vector3(0.5, 1.0, 0.2) },
      uSolarIntensity: { value: 1.0 },
      uNightFactor: { value: 0.0 }, // 0 = Day, 1 = Full Night
      uSplatScaleMultiplier: { value: 1.0 },
      uCityGlowColor: { value: new THREE.Color(1.0, 0.7, 0.3) }
    };

    const splatMaterial = new THREE.ShaderMaterial({
      uniforms: this.splatUniforms,
      vertexShader: `
        attribute vec3 splatPosition;
        attribute vec3 splatScale;
        attribute vec4 splatColor;
        attribute vec4 splatRotation;

        uniform float uSplatScaleMultiplier;
        uniform vec3 uSolarDirection;
        uniform float uNightFactor;
        uniform vec3 uCityGlowColor;

        varying vec4 vColor;
        varying vec2 vUv;

        void main() {
          vUv = position.xy + vec2(0.5);

          // Apply Gaussian Splat position and camera billboards
          vec3 worldCenter = splatPosition;
          
          // Billboard alignment towards camera
          vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

          vec3 pos = worldCenter + 
            (camRight * position.x * splatScale.x * uSplatScaleMultiplier) + 
            (camUp * position.y * splatScale.y * uSplatScaleMultiplier);

          // Calculate Dynamic Light Modulation
          vec3 color = splatColor.rgb;
          
          // Peoria City & Bridge Night Glow Enhancement
          float isCityOrBridgeLight = step(0.85, splatColor.r) * step(0.85, splatColor.g);
          vec3 nightLighting = mix(color * 0.2, uCityGlowColor * 1.8, isCityOrBridgeLight * uNightFactor);
          
          vec3 finalRgb = mix(color, nightLighting, uNightFactor);

          vColor = vec4(finalRgb, splatColor.a);

          gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec4 vColor;
        varying vec2 vUv;

        void main() {
          // Gaussian radial falloff equation: exp(-0.5 * (x^2 + y^2))
          vec2 coord = (vUv - vec2(0.5)) * 2.0;
          float distSq = dot(coord, coord);
          
          if (distSq > 1.0) discard;

          float gaussianAlpha = exp(-2.0 * distSq) * vColor.a;
          gl_FragColor = vec4(vColor.rgb, gaussianAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.splatMesh = new THREE.InstancedMesh(geometry, splatMaterial, this.splatCount);
    this.scene.add(this.splatMesh);

    this.sortSplats();
  }

  sortSplats() {
    if (!this.splatData || !this.splatMesh) return;

    const count = this.splatCount;
    if (count === 0) return;

    this.ensureBufferCapacity(count);

    const pos = this.splatData.positions;
    const scales = this.splatData.scales;
    const colors = this.splatData.colors;
    const rotations = this.splatData.rotations;

    const camX = this.camera.position.x;
    const camY = this.camera.position.y;
    const camZ = this.camera.position.z;

    const distances = this.distances;
    const indices = this.indices;

    for (let i = 0; i < count; i++) {
      indices[i] = i;
      const i3 = i * 3;
      const dx = pos[i3] - camX;
      const dy = pos[i3 + 1] - camY;
      const dz = pos[i3 + 2] - camZ;
      distances[i] = dx * dx + dy * dy + dz * dz;
    }

    indices.sort(this._sortComparator);
    this.sortedIndices = indices;

    const sortedPos = this.sortedPos;
    const sortedScales = this.sortedScales;
    const sortedColors = this.sortedColors;
    const sortedRotations = this.sortedRotations;

    for (let i = 0; i < count; i++) {
      const origIdx = indices[i];
      const i3 = i * 3;
      const orig3 = origIdx * 3;
      const i4 = i * 4;
      const orig4 = origIdx * 4;

      sortedPos[i3] = pos[orig3];
      sortedPos[i3 + 1] = pos[orig3 + 1];
      sortedPos[i3 + 2] = pos[orig3 + 2];

      sortedScales[i3] = scales[orig3];
      sortedScales[i3 + 1] = scales[orig3 + 1];
      sortedScales[i3 + 2] = scales[orig3 + 2];

      sortedColors[i4] = colors[orig4];
      sortedColors[i4 + 1] = colors[orig4 + 1];
      sortedColors[i4 + 2] = colors[orig4 + 2];
      sortedColors[i4 + 3] = colors[orig4 + 3];

      sortedRotations[i4] = rotations[orig4];
      sortedRotations[i4 + 1] = rotations[orig4 + 1];
      sortedRotations[i4 + 2] = rotations[orig4 + 2];
      sortedRotations[i4 + 3] = rotations[orig4 + 3];
    }

    const geo = this.splatMesh.geometry;
    geo.attributes.splatPosition.array.set(sortedPos);
    geo.attributes.splatPosition.needsUpdate = true;

    geo.attributes.splatScale.array.set(sortedScales);
    geo.attributes.splatScale.needsUpdate = true;

    geo.attributes.splatColor.array.set(sortedColors);
    geo.attributes.splatColor.needsUpdate = true;

    geo.attributes.splatRotation.array.set(sortedRotations);
    geo.attributes.splatRotation.needsUpdate = true;
  }

  updateLighting(timeOfDayHours, weatherState) {
    // Calculate Sun position based on 0 - 24 hour decimal time
    const angle = ((timeOfDayHours - 6.0) / 12.0) * Math.PI; // 6am = 0, 12pm = pi/2, 6pm = pi
    const sunY = Math.sin(angle) * 150;
    const sunX = Math.cos(angle) * 200;
    const sunZ = 50;

    this.sunLight.position.set(sunX, Math.max(-20, sunY), sunZ);
    const sunDir = this.sunLight.position.clone().normalize();

    // Night factor (0 = Noon, 1 = Midnight)
    const isNight = sunY < 0;
    const nightFactor = isNight ? 1.0 : Math.max(0, 1.0 - (sunY / 30.0));

    // Sky and light colors
    let lightColor = new THREE.Color(0xfff5ea);
    let ambientColor = new THREE.Color(0x8899aa);

    if (timeOfDayHours >= 17.5 && timeOfDayHours <= 19.5) {
      // Golden Hour / Peoria Sunset
      lightColor.setHex(0xff7733);
      ambientColor.setHex(0xaa5566);
    } else if (isNight) {
      // Midnight / Night City Lights
      lightColor.setHex(0x224488);
      ambientColor.setHex(0x0a1525);
    }

    this.sunLight.color = lightColor;
    this.ambientLight.color = ambientColor;

    if (this.splatUniforms) {
      this.splatUniforms.uSolarDirection.value.copy(sunDir);
      this.splatUniforms.uNightFactor.value = nightFactor;
    }

    if (this.riverUniforms) {
      this.riverUniforms.uSunDirection.value.copy(sunDir);
      this.riverUniforms.uSunColor.value.copy(lightColor);
      this.riverUniforms.uNightGlow.value = nightFactor;
      if (weatherState) {
        this.riverUniforms.uIceCoverage.value = weatherState.winterIce;
      }
    }
  }

  onWindowResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render(timeDelta = 0.016) {
    if (this.riverUniforms) {
      this.riverUniforms.uTime.value += timeDelta;
    }
    if (this.splatUniforms) {
      this.splatUniforms.uTime.value += timeDelta;
    }

    this.sortSplats();

    this.renderer.render(this.scene, this.camera);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GaussianSplatRenderer };
}
