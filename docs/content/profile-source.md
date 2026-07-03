# 프로필/포트폴리오 소스 요약

`C:\workspace\취업준비\김주찬_이력서.pdf`, `김주찬_포트폴리오.pdf`(pdftotext 추출) 및 Notion(https://free-grin-2e0.notion.site/portfolio) 을 기반으로 정리. 세부 수치/문구는 최종 콘텐츠 작성 시 원본 PDF로 재확인할 것 (디자인된 PDF라 텍스트 추출 시 줄바꿈이 섞임).

## 기본 정보
- 직무: Game Client Developer
- 연락처: 010-5261-3694 / joochan123123@gmail.com

## 커리어 타임라인
| 기간 | 구분 | 내용 |
|---|---|---|
| 2025.10 ~ 2026.01 | Work | 5minlab tech dept — PMM(Private Military Manager), 3D, NaniteMesh, Unreal Insight |
| 2025.06 ~ 2025.08 | Project | AudioTracing — UE5.5 오디오 플러그인 |
| 2025.03 ~ 2025.06 | Project | Engine-SIU — 자체 게임엔진(DirectX11) |
| 2025.03 ~ 2025.08 | Edu | Pilot Program (관련: AudioTracing/Engine-SIU 시기와 겹침, 원문 재확인 필요) |
| 2023.08 ~ 2025.02 | Work | AI/3D 관련 회사 — Speech STT/TTS/Chatbot(UE 연동), Web Streaming/Kiosk 최적화(20→50fps), UMG UI, GPU/Sound RayTracing, UE Lumen |
| 2022.09 ~ 2023.02 | Edu | SEA:ME Pilot Program (임베디드) |
| 2022.01 ~ 2022.04 | Project | Project ¡Hola! — Smilegate Challenge Season 3 (3D Ray Tracing 관련 프로젝트도 이 시기) |
| 2021.07 ~ 2021.10 | Project | Pongski (42 Seoul, 웹프로그래밍) |
| 2020.09 ~ 2020.11 | Project | MiniRT — C언어 Ray Tracing (42 Seoul) |
| 2020.01 ~ 2021.10 | Edu | 42 Seoul |
| 2019.10 | Project | CheckChack — TF-IDF 기반 FAQ 챗봇, Heroku 배포, 100명+ 사용 |
| 2019.10 ~ 2019.12 | Project | Text to Image — QuickDraw 데이터셋 기반 GAN(CGAN/DCGAN) |
| 2019.08 ~ 2019.11 | Work | Deepbrain AI |
| 2014.03 ~ 2017.02 / 2017.06 ~ 2019.03 | Edu/etc | 원문 재확인 필요 |

## Notion 포트폴리오 카테고리 (총 10개 프로젝트)
### 게임&그래픽 (6)
1. **5minlab** — 회사, 2025.10~2026.01
2. **AudioTracing** — UE5.5 오디오 플러그인, 2025.06~08
3. **3D 자체 엔진 제작 (Engine-SIU)** — DirectX11, 2025.03~06
4. **DeepbrainAI** — 회사
5. **Project ¡Hola!** — Smilegate Challenge, 2022.01~04 (유튜브 영상 포함)
6. **C언어 Ray Tracing (MiniRT)** — 42Seoul, 2020.09~11

### 인공지능 (2)
7. **CheckChack** — 2019.10
8. **Text to Image** — 2019.11~12

### 임베디드 & CPP (1)
9. **SEA:ME** — 2022.09~2023.02

### 웹 프로그래밍 (1)
10. **Pongski** — 2021.07~10

## 프로젝트 상세 (포트폴리오 PDF 기준)

### AudioTracing (2025.06.12 ~ 2025.08.09)
- UE5.5, Fab 마켓플레이스 배포
- UE Audio Plugin Interface / RTCore(Ray Tracing Core) 기반 사운드 머티리얼/어테뉴에이션(MetaSound, SoundCue)
- Submix 아키텍처, UE Shader(usf)
- 성능 최적화: AudioComponent 30개 기준 55ms → 9ms
- Perforce 협업, Notion 문서화

### Engine-SIU (2025.03.05 ~ 2025.06.04)
- DirectX11/C++ 기반 자체 게임엔진, 4인 팀, Github Organization + fork/PR 워크플로우
- Week별: UObject 아키텍처 → Billboard/Texture Atlas → StaticMesh/Frustum Culling → Light/Shadow/Shader Hot Reload → Lua Script/Camera → Cascade 스타일 Particle → PhysX 물리 통합
- Rendering: Blinn-Phong, Normal Mapping, ShadowMap(Peter Panning/Acne bias 보정), PCF Shadow, 성능 50%↑
- Physics: UBodySetup/FBodyInstance/PxActor 연동, Constraint, Ragdoll

### Project ¡Hola! (Smilegate Challenge Season 3, 2022.01.25 ~ 2022.04.26 — 연도 원문 재확인)
- Unreal Engine 4.27, C++, Github+LFS
- Gameplay & Level Design, Interaction & Weapon System(Melee/Range, Socket Attach, Montage)
- 팀워크: Discord + Github Issue/PR 기반 협업

### MiniRT (42 Seoul, 2020.09~11)
- C언어로 구현한 Ray Tracing 렌더러

### CheckChack (2019.10)
- TF-IDF 기반 FAQ 챗봇, Heroku 배포, 100명 이상 사용

### Text to Image (2019.10~12)
- Google QuickDraw 데이터셋 기반 CGAN/DCGAN

## 강점 요약
UE C++ (오디오/렌더링 플러그인 개발), 자체 게임엔진 제작(DirectX11), 그래픽스(Ray Tracing, Lumen, Shadow/Lighting), 팀 협업(Github PR/Issue, Discord, Perforce), 성능 최적화 경험 다수.
