# Ch0 · 프레임이 그려지는 원리

> 이후 모든 챕터가 이 위에 쌓인다. GPU가 삼각형 하나를 화면 픽셀로 바꾸는 흐름과, 그 중심인 **MVP 변환**을 손으로 채워 이해한다.

## 이 챕터에서 배우는 것

- 렌더링 파이프라인의 큰 흐름 (vertex → 래스터라이저 → fragment)
- 정점을 화면에 올리는 **MVP 변환 사슬**과 각 행렬의 의미
- draw call이 무엇이고 위 과정과 어떻게 연결되는지
- three.js가 뒤에서 대신 해주는 것 vs 셰이더에서 내가 직접 쓰는 것의 경계

## 렌더링 파이프라인 한눈에

하나의 draw call이 실행되면 GPU는 대략 이 순서로 픽셀을 만든다

1. **Vertex Shader** — 정점 하나마다 1번 실행. 로컬 좌표를 화면 클립 좌표로 변환하는 곳 (여기서 MVP)
2. **Rasterizer** — 정점 3개로 이루어진 삼각형을 픽셀(프래그먼트)들로 쪼갬. 정점 사이 값(색·법선·UV)은 자동 보간
3. **Fragment Shader** — 픽셀 하나마다 1번 실행. 최종 색을 결정하는 곳
4. **Output** — 깊이 테스트 후 프레임버퍼에 기록

핵심: **정점 단계는 "어디에", 프래그먼트 단계는 "무슨 색으로"**를 담당한다. 이 둘의 분업이 이후 모든 셰이딩 기법의 토대다.

## MVP 변환 사슬

정점의 로컬 좌표를 화면에 올리려면 좌표계를 세 번 바꾼다

```
clip = Projection · View · Model · localPos
```

- **Model** — 로컬 좌표 → 월드 좌표 (오브젝트의 위치·회전·크기)
- **View** — 월드 좌표 → 카메라 기준 좌표 (카메라를 원점으로 옮김)
- **Projection** — 카메라 좌표 → 클립 좌표 (원근 투영, 멀수록 작게)

three.js는 편의를 위해 Model·View를 미리 곱한 `modelViewMatrix`를 셰이더에 넘겨준다. 그래서 실제로 쓸 식은

```glsl
gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
```

`position`(정점 로컬 좌표), `modelViewMatrix`, `projectionMatrix`, `normalMatrix`는 three.js의 `ShaderMaterial`이 **자동으로 주입**한다. 그래서 우리는 변환식만 쓰면 된다.

## draw call 이란

CPU가 GPU에게 "이 정점 버퍼 + 이 셰이더로 이만큼 그려라"라고 보내는 명령 한 번. 큐브 하나 = 대체로 draw call 하나. draw call이 많아지면 CPU 병목이 생기고, 그걸 줄이는 게 나중의 **인스턴싱(Ch1)**·**멀티스레드 렌더링(Ch3)**의 동기다.

## 이론 → 코드 매핑

`worlds/ch0-pipeline.js`에서

- `vertexShader` 문자열 = 위 1번 Vertex Shader. **MVP 변환이 들어갈 자리**
- `fragmentShader` 문자열 = 위 3번 Fragment Shader. 지금은 법선을 색으로 매핑
- `new THREE.Mesh(geometry, material)` + `renderer.render(scene, camera)` = draw call 발생 지점
- `PerspectiveCamera` = Projection 행렬의 출처, `camera.position` = View 행렬의 출처

## 실습 (직접 채우기)

`worlds/ch0-pipeline.js`의 `vertexShader` 안 TODO 한 줄을 고친다

```glsl
// 현재 (변환 없음 — 큐브가 납작하게 붙고 카메라에 반응 안 함)
gl_Position = vec4(position, 1.0);

// 목표 (MVP 변환 완성)
gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
```

## 관찰 포인트 (채우기 전 / 후)

- **전**: 큐브가 화면 정중앙에 평면처럼 붙어 있고, 마우스로 카메라를 돌려도 꿈쩍 안 한다 (View·Projection이 빠졌으니까)
- **후**: 원근이 생겨 입체 큐브가 되고, OrbitControls로 돌리면 카메라가 실제로 큐브 주위를 돈다
- 왜 그런지 한 줄로 설명할 수 있으면 이 개념은 통과다

## Material 파라미터 실습 (심화)

Material이 "셰이더 + 파라미터(uniform)"라는 걸 손으로 확인하는 단계다. `worlds/ch0-pipeline.js`에 uniform과 GUI 슬라이더는 이미 배선돼 있고, 셰이더에서 그 값을 **실제로 쓰는 두 줄**만 TODO로 비워 뒀다. 채우기 전에는 슬라이더를 움직여도 반응이 없다가, 채우는 순간 살아난다.

**실습 1 — 정점 흔들기 (vertex shader)**: `uWobble` 만큼 정점을 법선 방향으로 밀어 큐브를 꿈틀거리게 한다.

```glsl
// p 를 수정 (정답)
p += normal * sin(uTime * 2.0 + position.y * 4.0) * uWobble;
```

이건 Ch1의 **정점 셰이더 애니메이션(바람·파도)**의 축소판이다. 정점을 GPU에서 움직인다는 감을 미리 잡아 둔다.

**실습 2 — 색 조정 (fragment shader)**: 법선색과 단색을 `uMix` 비율로 섞는다.

```glsl
// color 를 수정 (정답)
vec3 color = mix(normalColor, uColor, uMix);
```

`uMix = 0`이면 법선색, `1`이면 단색이 된다. 같은 셰이더인데 uniform 값만 바꿔 외형이 달라지는 것 = "Material = 셰이더 + 파라미터"의 실증이다.

> 참고: 정점을 흔들면 법선(`vNormal`)은 원본 그대로라 음영이 정확하진 않다. 정점을 바꾸면 법선도 다시 계산해야 한다는 점은 이후 챕터에서 다룬다.

## 엔진 매핑

- **UE**: Material의 Vertex 단계 ↔ vertex shader, `WorldPosition`/변환은 엔진이 처리. draw call ↔ Draw Primitive
- **Unity**: ShaderLab의 `vert` 함수 ↔ vertex shader, `UnityObjectToClipPos(v.vertex)`가 바로 이 MVP 곱. `Graphics.RenderMesh` ↔ draw call
- **D3D**: `VSMain` ↔ vertex shader, 상수 버퍼로 넘긴 WVP 행렬을 곱함. `DrawIndexed` ↔ draw call

## 블로그 초안용 질문 (이 답들이 곧 글의 뼈대)

1. Vertex Shader와 Fragment Shader는 각각 "무엇을" 결정하나? 실행 횟수는 왜 다른가?
2. Model / View / Projection은 각각 무슨 좌표계 변환인가? 순서를 바꾸면 왜 안 되나?
3. 변환을 빼면(내 실습의 "전" 상태) 왜 카메라를 돌려도 큐브가 안 움직였나?
4. three.js가 대신 해준 부분과 내가 직접 쓴 부분의 경계는 어디였나?
5. draw call은 왜 많아지면 문제인가? (다음 챕터로 이어지는 고리)
