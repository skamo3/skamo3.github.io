---
title: 5minlab
type: company
category: game-graphics
period: "2025.10.20 - 2026.01.20"
order: 1
summary: "PMM 버전 업데이트, 3D 프린터 시뮬레이터 최적화, 태양광 샌드박스 게임 프로토타입"
thumbnail: /assets/images/5minlab/thumbnail.png
team: "5ml tech dept. | 인턴"
link_cards:
  - name: "5minlab"
    url: "https://5minlab.com/ko/"
    logo: /assets/images/5minlab/logo.png
  - name: "Private Military Manager"
    url: "https://store.steampowered.com/app/2564320/_/"
---

언리얼 엔진 기반 컨텐츠 개발을 담당했습니다.

# PMM 버전 업데이트

**PMM은 JavaScript 로직과 UE 진행을 CEF로 연동하는 구조였는데, UE 실행 시 자체적으로 실행되는 CEF 버전이 JS 업데이트와 맞지 않아 내부 툴이 제대로 실행되지 않는 버그가 있었습니다.**
{: .problem}

원인을 추적해보니 UE 5.5는 CEF `90.6.7+g19ba721+chromium-90.0.4430.212`, UE 5.7은 CEF `128.4.13+ge76af7e+chromium-128.0.6613.138`을 쓰는데, JS 쪽에서는 Chromium 120 버전 이상을 요구하고 있었습니다. 즉 UE 엔진 자체를 업데이트해야만 CEF 버전이 맞아떨어지는 상황이었습니다. 버전을 맞추는 방법은 두 가지였습니다 — 엔진 내부 코드에서 버전 값만 임의로 바꾸는 방법과, 실제로 UE를 5.7로 올리는 방법. 임의 수정이 만들 사이드 이펙트보다 5.7의 CEF 버전이 더 안정적이라고 판단해 실제 엔진 업데이트를 선택했습니다.
{: .solution}

**엔진 버전을 업데이트하면서 기존에 쓰던 플러그인들의 버전 이슈가 함께 터졌습니다.**
{: .problem}

PMM에서 쓰던 플러그인 중 상당수가 Deprecated 되었거나 하위 버전 이후로 업데이트가 멈춰 있었고, UE가 5.7로 올라가면서 내부 코드도 크게 바뀌어 자체적으로 대응이 필요했습니다. 전체 플러그인을 리스트업해두고 5.7에서 에러가 나는 항목만 따로 분리한 뒤, 플러그인별 에러 원인을 파악해가며 내부 코드를 하나씩 고쳤습니다. 새 버전 컨텐츠는 이미 준비돼 있었기 때문에, 이 작업이 끝나자 바로 버전 업데이트를 진행할 수 있었습니다. Steam에 새 버전을 올리기 전 플레이 테스트로 문제 없음을 확인한 뒤 CTO님께 전달하며 마무리했습니다.
{: .solution}

# 3D 프린터 시뮬레이터

- 가상에서 실제와 같은 3D 프린터 모델 및 구성요소 구현
- 실시간 NaniteMesh 생성 시 발생하는 프레임 드랍 최적화 연구 (Unreal Insight 활용)

# 태양광 샌드박스 게임 프로토타입

- 월드 시뮬레이션에 따른 실시간 태양광 발전량 계산 기능 개발
- 태양광 관련 오브젝트 배치와 전기적 연결 구현으로 플레이어가 직접 만드는 태양광 공장
