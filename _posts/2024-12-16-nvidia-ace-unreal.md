---
title: "NVIDIA ACE 사용해보기"
date: 2024-12-16
category: unreal
---

생성형 AI가 대세인 요즘 Unreal Engine도 예외는 아니다.

요즘은 게임의 컷씬 하나하나가 영화와 같은 퀄리티를 가지곤 한다.

컷씬에서는 캐릭터들 간의 대화가 오가는 경우가 있고 이런 컷씬의 퀄리티가 플레이어의 몰입도를 높여주곤 한다.

[NVIDIA Kairos Demo](https://www.nvidia.com/ko-kr/geforce/news/nvidia-ace-for-games-generative-ai-npcs/) 는 언리얼 엔진에서 캐릭터에게 자연스러운 발화와 표정, 플레이어와의 상호작용 등을 생성형 AI로 처리하면서 더 높은 퀄리티의 캐릭터 제작을 도와준다.

## NVIDIA ACE 언리얼에 적용하기

이 글은 언리얼 엔진에서의 NVIDIA ACE 플러그인 사용 방법을 번역한 글이다.

순서는 [NVIDIA ACE Plugin 설치](https://docs.nvidia.com/ace/latest/workflows/kairos/ace-unreal-plugin-install.html) -> [캐릭터 애니메이션 세팅](https://docs.nvidia.com/ace/latest/workflows/kairos/ace-unreal-plugin-animation.html) -> [Audio to Face](https://docs.nvidia.com/ace/latest/workflows/kairos/ace-unreal-plugin-audio2face.html) 적용 으로 진행된다

### NVIDIA ACE 설치 및 적용. 기본 세팅

기본 준비 사항

- [언리얼 엔진 기본 설정](https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-visual-studio-development-environment-for-cplusplus-projects-in-unreal-engine?application_version=5.4)
- 언리얼 엔진은 5.3 or 5.4 버전
- OS는 Linux 또는 Window64

플러그인 설치

1. 설치된 엔진 버전에 맞는 [NVIDIA ACE Unreal Engine 플러그인](https://developer.nvidia.com/ace/get-started#section-ace-tools-and-reference-workflows) 다운로드
2. 엔진 Directory 하위의 Engine/Plugins/MarketPlace에 플러그인 파일 위치
3. 프로젝트에 플러그인 추가
   - Unreal Engine 실행 후 Plugin -> NVIDIA ACE 추가
   - ![프로젝트.uplugin에 직접 등록](/assets/images/blog/nvidia-ace-unreal/plugin-add.png)
     프로젝트.uplugin 에 직접 등록
4. Edit -> Edit Preference(에디터 개인설정) 에서 Level Editor / Miscellaneous / Create New Audio Device for Play in Editor 비활성화.
   - ![오디오 디바이스 설정](/assets/images/blog/nvidia-ace-unreal/audio-device-setting.png)
     이 옵션이 켜져 있으면 ACE로부터 받은 오디오가 재생 되지 않음.

### 메타휴먼 or 커스텀 캐릭터에 ACE 적용

1. Quixwl Bridge 에서 [메타휴먼](https://dev.epicgames.com/documentation/en-us/metahuman/metahuman-documentation) 추가

   ![Quixel Bridge에서 메타휴먼 추가](/assets/images/blog/nvidia-ace-unreal/metahuman-add.png)

2. Animation Blueprint 변경
   - 메타휴먼 Character Blueprint 의 Face 탭을 클릭하면 적용된 Anim BP가 Face_AnimBP로 되어있음
   - 해당 AnimBP의 Animation Graph 선택
   - `Apply ACE Face Animations` 노드 추가 후 ARKit pose mapping 전에 적용. 일반적으로 `mh_arkit_mapping_pose` 또는 `mh_arkit_mapping_pose_A2F` 노드 전에 추가.
   - 메타휴먼 기본 Mouth Close 제거
     - Audio2Face는 입술 움직임과 관련된 커브를 제공하기에 메타휴먼에서 기본으로 제공하는 Mouth Close를 제거해주는 것을 추천

       ![Mouth Close 제거](/assets/images/blog/nvidia-ace-unreal/mouth-close-remove.png)

3. Character Blueprint에 ACE Audio Component 추가
   - 캐릭터 블루프린트 내부에서 Face에 해당하는 Skeletal Mesh 컴포넌트 선택.
   - `+Add` 버튼 클릭 후 `ACEAudioCurveSource` 컴포넌트 추가
   - `ACEAudioCurveSource` 컴포넌트 추가 세팅 (Optional)
     - [공간 음향](https://docs.nvidia.com/ace/latest/workflows/kairos/ace-unreal-plugin-animation.html#spatial-audio-optional)
     - [다른 ACE Audio Component 세팅](https://docs.nvidia.com/ace/latest/workflows/kairos/ace-unreal-plugin-animation.html#other-ace-audio-component-settings-optional)
     - [Animation Start, End Events 딜리게이트](https://docs.nvidia.com/ace/latest/workflows/kairos/ace-unreal-plugin-animation.html#animation-start-and-end-events-optional)

#### [메타휴먼이 아닌 캐릭터에 대한 세팅 방법](https://docs.nvidia.com/ace/latest/workflows/kairos/ace-unreal-plugin-animation.html#notes-for-non-metahuman-characters)

- 메타휴먼 포즈 에셋도 ARKit 베이스의 얼굴 타겟에 대한 포즈 커브를 변경시키는 방식으로 자체 제작한 캐릭터도 위 링크에 있는 타겟을 가진 Pose Asset 을 연결 해 둔다면 같은 방식으로 이용 가능.

### A2F 실행 및 옵션

1. Audio2Face 연결 세팅
   - Edit -> Project Settings ... -> Plugins -> NVIDIA ACE -> Default A2F Server Config 탭에서 필요 정보 입력
     - Dest URL : 데이터 요청할 서버 주소. scheme(http 또는 https), host (IP address 또는 hostname), 포트 번호가 반드시 포함되어 있어야 함. 예시) `http://203.0.113.37:52000` or `https://a2x.example.com:52010` (both fictional examples). NVIDIA Cloud Function (NVCF)에 연결하는 주소는 `https://grpc.nvcf.nvidia.com:443`
     - API Key : NVCF-hosted A2F service 연결에 필요한 인증키. [https://build.nvidia.com/nvidia/audio2face](https://build.nvidia.com/nvidia/audio2face) 주소에서 인증 키 발급 가능.
     - NvCF Function Id : Face Animation 형태가 잡힐 모델 Id 로 예상됨.

       ![NvCF Function Id 설정](/assets/images/blog/nvidia-ace-unreal/nvcf-function-id.png)

     - NvCF Function Version : 모델의 특정 버전 정보. 필요 없다면 비워도 무관.
2. Speech Clip 임포트
   - ACE 플러그인은 SoundWave 에셋 or .wav 포맷에 해당하는 파일을 지원
   - 클립은 런타임 중 16000hz mono 로 변환 됨.
   - .wav, .ogg, .flac 등의 파일을 contents browser에 끌고 와 적용하면 자동으로 SoundWave로 변환 됨
3. 애니메이션 재생
   - SoundWave 를 이용한 방법
     - `Animate Character from Sound Wave Aysnc` 노드 적용

       ![Animate Character from Sound Wave Async 노드](/assets/images/blog/nvidia-ace-unreal/animate-soundwave-node.png)

   - wav file을 이용한 방법
     - `Animate Character from Wav File Async` 노드 적용

       ![Animate Character from Wav File Async 노드](/assets/images/blog/nvidia-ace-unreal/animate-wavfile-node.png)

       -> Path는 절대 경로를 가져오기 때문에 전체 경로 or `Get Project Content Directory` 노드로 상대 경로를 잡아주어야 함
   - 두 노드 사용 방식은 동일하고 SoundWave 파일이냐 path를 넣어주냐의 차이
4. 요청 시 추가 파라미터
   - [ACE Emotion Parameters](https://docs.nvidia.com/ace/latest/workflows/kairos/ace-unreal-plugin-audio2face.html#adjusting-character-emotion-optional)
     - 감정에 대한 정보 수치를 조절할 수 있는 파라미터

       ![ACE Emotion Parameters](/assets/images/blog/nvidia-ace-unreal/emotion-parameters.png)

     - `Make Audio2FaceEmotionOVerride` 노드로 기본 감정 값을 조절할 수 있고 `Make Audio2FaceEmotion` 노드로 추가 수치 조절 가능
   - [Audio 2 Face Parameters](https://docs.nvidia.com/ace/latest/workflows/kairos/ace-unreal-plugin-audio2face.html#adjusting-audio2face-parameters-optional)
     - `Create Audio 2Face Parameters` 노드로 파라미터 생성 후 `Set Parameter`에 Param Name과 수치를 쌍으로 지어 값 추가

       ![Create Audio2Face Parameters 노드](/assets/images/blog/nvidia-ace-unreal/audio2face-parameters-node.png)

     - 넣으려는 파라미터 정보에 따라 Set Parameter 노드가 추가되면 됨

## 해결이 필요한 이슈

- 게임 플레이 후 데이터를 요청하면 처음 요청이 들어갈 때 지연이 생김. 요청 시 GameThread 에서 Lock이 걸리는 듯.
  - Async를 이용해서 우회 요청하거나 다른 해결 방법을 찾아봐야 할 듯.
