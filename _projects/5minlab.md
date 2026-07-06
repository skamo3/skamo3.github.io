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
    inline: true
toc:
  - label: "PMM"
    anchor: "#pmm"
  - label: "3D 프린터 시뮬레이터"
    anchor: "#3d-프린터-시뮬레이터"
  - label: "태양광 샌드박스 게임 프로토타입"
    anchor: "#태양광-샌드박스-게임-프로토타입"
---

# PMM

{% assign pmm_card = page.link_cards | where: "name", "Private Military Manager" | first %}
{% include link-card.html name=pmm_card.name url=pmm_card.url desc=pmm_card.desc logo=pmm_card.logo og_image=pmm_card.og_image %}

## 엔진 버전 업데이트 적용 및 내부 툴 버그 해결

- PMM은 JavaScript로 로직이 돌고 UE에서 게임이 진행되는 방식으로 구현되어있던 프로젝트
- UE가 실행될 때 자체적으로 CEF를 실행하는데 JS 버전 업데이트와 UE 버전 업데이트가 함께 가지 못하면서 내부 툴이 제대로 실행되지 않는 버그 발생.
- 내부 툴 버그를 해결하기 위해 UE 버전 업데이트가 필요했고 5.7에 적용된 CEF 버전이 프로젝트에서 사용중이던 JS 버전과 맞음을 확인하고 버전 업데이트 진행

## CEF 버전 문제

- JavaScript의 버전은 업데이트 되었지만 UE 엔진 버전 업데이트는 함께 이루어지지 않았기에 UE 5.7로 올려서 CEF 버전을 맞춰주어야 했음
- UE 5.5는 `90.6.7+g19ba721+chromium-90.0.4430.212` 버전, UE 5.7은 `128.4.13+ge76af7e+chromium-128.0.6613.138` 버전을 사용 → JS 쪽에서는 120 버전 이상을 요구했기에 엔진 버전 업데이트가 필수

## 버전 업데이트와 플러그인 임의 수정

- CEF 버전을 적용하기 위해서는
  1. 엔진 내부 코드에서 임의로 버전을 입력한다.
  2. UE 버전을 올려서 최신 업데이트를 적용한다.
- 두 가지 선택지가 있었고, 엔진 내부 코드를 건드렸을 때 사이드 이펙트와 UE 5.7의 CEF 버전이 안정적인 것을 고려하여 2번으로 선택.

## 플러그인 업데이트

- 엔진 버전 업데이트를 진행하면서 기존 플러그인들의 버전 이슈가 함께 생김.
- PMM에서 사용 중인 플러그인 중에는 Deprecated 되거나 하위 버전 이후로 업데이트를 멈춘 경우가 많았고 UE의 경우 5.7 버전으로 업데이트 되면서 내부 코드가 많이 바뀌어 자체적인 업데이트가 필요해짐
- 전체 플러그인 리스트업 해두고 UE 5.7에서 에러가 발생하는 플러그인 분리
- 각 플러그인 별 에러 사항 파악하고 자체적으로 내부 코드 변경하면서 에러를 하나씩 해결

## 최종 버전 업데이트 및 테스트

- 새로운 업데이트 버전의 컨텐츠는 준비가 되어있는 상태였고 버전 업데이트에 맞추며 PMM 새로운 버전 업데이트를 진행
- Steam에 새로운 버전 업로드를 위한 플레이 테스트 진행. 큰 문제 없이 작동하는 것 확인 후 CTO님께 전달하여 프로젝트 마무리

# 3D 프린터 시뮬레이터

- 가상에서 실제와 같은 3D 프린터 모델 및 구성요소 구현
- 실시간 NaniteMesh 생성 시 발생하는 프레임 드랍 최적화 연구 (Unreal Insight 활용)

# 태양광 샌드박스 게임 프로토타입

- 월드 시뮬레이션에 따른 실시간 태양광 발전량 계산 기능 개발
- 태양광 관련 오브젝트 배치와 전기적 연결 구현으로 플레이어가 직접 만드는 태양광 공장
