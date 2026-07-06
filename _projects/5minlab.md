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
  - name: "3D Printer Simulator"
    url: "https://5minlab.itch.io/3d-printer-simulator"
    desc: "3D Printer Simulator provides a virtual FDM printer whose motions mirror a physical machine. Slice any model yourself and watch every stage of the print come to life."
    inline: true
toc:
  - label: "PMM"
    anchor: "#pmm"
  - label: "3DP (3D Printer Project)"
    anchor: "#3dp-3d-printer-project"
  - label: "PV Project"
    anchor: "#pv-project"
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

# 3DP (3D Printer Project)

## 3D 프린터 시뮬레이션 프로젝트

{% assign tdp_card = page.link_cards | where: "name", "3D Printer Simulator" | first %}
{% include link-card.html name=tdp_card.name url=tdp_card.url desc=tdp_card.desc logo=tdp_card.logo og_image=tdp_card.og_image %}

- 실시간 나나이트 메시 생성으로 고퀄리티 3D 프린터 시뮬레이션을 제공

## 주요 업무

- [3D 프린터 모델 추가](#3d-프린터-모델-추가)
- [나나이트 메시 생성 최적화 연구](#나나이트-메시-생성-최적화-연구)
- [Bowden Cable 구현](#bowden-cable-구현)

## 3D 프린터 모델 추가

<div class="video-embed"><iframe src="https://www.youtube.com/embed/B8eycFDeQKM" title="3D 프린터 모델 추가" allowfullscreen></iframe></div>

- 3D 프린팅 정보 파싱은 Rust로 작성된 외부 프로그램에서 받아오는 형태로 구현

### 3D 프린터 모델 일반화

- 프로젝트의 모델은 기존 하나의 모델만을 위해 하드코딩
- 3D 프린터 출력 시 Rust 코드로부터 받아온 정보를 하나의 상위클래스에서 처리하고 각기 다른 모델의 움직임을 하위 BP에서 구현하고자 클래스 일반화 진행

### 추가된 모델

- 기존 BedSlinger를 추가로 CoreXY, Delta, Positron3D 추가
  - 영상 순서대로 BedSlinger → CoreXY → Delta → Positron3D
- BedSlinger, CoreXY, Positron3D 모델은 Head의 움직임에 따라 Gantry와 Bed의 움직임을 연동해주는 것으로 구현
- Delta 모델은 Head 움직임에 따라 3개의 Arm이 연동되어 움직여야 하는 구조.
  - Delta3D 프린터는 IK(Inverse Kinematics) 구현. Head 움직임에 맞춰서 연결된 3개 Arm의 높낮이가 함께 움직임.

<div class="video-embed"><iframe src="https://www.youtube.com/embed/hCycCSOMH-g" title="Delta Mesh Editor" allowfullscreen></iframe></div>

- 초기 Arm 움직임에 대한 지식이 부족해 높낮이가 자유자재로 움직이거나 이상한 방향으로 튀는 현상이 생겼었고, Delta3D 모델에 적용된 역기구학을 찾아보고 적용함으로 해결

## 나나이트 메시 생성 최적화 연구

### 문제 파악

- 3D 프린팅 시뮬레이션이 지속될수록 프레임이 떨어지는 현상
- Unreal Insights를 이용해 병목이 생기는 지점 파악

### 원인

- 생성된 NaniteMesh는 프린터가 움직임에 따라 Transform이 함께 움직임
- 이 때 실시간으로 생성된 NaniteMesh가 쌓이고 이 Mesh들을 한번에 움직일 때 Transform Movement 병목이 생김.

### 문제 해결 방법 연구

- 실시간으로 생성된 NaniteMesh 묶음을 하나로 통합하는 과정 추가.
- WPO를 이용해 실제 Mesh가 아닌 눈속임수로 효과를 주어 이동하듯이 보여주기

→ CTO 님과의 상의 끝에 WPO 방식을 연구해 봄

### 연구 결과

- 최종적으로 WPO 적용은 불가능으로 판별
- 프레임 개선은 이룰 수 있었지만 WPO의 경우 실제 Mesh가 이동하는 것은 아니기에 BoundBox 이동이 병행되지 않음 → 그림자와 빛 계산이 꼬이면서 부자연스럽게 나오는 현상이 발생하여 최종적으로 적용은 못함. ⇒ 자세한 내용은 아래 WPO 최적화 연구 작업

### WPO 최적화 연구 작업

<div class="video-embed"><iframe src="https://www.youtube.com/embed/rTNPnsBE_vg" title="WPO Test BedSlinger" allowfullscreen></iframe></div>

- WPO 적용한 결과물
  - 개선점
    - 동일 파일 출력 시 기존에는 프레임 변동이 잦고 대략 15fps 정도로 버벅임
    - 안정적인 게임 프레임 확보
  - 문제점
    - BoundBox는 움직이지 않고 Material만 움직이는 형태이기 때문에 빛, 그림자 연산 적용이 꼬이고 BoundBox가 다른 물체에 가려지면 물체도 가려진 것으로 판별되어 사라짐
    - WPO는 큰 움직임을 위한 개념이 아니기 때문에 부적절한 것으로 판단되어 진행 중단
  - 스트레스 테스트

<div class="video-embed"><iframe src="https://www.youtube.com/embed/q2DZSRa0ULI" title="14x14 Stress Test" allowfullscreen></iframe></div>

<div class="video-embed"><iframe src="https://www.youtube.com/embed/J9DXrRbAQ0E" title="30x30 Stress Test" allowfullscreen></iframe></div>

- 14x14, 30x30 개의 StaticMeshComponent WPO 적용 테스트 영상
  - 동일 갯수 StaticMeshComponent의 Transform 이동 대비 프레임 2배 가량 향상
  - StaticMeshComponent의 Transform 이동 시에는 불안정한 프레임 드랍이 발생했지만 WPO 적용 시 안정적인 프레임으로 렌더링

## Bowden Cable 구현

### 구현 목적

- 3D 프린터에 연결된 선을 구현하여 사실감을 더하는 것.

### 접근 방법

1. UE CableComponent를 이용한 구현
2. SplineComponent, SplineMeshComponent를 이용한 케이블 메시 배치

- UE CableComponent는 제공되는 게 많지만 BowdenCable에는 어울리지 않다고 판단하여 2번 방법을 채택
- SplineComponent, SplineMeshComponent를 이용하여 케이블 메시 배치
- 세그먼트 체인 + 물리 시뮬레이션을 이용한 유연 케이블 동역학 구현
- Head 움직임을 따라가는 목표 Spline을 생성하고, 각 관절이 이를 따라가도록 업데이트
- 각 관절은 중력과 스프링/댐핑 계수를 적용해 자연스러운 처짐/진동/지연 표현
  - 미세한 차이 비교를 위해 에디터 변수로 노출하여 계수 조절을 하면서 테스트 진행

### 최종 결과

<div class="video-embed"><iframe src="https://www.youtube.com/embed/DTzbvACoSuU" title="Bowden Cable 초기 버전" allowfullscreen></iframe></div>

- 초기에는 딱딱한 움직임으로 따라옴

<div class="video-embed"><iframe src="https://www.youtube.com/embed/3meqxjwddAU" title="Bowden Cable 개선 버전" allowfullscreen></iframe></div>

- 각 관절마다 중력, 댐핑 계수, 보간을 넣어 조절하여 유연하게 따라오도록 변경
- 보는 관점에 따라 3D Printer에 더 어울리는 모습이 달라질 수 있다고 판단하여 에디터 변수로 조절하며 테스트 결과 반영

# PV Project

- 태양광 패널(PV Panel) 배치 및 태양광 패널 공장 시뮬레이션 게임 프로토타입 제작
- 시간에 따른 태양의 위치 변화 이로 인해 발생하는 그림자와 날씨의 영향으로 태양광 패널의 실시간 발전량을 시뮬레이션하여 태양광 패널 공장을 건설하는 게임

## 레퍼런스 게임

- Satis Factory, Oxygen Not Included, Astroneer, Captain of Industry 와 같은 기지 건설, 자동화 게임

## 조작과 핵심 컨텐츠

### 이동 및 모드

- 1인칭 시점 이동으로 마우스 클릭을 이용한 건물 상호작용 및 건설
- QE 키를 이용한 건물 건설 전 프리뷰 회전

### 태양광 시설 건설

- PV를 설치하기 전에 Frame을 두어 실질적인 태양광 패널 설치 구역을 지정
- Inverter, Battery, Road를 설치해 전력을 생산 → 변환 → 저장 혹은 사용 으로 연결

### 태양광 패널 실시간 계산

- 태양 각도를 이용. 각 태양광 패널에 DepthMap을 이용해 그림자가 드리우는지 여부를 판별
- 만들어진 DepthMap을 일정 비율로 분할하고 각 구역마다 그림자가 드리우는 정도에 따라 수치를 조절하는 방식으로 하나의 패널이 받는 빛의 양을 계산.
- CPU로 로직 테스트 후 수많은 태양광 패널을 동시에 계산하기 위해 ComputeShader를 이용하여 최적화 진행
- 스트레스 테스트
  - 2000개의 태양광 패널 테스트 시 60fps 이상의 성능 확인
- 너무 많아질 경우 부하가 오는 경우가 생김
  - 태양광 패널을 월드 상에서 특정 구역 별로 나누어 순차적 계산 및 업데이트 적용으로 해결
- 시뮬레이션 게임에서 배속을 하더라도 태양이 갑자기 사라지거나 생기는 경우는 없기에 그림자의 변화는 연속적일 것이기에 태양광 패널의 발전량 업데이트가 매 프레임 이루어지지 않아도 되겠다 판단하여 전체 업데이트 인터벌을 두어 최적화 적용.
  - 인터벌은 Project Setting에서 조절할 수 있도록 시스템에 등록

![Panel Capture 다이어그램 - SceneCapture로 패널을 촬영해 Cell 단위로 밝기맵 생성](/assets/images/5minlab/pv-scenecapture-diagram.jpg)

  - Panel별 Scene 캡쳐 후 Cell 단위로 구분. 패널 형태로 밝기맵 생성

### 전선 연결

- 포인트를 두어 각 오브젝트끼리 연결할 수 있도록 구성
- 전선은 각각 +, - 역할을 하기에 정확하게 이어주지 않으면 전력 흐름이 마비됨
- 플레이어가 직접 뛰어다니면서 태양광 전력 생산 공장을 직접 만들고 전력의 흐름도 제어하는 형태를 구현

### 날씨 시스템

- Ultra Dynamic Sky를 이용해 실제 지구와 맞는 위도/경도, 시간에 따른 태양의 움직임 추가.
- 시간의 흐름에 따라 태양이 움직이고 그에 따른 그림자로 태양광 패널의 발전량에 실시간으로 영향을 주는 시스템 구현
- 태양 뿐 아니라 날씨의 변화에 따라서도 영향을 주도록 구현

### 시연 영상

<div class="video-embed"><iframe src="https://www.youtube.com/embed/HnHzzLkWWqc" title="PV Project 시연 영상 1" allowfullscreen></iframe></div>

<div class="video-embed"><iframe src="https://www.youtube.com/embed/da2NPdw2j9U" title="PV Project 시연 영상 2" allowfullscreen></iframe></div>
