---
title: Deepbrain AI
type: company
category: game-graphics
period: "2023.08.01 - 2025.02.28"
order: 2
summary: "메타휴먼 기반 실시간 대화형 3D AI 아바타 서비스, Viseme 립싱크, Speech 플러그인, Web Streaming/Kiosk 최적화"
thumbnail: /assets/images/deepbrain-ai/thumbnail.png
team: "메타버스팀 | 정직원"
stack: ["Unreal Engine", "MetaHuman", "UMG", "Pixel Streaming"]
link_cards:
  - name: "관련 언론 보도 (bikorea.net)"
    url: "https://m.bikorea.net/news/articleView.html?idxno=39761"
    inline: true
toc:
  - label: "프로젝트 개요"
    anchor: "#프로젝트-개요"
  - label: "주요 업무"
    anchor: "#주요-업무"
  - label: "Viseme to Facial Animation"
    anchor: "#viseme-to-facial-animation"
  - label: "모듈형 캐릭터 / UI / 커스터마이징"
    anchor: "#모듈형-캐릭터--ui--커스터마이징"
  - label: "Speech Plugin 제작 및 런타임 최적화"
    anchor: "#speech-plugin-제작-및-런타임-최적화"
  - label: "WebRTC 기반 웹 스트리밍 서비스 구현(Pixel Streaming)"
    anchor: "#webrtc-기반-웹-스트리밍-서비스-구현pixel-streaming"
  - label: "키오스크 서비스 및 현장 데모"
    anchor: "#키오스크-서비스-및-현장-데모"
---

# 프로젝트 개요

![DeepbrainAI 메타휴먼 기반 3D 아바타](/assets/images/deepbrain-ai/thumbnail.png)

- 기존 사내 프로젝트는 Web을 기반으로 한 2D 아바타로, 챗봇 답변에 맞춰 제작한 TTS 데이터를 바탕으로 아바타의 입모양을 움직여 실제 사람처럼 말하게 함
- 언리얼 엔진을 이용한 고퀄리티 3D 아바타 구현과 UE PixelStreaming을 이용한 웹 실시간 서비스를 목적으로 함

# 주요 업무

