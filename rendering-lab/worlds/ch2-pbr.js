// Ch2 개념2 · 쉐이딩 모델 비교 — Lambert / Phong / PBR
// 지형(개념1, ch2-lighting.js)과는 별도 월드로 분리했다 — 랜드스케이프를 멀리서 보는 것과
// 재질을 가까이서 비교하는 것은 카메라 언어가 달라, 한 화면에 있으면 스케일 감각이 어긋난다.
// 여기는 작은 스튜디오 무대: 구슬(쉐이딩 모델 3개, 드롭다운으로 교체) + glTF 레퍼런스 모델 2개.
// 이론·정답: chapters/ch2-pbr.lesson.md
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

// Khronos 공식 PBR 데모 자산 — 금속 바이저 + 거친 몸체가 한 메시에 공존해 metallic/roughness를 보여주려고 만든 모델
const HELMET_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb';
const KNIGHT_URL = '/rendering-lab/assets/models/knight-mesh.glb';

// ── 구슬 — 쉐이딩 모델 세 개 (Lambert / Phong / PBR) ──
// 셋 다 같은 정점 셰이더를 쓴다 (월드 공간 법선 + 월드 좌표만 있으면 충분).
const sphereVertex = /* glsl */`
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Lambert — Ch2 개념1에서 이미 채운 공식 그대로. specular가 아예 없다.
const sphereLambertFragment = /* glsl */`
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform float uAmbient;
uniform vec3 uBaseColor;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vec3 N = normalize(vNormal);
  float diffuse = max(dot(N, uLightDir), 0.0);
  vec3 color = uBaseColor * (uAmbient + diffuse * uLightColor);
  gl_FragColor = vec4(color, 1.0);
}`;

// Phong — 반사 방향(R)과 시야(V)가 가까울수록 밝은 하이라이트. shininess는 물리적 의미가 없는 임의 값.
const spherePhongFragment = /* glsl */`
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform float uAmbient;
uniform vec3 uBaseColor;
uniform vec3 uCameraPos;
uniform float uShininess;
uniform vec3 uSpecularColor;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(uCameraPos - vWorldPos);
  vec3 R = reflect(-L, N);   // 빛이 표면에서 정반사되는 방향

  float diffuse = max(dot(N, L), 0.0);

  // === TODO (Phong specular) =========================================
  // R과 V가 가까울수록(시야가 반사 방향에 가까울수록) 밝은 하이라이트가 생긴다.
  // dot(R,V)를 0 이상으로 자르고, uShininess 제곱해서 뾰족한 하이라이트로 만든다.
  // 힌트: pow(x, uShininess)
  float specular = pow(max(dot(R, V), 0.0), uShininess);   // ← 이 줄을 고치세요 (정답: lesson.md)
  // ==================================================================

  vec3 color = uBaseColor * (uAmbient + diffuse * uLightColor) + specular * uSpecularColor * uLightColor;
  gl_FragColor = vec4(color, 1.0);
}`;

// PBR (Cook-Torrance) — F0/Fresnel/에너지 보존까지 갖춘 정식 모델.
const spherePbrFragment = /* glsl */`
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform float uAmbient;
uniform vec3 uBaseColor;
uniform float uMetallic;
uniform float uRoughness;
uniform vec3 uCameraPos;
varying vec3 vNormal;
varying vec3 vWorldPos;

const float PI = 3.14159265359;

// 제공됨: 미세면 분포 함수(Trowbridge-Reitz GGX) — roughness가 낮을수록 하이라이트가 좁고 선명해진다
float D_GGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  return a2 / (PI * denom * denom + 0.0001);
}

