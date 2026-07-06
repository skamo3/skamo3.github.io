---
title: Deepbrain AI
type: company
category: game-graphics
period: "2023.08.01 - 2025.02.28"
order: 2
summary: "메타휴먼 기반 실시간 대화형 3D AI 아바타 서비스, Speech 플러그인, Web Streaming/Kiosk 최적화"
thumbnail: /assets/images/deepbrain-ai/thumbnail.png
team: "메타버스팀 | 정직원"
stack: ["Unreal Engine", "MetaHuman", "UMG", "Pixel Streaming"]
links:
  - label: "관련 언론 보도 (bikorea.net)"
    url: "https://m.bikorea.net/news/articleView.html?idxno=39761"
---

![DeepbrainAI 메타휴먼 기반 3D 아바타](/assets/images/deepbrain-ai/thumbnail.png)

UE MetaHuman을 기반으로 제작한 3D Human입니다. 기존 사내 프로젝트는 웹 기반 2D 아바타였는데, 챗봇 답변에 맞춰 만든 TTS 데이터로 아바타의 입모양을 움직여 실제 사람처럼 말하는 3D 아바타로 발전시켰습니다. 언리얼 엔진 기반 고퀄리티 3D 아바타와 UE Pixel Streaming을 이용한 웹 실시간 서비스가 목표였고, 언리얼 엔진 컨텐츠 개발 총괄과 서버 배포를 담당했습니다.

# 모듈형 캐릭터 / UI / 커스터마이징

**아바타의 머리와 옷을 부위별로 자유롭게 바꿔가며 재사용성을 높이고, 캐릭터별 작업 시간을 줄여야 했습니다.**
{: .problem}

기존에는 캐릭터별로 C++ 클래스를 따로 만들고 이를 상속한 블루프린트·애님BP도 개별 생성해서 관리했습니다. 개발자를 거치지 않으면 아티스트가 새 캐릭터를 적용하거나 수치를 조절해볼 수도 없는 구조였고, 블루프린트로 통합한 뒤에도 비개발자가 값을 바꾸는 데 어려움을 겪었습니다. TTS도 AWS/Google/자사 제품을 상황별로 하드코딩해서 쓰다 보니 팀 작업 시 혼동과 Git Conflict가 잦았습니다.
{: .problem}

하나로 통합한 `DBAICharacterBase`를 만들고 이를 BP로 확장해, 블루프린트 상에서 캐릭터 수치를 조절하며 컴파일 없이 바로 테스트할 수 있게 했습니다. AnimBP도 하나로 통합한 뒤 Retargeting으로 여러 캐릭터에 적용되게 해서, 캐릭터 메시만 새로 만들면 애니메이션은 따로 작업하지 않아도 되도록 범용성을 높였습니다. 캐릭터별 설정(부위별 메시, 적용할 TTS 목소리 등)은 하나의 DataAsset으로 묶어 관리해 비개발자 접근성을 높였고, UMG로 캐릭터 변경·목소리 변경·채팅 시스템 UI까지 구현해 런타임 테스트와 개발 속도를 함께 개선했습니다.
{: .solution}

# Speech Plugin 제작 및 런타임 최적화

**캐릭터 발화에 쓰이는 STT/TTS와 챗봇 기능을 여러 프로젝트에서 바로 쓸 수 있어야 했는데, 기존 프로젝트는 런타임 발화 요청 시 프레임 지연과 성능 저하가 있었습니다.**
{: .problem}

Speech 요청 기능을 캐릭터 시스템에서 분리해 WorldSubsystem으로 옮기고, 필요할 때 WorldSubsystem을 통해 호출한 뒤 결과를 호출한 객체로 돌려주는 구조로 설계했습니다. AWS/Google/자사 API가 요청 방식이 제각각이라 기본 클래스 틀을 잡고 상속 구조로 확장했습니다. 프레임 지연의 원인은 서버 요청 시 API가 자체적으로 거는 Async가 Game Thread를 막고 있었던 것이었는데, 요청 로직 전체를 FRunnable 하위 클래스로 스레드 분리하고 파라미터 처리까지 스레드에서 끝낸 뒤 최종 적용만 Game Thread로 넘기는 방식으로 지연 문제를 해결했습니다.
{: .solution}

# WebRTC 기반 웹 스트리밍 서비스 (Pixel Streaming)

**서버에 UE 프로젝트를 띄워두고 어디서나 인터넷만 있으면 접속하는 서비스인데, 환경에 따라 프레임이 떨어지고 연결이 늦어지는 문제가 종종 있었습니다.**
{: .problem}

서버 스펙이 절대적으로 낮아 통신 속도와 UE 실행 스펙이 부족한 게 1차 원인이었습니다. 인프라 팀과 함께 여러 서버 구성을 테스트했고, 서버 비용이 회사 비용과 직결되는 문제라 가장 적은 비용으로 40~60fps를 낼 수 있는 스펙을 연구했습니다. 서비스가 시연되는 지역별로 서버를 세팅해 통신 지연도 최소화했는데, 해외 서비스까지 고려해 지역별 로드밸런싱을 진행하고 인프라 팀 도움으로 각 지역에 동일 서버를 배치했습니다. 서버를 새로 열 때마다 반복되는 기다림과 가이드 부재 문제는, 원격 서버 정보를 관리하는 사내 문서와 bat 파일 기반 초기 세팅 시퀀스를 만들어 해결했습니다.
{: .solution}

# 키오스크 서비스 및 현장 데모

**대형 스크린 키오스크는 AI 전용 GPU만 달린 저사양 컴퓨터라 UE 실행에 적합하지 않았고, 참고할 만한 키오스크용 UE 사례도 거의 없었습니다.**
{: .problem}

터치 스크린 구현 예시를 참고해 UMG로 직접 제작했고, 키오스크 PC 세팅에 따라 터치가 중복 입력되는 문제는 실행 설정으로 노출시켜 환경별로 리빌드하지 않아도 되게 했습니다. Chatbot 기능도 Speech Plugin에 붙여 사내 API 없이 UE 전용 API로 발전시켜, 웹에 의존하지 않고 UE 단독 프로젝트로도 시연할 수 있게 확장했습니다. 하드웨어 한계는 회사에 요청해 키오스크 PC에 GPU를 장착하는 것으로 풀었고, 장비팀과 협업해 최소 비용으로 키오스크 성능을 20fps → 50fps로 끌어올렸습니다.
{: .solution}

2024 AI Expo Korea 현장에서 데모를 시연했고, 관련 내용이 언론에 보도되기도 했습니다.

<video controls preload="none" width="100%" style="max-width:100%; border-radius:12px;">
  <source src="/assets/video/deepbrain-ai/kiosk-demo.mp4" type="video/mp4">
</video>