- [프로젝트 개요](#프로젝트-개요)
- [주요 업무](#주요-업무)
- [Viseme to Facial Animation](#viseme-to-facial-animation)
  - [구현 목적 및 문제](#구현-목적-및-문제)
  - [해결 방법](#해결-방법)
- [모듈형 캐릭터 / UI / 커스터마이징](#모듈형-캐릭터--ui--커스터마이징)
  - [구현 목적 및 문제](#구현-목적-및-문제-1)
  - [해결 방법](#해결-방법-1)
  - [캐릭터 영상 자료](#캐릭터-영상-자료)
- [Speech Plugin 제작 및 런타임 최적화](#speech-plugin-제작-및-런타임-최적화)
  - [구현 목적 및 문제](#구현-목적-및-문제-2)
  - [해결 방법](#해결-방법-2)
- [WebRTC 기반 웹 스트리밍 서비스 구현(Pixel Streaming)](#webrtc-기반-웹-스트리밍-서비스-구현pixel-streaming)
  - [구현 목적 및 문제](#구현-목적-및-문제-3)
  - [해결 방법](#해결-방법-3)
- [키오스크 서비스 및 현장 데모](#키오스크-서비스-및-현장-데모)
  - [구현 목적 및 문제](#구현-목적-및-문제-4)
  - [해결 방법](#해결-방법-4)
  - [키오스크 서비스 사례](#키오스크-서비스-사례)

# Viseme to Facial Animation

## 구현 목적 및 문제

- 딥브레인AI 아바타 서비스의 핵심은 STT/TTS 기반 캐릭터 발화 — TTS 음성에 맞춰 캐릭터의 입모양을 자연스럽게 움직이는 것이 서비스 품질을 결정하는 가장 중요한 과제
- 사전에 준비된 대사에서 입모양 시퀀스를 뽑아내는 것은 정확도가 높았지만, 실시간으로 들어오는 음성을 즉시 Facial Animation에 적용하는 것이 가장 큰 난제
- 기존에는 Oculus의 [OVR LipSync](https://developers.meta.com/horizon/documentation/unity/audio-ovrlipsync-unity/)를 사용 — 당시 립싱크 솔루션 중 UE 공식 플러그인이 있는 것은 OVR뿐이었는데, 그마저도 제대로 된 viseme 값을 내지 못하는 상태
- 보간을 거쳐도 영어 발음에만 정확했고, OVR은 자체 viseme 기호 15종(sil, PP, FF, TH 등) 체계를 사용해 다른 viseme 데이터와 매칭이 어려움

## 해결 방법

- OVR 내부 코드를 카피·재작성해 출력 값을 세부적으로 컨트롤할 수 있도록 만든 뒤, Audio 파일을 입력으로 받아 출력된 viseme 값을 프레임 단위로 각 viseme마다 FFT 기반 보간·스무딩 적용
- 다국어 지원을 위해 [Azure Speech Viseme](https://learn.microsoft.com/ko-kr/azure/ai-services/speech-service/how-to-speech-synthesis-viseme?tabs=visemeid&pivots=programming-language-python) 도입
  - viseme ID 22종과 Audio offset(발화 타이밍) 형태로 반환되고, 언어별 음소 값→viseme 매핑을 제공해 언어 제약 해소
  - UE를 지원하지 않아 viseme 요청·응답 API를 직접 라이브러리화해 UE로 이식
- OVR과 Azure 두 viseme 소스를 같은 인터페이스로 함께 쓸 수 있도록 코드 통합
  - ⇒ Speech Plugin의 멀티스레드 분리·플러그인화 작업에서 가장 큰 비중을 차지한 핵심 작업
- Viseme을 애니메이션에 연결하는 방식을 여러 갈래로 연구 — Key 값으로 만들어 StateMachine에서 보간하는 방식, 커브로 만들어 보간하는 방식 등을 비교
  - ⇒ Viseme별로 State를 전환하는 StateMachine 방식이 가장 정확도가 높았고, State별 블렌딩 속도·영향도·얼굴 표정까지 고려해 자연스럽게 이어지도록 구현
- 캐릭터 모델마다 얼굴 근육 구성이 달라 캐릭터별 발음 기호 튜닝이 필요
  - ⇒ AnimBP에서 StateMachine별 블렌딩 수치를 조절할 수 있도록 노출하고, 여러 발음 기호가 겹칠 때 multiply로 강조하는 식의 조합 튜닝까지 아티스트가 직접 할 수 있도록 시스템화 (모프타겟 자체 수정은 아티스트 영역으로 분리)

<div class="video-embed"><iframe src="https://drive.google.com/file/d/1sdYGcoxhU4GaiZWTK1PpvYFqgfU7ha9S/preview" title="Viseme 립싱크 발화 데모" allowfullscreen></iframe></div>

### NVIDIA ACE

- 개발 도중 NVIDIA 카이로스(Kairos) 데모와 ACE(Audio2Face)가 공개되었고, 기존 작업 방식보다 더 빠르게 서비스에 적용해볼 수 있을 것이라 판단해 별도 적용 연구를 진행
  - STT/TTS는 이미 플러그인으로 구현되어 있어 음성 파일을 가져다 넣는 것이 핵심이었고, TTS에서 바로 뽑혀 나온 음성 파일을 ACE 시스템에 넣어 더 자연스러운 얼굴이 나오는 것을 테스트
  - ⇒ 기존 방식에 더해 더 높은 퀄리티의 페이셜 애니메이션을 뽑을 수 있는 가능성 확인

<div class="link-cards">
  <div><a class="link-card" href="/blog/2024/12/16/nvidia-ace-unreal/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">NVIDIA ACE 사용해보기</p>
      <p class="link-card-desc">언리얼 엔진에 NVIDIA ACE 플러그인을 적용해 Audio2Face 기반 페이셜 애니메이션을 테스트한 기록</p>
      <p class="link-card-url">/blog/2024/12/16/nvidia-ace-unreal/</p>
    </div>
  </a></div>
</div>

당시 참고 자료: [Azure viseme 소개 영상](https://www.youtube.com/watch?v=ui9XT47uwxs) · [Azure EmbodiedAI 립싱크 샘플](https://www.youtube.com/watch?v=lo898xUzPPA) · [언리얼4 립싱크(TTS) 구현 방법](https://nedcrow.tistory.com/entry/%EC%96%B8%EB%A6%AC%EC%96%BC4-%EB%A6%BD%EC%8B%B1%ED%81%ACText-To-Speech-%EA%B5%AC%ED%98%84-%EB%B0%A9%EB%B2%95-Part3)

# 모듈형 캐릭터 / UI / 커스터마이징

## 구현 목적 및 문제

- 상황에 맞춰 아바타의 머리와 옷을 부위 별 여러 형태로 바꿔가며 사용하여 에셋 재사용성을 높이고 아바타 별 작업 시간을 단축하는 것이 목표
- 캐릭터별로 나뉘어 있던 클래스 구조가 발목을 잡음
  - 기존에는 캐릭터 별 C++ 클래스를 개별로 만들고, 이를 상속한 블루프린트·애님BP까지 따로따로 생성해서 관리
  - ⇒ 개발자를 거치지 않으면 아티스트가 새로운 캐릭터를 적용해보거나 수치를 조절해볼 수도 없던 상황
  - 블루프린트 클래스로 통합한 후에도 비개발자 인원들이 수치를 조절하거나 값을 바꾸는 등의 어려움을 겪음
- TTS의 경우 AWS/Google/자사 제품을 상황에 맞춰 사용했는데 이를 캐릭터 블루프린트 별 하드코딩으로 팀 내 작업 시 혼동이 발생 및 Git Conflict가 수시로 발생
- 사내 개발진의 런타임 테스트 및 유저 편의성 제공을 위한 UI가 필요함을 느껴 제작

## 해결 방법

- 캐릭터별로 나뉘어 있던 클래스의 공통 부분을 하나의 `DBAICharacterBase`로 추출하고, 캐릭터별 차이는 BP(블루프린트) 확장으로 흡수
  - ⇒ 블루프린트 상에서 캐릭터 수치 등을 조절할 수 있게 되어 제작된 캐릭터를 컴파일 없이 바로 테스트 가능
  - AnimBP도 하나로 통합한 후 Retargeting을 이용해 여러 캐릭터에 적용될 수 있도록 연구 및 팀 내 공유
  - ⇒ 캐릭터 메시만 새로 만들면 되고 애니메이션은 별도로 작업하지 않아도 되어 범용성을 늘림
- 하나의 DataAsset에 통합되는 설정을 묶어서 캐릭터 별 데이터로 관리
  - ⇒ 캐릭터 부위 별 메시부터 적용할 TTS 목소리를 미리 설정할 수 있게 하여 데이터로 보기 쉬워지고 비개발자들의 접근성을 향상 (TTS 하드코딩·Git Conflict 문제도 함께 해소)
- UMG를 이용해 캐릭터 변경, 목소리 변경, 채팅 시스템 UI 구현
  - ⇒ 런타임 테스트를 가능하게 하여 개발 속도 상향, UI를 유연하게 변경할 수 있도록 기능 분리를 해두어 프로젝트 별 필요 UI만 노출

<img class="flow-diagram" src="/assets/images/deepbrain-ai/character-structure-flow.png" alt="캐릭터 구조 통합 흐름도">

## 캐릭터 영상 자료

![캐릭터 부위별 커스터마이징 예시](/assets/images/deepbrain-ai/dbai-1.png)

<div class="video-embed"><iframe src="https://drive.google.com/file/d/106AI0HiuonghNVSi19MiAByDj_YEQmtv/preview" title="캐릭터 영상 자료 2" allowfullscreen></iframe></div>

<div class="video-embed"><iframe src="https://drive.google.com/file/d/1dNULhN6k7wymNdvKX9f4_9Nk90p9FKLm/preview" title="캐릭터 영상 자료 3" allowfullscreen></iframe></div>

<div class="video-embed"><iframe src="https://drive.google.com/file/d/1Mx7WcIb56gClQw0J83r_MZTxdNNIzsy-/preview" title="캐릭터 영상 자료 4" allowfullscreen></iframe></div>

<div class="video-embed"><iframe src="https://www.youtube.com/embed/jo8WvTWOfac?start=15" title="캐릭터 영상 자료 5" allowfullscreen></iframe></div>

<div class="video-embed"><iframe src="https://drive.google.com/file/d/1HcKosu3FpGl98hrk0EaJk721oO59PSQ3/preview" title="캐릭터 영상 자료 6" allowfullscreen></iframe></div>

# Speech Plugin 제작 및 런타임 최적화

## 구현 목적 및 문제

- 캐릭터 발화에 사용되는 핵심 로직인 STT/TTS와 챗봇 기능을 여러 프로젝트에서 바로 적용할 수 있도록 하기 위한 Plugin 분리 개발 프로젝트
- 기존 프로젝트 런타임 발화 요청 시 프레임 지연과 성능 저하 문제

## 해결 방법

- 플러그인 분리
  - 캐릭터 시스템에 종속적으로 붙어있던 Speech 요청 기능을 WorldSubsystem으로 분리
  - 요청이 필요한 경우 WorldSubsystem을 이용해 호출하고 반환된 값을 호출한 객체로 전달하도록 설계
  - AWS, Google, DBAI 모두 요청 방식이 달랐기에 기본 클래스 틀을 잡고 상속 구조로 확장
  - 요청을 넣을 때에는 설정이 담긴 구조체와 함께 Execute() 함수로 실행
- 프레임 지연과 성능 저하 문제
  - 서버로 요청을 넣을 때 API가 자체적으로 Async를 걸며 GameThread에서 지연 발생이 원인으로 모든 요청 로직을 FRunnable 하위 클래스를 이용해 스레드 분리
  - 파라미터 처리까지 스레드에서 처리 후 최종 적용만 GameThread로 넘겨 지연 문제를 해결

<img class="flow-diagram" src="/assets/images/deepbrain-ai/speech-plugin-flow.png" alt="Speech Plugin 분리 흐름도">

<img class="flow-diagram" src="/assets/images/deepbrain-ai/thread-flow.png" alt="요청 처리 스레드 분리 흐름도">

# WebRTC 기반 웹 스트리밍 서비스 구현(Pixel Streaming)

## 구현 목적 및 문제

- DBAI의 메인 서비스는 WebPage 실시간 영상 제작과 실시간 스트리밍 서비스
- 언리얼 엔진의 Pixel Streaming 기술을 이용해 서버에는 UE 프로젝트를 띄워놓고 사용자는 언제 어디서든 인터넷만 된다면 서비스를 이용할 수 있도록 제공하는 것이 목적
- 웹에서 실행할 경우 환경에 따라 프레임이 떨어지고 연결이 늦는 문제가 종종 발생

## 해결 방법

- 기본적인 서비스 형태는 갖춰져 있었으나 주먹구구식에 프로젝트 업로드 시에도 반복되는 기다림의 반복, 새로운 서버를 열 때 가이드가 없어 오랜 시간이 걸렸음
  - ⇒ 사내 문서를 만들어 관리되고 있는 원격 서버 정보를 관리
  - ⇒ 클라우드 서버 특성 상 새로 오픈할 때마다 초기화가 되는 점을 고려해 bat 파일로 기본 동작 시퀀스 만들고 UE 프로젝트를 위한 필수 파일 설치 방법 문서화
- 절대적인 서버 스펙이 현저히 낮아 통신 속도와 UE를 돌릴 스펙이 부족했던 것이 1차적인 원인
  - ⇒ 인프라 팀과 협업하여 여러 형태의 서버 테스트
  - ⇒ 서버 관리 문제는 회사 비용과도 직결되는 문제이기에 가장 적은 금액으로 최소 40~60프레임 서비스가 가능한 서버 스펙을 연구
- 서비스가 시연되는 지역 별로 서버를 세팅하여 통신 딜레이 최소화
  - ⇒ 해외 서비스도 나가는 것을 고려하여 지역 별로 로드밸런싱을 진행. 인프라 팀의 도움을 받아 각 지역 별로 같은 서버를 배치하고 필요한 UE 버전을 업데이트하여 네트워크 지연으로 생기는 프레임 저하를 방어

# 키오스크 서비스 및 현장 데모

## 구현 목적 및 문제

- 회사 메인 서비스 중 키오스크 서비스
- UE 터치 입력을 이용해 웹을 거치지 않고 키오스크 상에서 서비스 제공
- 대형 스크린을 사용하는 키오스크 PC는 AI 전용 GPU만 달린 상태의 저사양 컴퓨터로 UE 실행에 적합하지 않음

## 해결 방법

- 키오스크 관련 UE 프로젝트 예시는 자료가 거의 없다시피 해 터치 스크린 구현 예시를 보며 UMG 제작
  - ⇒ 키오스크 PC 세팅에 따라 터치가 제대로 되는가 하면 여러번 연속으로 들어가는 경우도 생겨 실행 설정으로 노출시켜 환경에 따른 리빌딩을 방지
- Chatbot 기능도 SpeechPlugin에 장착하여 사내 API를 거치지 않고 UE 전용 API로 발전시켜 사용
  - ⇒ 기존에는 웹에 의존해야만 했지만 UE 독립 프로젝트로도 시연할 수 있도록 플러그인 발전시킴
  - ⇒ 필요에 맞춰 사용할 수 있도록 개선하여 UE 아바타 서비스의 범용성 확장
- 하드웨어 적인 한계는 회사 측에 요청하여 하나의 키오스크 PC에 GPU를 장착
  - ⇒ 필요한 최소 스펙과 세팅을 위해 장비팀과 협업하며 최소 금액으로 성능 개선
  - ⇒ 키오스크 성능 기존 20fps → 50fps로 개선

## 키오스크 서비스 사례

- 2024 AI Expo Korea 현장 데모 시연 진행

{% assign news_card = page.link_cards | where: "name", "관련 언론 보도 (bikorea.net)" | first %}
{% include link-card.html name=news_card.name url=news_card.url desc=news_card.desc logo=news_card.logo og_image=news_card.og_image %}

- 사내 키오스크 테스트 영상

<video controls preload="none" width="100%" style="max-width:100%; border-radius:12px;">
  <source src="/assets/video/deepbrain-ai/kiosk-demo.mp4" type="video/mp4">
</video>