// 제공됨: 기하 함수(Smith-Schlick-GGX) — 미세면끼리 서로 가리는 정도를 보정
float G_SchlickGGX(float NdotX, float roughness) {
  float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
  return NdotX / (NdotX * (1.0 - k) + k);
}
float G_Smith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0);
  float NdotL = max(dot(N, L), 0.0);
  return G_SchlickGGX(NdotV, roughness) * G_SchlickGGX(NdotL, roughness);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorldPos);   // 표면 → 카메라 (시야 방향)
  vec3 L = normalize(uLightDir);                 // 표면 → 광원
  vec3 H = normalize(V + L);                     // 시야와 광원의 중간 방향

  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 0.0);

  // 정면에서 바라볼 때의 기본 반사율(F0). 비금속은 대략 4%, 금속은 자기 색을 반사율로 쓴다. (제공됨)
  vec3 F0 = mix(vec3(0.04), uBaseColor, uMetallic);

  // === TODO (Fresnel-Schlick) =========================================
  // 시야각이 가장자리(grazing angle)로 갈수록 반사가 커지는 효과.
  // F0에서 시작해 (1-F0)를 (1 - dot(H,V))^5 만큼 더한다.
  // 힌트: pow(x, 5.0)
  vec3 F = F0;   // ← 이 줄을 고치세요 (정답: lesson.md)
  // ==================================================================

  float D = D_GGX(N, H, uRoughness);
  float G = G_Smith(N, V, L, uRoughness);
  vec3 specular = (D * G * F) / (4.0 * NdotV * NdotL + 0.0001);

  // === TODO (에너지 보존 합성) =========================================
  // kS(반사로 나가는 비율) = F. kD(diffuse로 남는 비율) = (1-kS) * (금속이 아닌 비율).
  // 최종 색 = (diffuse + specular) * 빛 * NdotL + ambient
  vec3 color = uBaseColor * uAmbient;   // ← 이 줄을 고치세요 (정답: lesson.md)
  // ==================================================================

  gl_FragColor = vec4(color, 1.0);
}`;

// glTF는 원점(pivot)이 발밑이 아니라 몸통 중앙 등 제각각이라, 바운딩 박스를 직접 재서
// "가장 낮은 점이 바닥(y=0)에 닿도록" 매번 다시 배치한다. 스케일·회전을 바꾼 뒤에도 다시 불러야 한다.
function groundAndPlace(obj, scale, extraY, rotYDeg, baseX, baseZ) {
  if (!obj) return;
  obj.position.set(0, 0, 0);
  obj.rotation.set(0, rotYDeg * Math.PI / 180, 0);
  obj.scale.setScalar(scale);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const groundShift = -box.min.y;   // 지금 가장 낮은 점을 y=0으로 밀어 올리는 데 필요한 양
  obj.position.set(baseX, groundShift + extraY, baseZ);
}

function disposeMaterial(m) {
  for (const key in m) { const v = m[key]; if (v && v.isTexture) v.dispose(); }
  m.dispose();
}
function disposeObject3D(root) {
  root.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    // 쉐이딩 모델 3벌을 만들어둔 메시는 현재 활성화된 것 말고 나머지 둘도 같이 정리해야 한다.
    if (obj.userData && obj.userData.shadingMats) {
      const { lambert, phong, pbr } = obj.userData.shadingMats;
      [lambert, phong, pbr].forEach(disposeMaterial);
    } else if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(disposeMaterial);
    }
  });
}

export default {
  async create({ renderer, canvas }) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d16);
    scene.fog = new THREE.FogExp2(0x0a0d16, 0.03);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const aspect = (canvas.clientWidth / canvas.clientHeight) || 1;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 3.2, 7.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1, 0);

    const params = {
      elevation: 45, azimuth: 35, ambient: 0.15,
      shadingModel: 'lambert',
      shininess: 32, metallic: 0.0, roughness: 0.4,
      helmetScale: 1.2, helmetY: 0, helmetRotY: 0,
      knightScale: 1.0, knightY: 0, knightRotY: 0,
    };
    const colorProxy = { baseColor: '#c9c9d1', specularColor: '#ffffff' };

    // 조명·재질 uniform은 여러 재질이 하나의 객체를 공유한다.
    const uLightDir = { value: new THREE.Vector3(0, 1, 0) };
    const uLightColor = { value: new THREE.Color(0xfff2d9) };
    const uAmbient = { value: params.ambient };
    const uBaseColor = { value: new THREE.Color(colorProxy.baseColor) };
    const uCameraPos = { value: camera.position.clone() };

    // ── 무대 바닥 ──
    // 구슬은 우리가 손으로 짠 커스텀 셰이더로 쉐이딩 모델을 바꾸지만, 바닥·glTF 모델은
    // three.js에 내장된 동명의 재질(Lambert/Phong/Standard)로 갈아끼운다. 이름이 우리가
    // 만든 세 모델과 그대로 대응된다 — 직접 만든 게 실제 엔진 내장 재질과 같은 것임을 보여준다.
    const floorGeo = new THREE.CircleGeometry(6.5, 64);
    const floorColor = 0x1c2130;
    const floorMaterials = {
      lambert: new THREE.MeshLambertMaterial({ color: floorColor }),
      phong: new THREE.MeshPhongMaterial({ color: floorColor, shininess: 30 }),
      pbr: new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.9, metalness: 0.0 }),
    };
    const floor = new THREE.Mesh(floorGeo, floorMaterials[params.shadingModel]);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 실제 DirectionalLight — glTF 표준 재질(MeshStandardMaterial)이 반응하고 그림자를 드리우는 데 필요.
    // 커스텀 셰이더(구슬)는 uLightDir을 직접 받으므로, 같은 방향으로 항상 맞춰준다.
    const sunLight = new THREE.DirectionalLight(0xfff2d9, 1.3);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 30;
    sunLight.shadow.camera.left = -8;
    sunLight.shadow.camera.right = 8;
    sunLight.shadow.camera.top = 8;
    sunLight.shadow.camera.bottom = -8;
    sunLight.shadow.bias = -0.0015;
    scene.add(sunLight, sunLight.target);

    const hemiLight = new THREE.HemisphereLight(0x2a3550, 0x0a0d16, 0.6);
    scene.add(hemiLight);

    function updateLightDir() {
      const el = params.elevation * Math.PI / 180;
      const az = params.azimuth * Math.PI / 180;
      uLightDir.value.set(
        Math.cos(el) * Math.sin(az),
        Math.sin(el),
        Math.cos(el) * Math.cos(az)
      ).normalize();
      sunLight.position.copy(uLightDir.value).multiplyScalar(15);
      sunLight.target.position.set(0, 0.5, 0);
    }
    updateLightDir();

    // ── 구슬 — 재질 세 개를 만들어두고 드롭다운으로 갈아끼운다 ──
    const sphereGeo = new THREE.SphereGeometry(0.9, 48, 48);

    const sphereLambertMat = new THREE.ShaderMaterial({
      vertexShader: sphereVertex,
      fragmentShader: sphereLambertFragment,
      uniforms: { uLightDir, uLightColor, uAmbient, uBaseColor },
    });
    const spherePhongMat = new THREE.ShaderMaterial({
      vertexShader: sphereVertex,
      fragmentShader: spherePhongFragment,
      uniforms: {
        uLightDir, uLightColor, uAmbient, uBaseColor, uCameraPos,
        uShininess: { value: params.shininess },
        uSpecularColor: { value: new THREE.Color(colorProxy.specularColor) },
      },
    });
    const spherePbrMat = new THREE.ShaderMaterial({
      vertexShader: sphereVertex,
      fragmentShader: spherePbrFragment,
      uniforms: {
        uLightDir, uLightColor, uAmbient, uBaseColor, uCameraPos,
        uMetallic: { value: params.metallic },
        uRoughness: { value: params.roughness },
      },
    });
    const sphereMaterials = { lambert: sphereLambertMat, phong: spherePhongMat, pbr: spherePbrMat };

    const sphere = new THREE.Mesh(sphereGeo, sphereMaterials[params.shadingModel]);
    sphere.position.set(-2.6, 0.9, 0.8);   // 구슬 반지름만큼 띄우면 바닥에 정확히 닿는다
    sphere.castShadow = true;               // 커스텀 셰이더라도 그림자 캐스팅(깊이만 필요)은 그대로 동작
    scene.add(sphere);

    // glTF가 원래 갖고 온 PBR 재질(MeshStandardMaterial)에서 map/normalMap 등 텍스처를 그대로
    // 물려받아 Lambert·Phong 버전을 만든다. 텍스처는 유지하되 반사 계산 방식만 바뀐다.
    function buildShadingVariants(orig) {
      const shared = { map: orig.map || null, color: orig.color ? orig.color.clone() : new THREE.Color(0xffffff) };
      if (orig.normalMap) shared.normalMap = orig.normalMap;
      if (orig.emissiveMap) shared.emissiveMap = orig.emissiveMap;
      if (orig.emissive) shared.emissive = orig.emissive.clone();
      return {
        lambert: new THREE.MeshLambertMaterial(shared),
        phong: new THREE.MeshPhongMaterial({ ...shared, shininess: 30 }),
        pbr: orig,   // 원본 그대로 — 실제 프로덕션 PBR 참고 자료
      };
    }

    // ── glTF 레퍼런스 모델 두 개 ──
    const gltfLoader = new GLTFLoader();
    let helmet = null, knight = null;
    try {
      const [helmetGltf, knightGltf] = await Promise.all([
        gltfLoader.loadAsync(HELMET_URL),
        gltfLoader.loadAsync(KNIGHT_URL),
      ]);
      helmet = helmetGltf.scene;
      knight = knightGltf.scene;
      for (const obj of [helmet, knight]) {
        obj.traverse(c => {
          if (!c.isMesh) return;
          c.castShadow = true;
          c.receiveShadow = true;
          c.userData.shadingMats = buildShadingVariants(c.material);
        });
      }
      groundAndPlace(helmet, params.helmetScale, params.helmetY, params.helmetRotY, 0.4, -0.6);
      groundAndPlace(knight, params.knightScale, params.knightY, params.knightRotY, 2.8, 0.6);
      scene.add(helmet, knight);
    } catch (e) {
      console.error('레퍼런스 모델 로드 실패:', e);
    }

    // ── GUI ──
    const gui = new GUI({ title: 'Ch2 · 쉐이딩 모델 비교' });

    const lightF = gui.addFolder('조명');
    lightF.add(params, 'elevation', 5, 85, 1).name('빛 고도').onChange(updateLightDir);
    lightF.add(params, 'azimuth', 0, 360, 1).name('빛 방위각').onChange(updateLightDir);
    lightF.add(params, 'ambient', 0, 0.6, 0.01).name('환경광 세기')
      .onChange(v => { uAmbient.value = v; });

    const materialF = gui.addFolder('쉐이딩 모델 (장면 전체에 적용)');

    function toggleFolder(folder, visible) {
      folder.domElement.style.display = visible ? '' : 'none';
    }
    // 드롭다운 하나로 구슬(커스텀 셰이더) + 바닥 + 레퍼런스 모델 전부의 재질을 갈아끼운다.
    function applyShadingModel(model) {
      sphere.material = sphereMaterials[model];
      floor.material = floorMaterials[model];
      for (const obj of [helmet, knight]) {
        if (!obj) continue;
        obj.traverse(c => { if (c.isMesh && c.userData.shadingMats) c.material = c.userData.shadingMats[model]; });
      }
      toggleFolder(phongF, model === 'phong');
      toggleFolder(pbrF, model === 'pbr');
    }
    // 모델 선택 드롭다운을 폴더 맨 위에 둔다 — 무엇을 비교하는 화면인지 먼저 보이도록
    materialF.add(params, 'shadingModel', { Lambert: 'lambert', Phong: 'phong', PBR: 'pbr' })
      .name('쉐이딩 모델')
      .onChange(applyShadingModel);

    materialF.addColor(colorProxy, 'baseColor').name('베이스 컬러 (구슬)')
      .onChange(v => { uBaseColor.value.set(v); });

    const phongF = materialF.addFolder('Phong 옵션 (구슬)');
    phongF.add(params, 'shininess', 2, 256, 1).name('Shininess')
      .onChange(v => { spherePhongMat.uniforms.uShininess.value = v; });
    phongF.addColor(colorProxy, 'specularColor').name('Specular 색')
      .onChange(v => { spherePhongMat.uniforms.uSpecularColor.value.set(v); });

    const pbrF = materialF.addFolder('PBR 옵션 (구슬)');
    pbrF.add(params, 'metallic', 0, 1, 0.01).name('금속성 (Metallic)')
      .onChange(v => { spherePbrMat.uniforms.uMetallic.value = v; });
    pbrF.add(params, 'roughness', 0.02, 1, 0.01).name('거칠기 (Roughness)')
      .onChange(v => { spherePbrMat.uniforms.uRoughness.value = v; });

    applyShadingModel(params.shadingModel);

    // 레퍼런스 모델(헬멧·나이트)은 항상 고정 스폰 — 튜닝용 GUI는 노출하지 않는다.
    // 배치값은 위 groundAndPlace(...) 호출의 기본 파라미터로 고정돼 있다.

    gui.add(controls, 'autoRotate').name('자동 회전');

    return {
      scene,
      camera,
      update() {
        controls.update();
        uCameraPos.value.copy(camera.position);
      },
      dispose() {
        floorGeo.dispose();
        floorMaterials.lambert.dispose();
        floorMaterials.phong.dispose();
        floorMaterials.pbr.dispose();
        sphereGeo.dispose();
        sphereLambertMat.dispose();
        spherePhongMat.dispose();
        spherePbrMat.dispose();
        if (helmet) disposeObject3D(helmet);
        if (knight) disposeObject3D(knight);
        renderer.shadowMap.enabled = false;
        controls.dispose();
        gui.destroy();
      },
    };
  },
};
