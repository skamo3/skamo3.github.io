---
title: "[Zolta] Codex 활용해 애니메이션 제작해보기"
date: 2026-07-16
category: game-dev
---

스킬 시스템에 사용할 애니메이션을 구해보다가, Codex 5.6 Sol을 이용해 애니메이션을 직접 제작할 수 있지 않을까? 하는 궁금증이 생겼다. Mixamo에서 가져오는 애니메이션은 RootMotion 문제도 있고 Free Animation으로 낼 수 있는 퀄리티의 한계도 있어서, Codex가 UE의 Control Rig을 활용해서 만들게 하면 의외로 잘 할 수도 있지 않을까? 하는 기대로 도전해봤다.

## Codex 검증 및 가능성 발견

직접 애니메이션을 만들도록 명령을 줬을 때, Codex는 분명 만들 수 있다고 했다. Mixamo 애니메이션을 Control Rig으로 베이크한 뒤 수정하는 하이브리드 방식이 효율적이라며, 프로젝트에 이미 있는 `SKM_Manny_Simple`, `CR_Mannequin_Body`, `LS_Animation` 자산을 활용한 작업 흐름까지 제시했다. Sequencer에서 `Backwards Solve`로 기존 애니메이션을 Control Rig에 가져오고, 키를 수정한 뒤 다시 베이크하는 그럴듯한 계획이었다.

![Codex가 제시한 Control Rig 베이크 기반 애니메이션 제작 계획 — Mixamo 변환부터 Bake To Control Rig, 키 수정, Montage 생성까지 9단계 작업 흐름](/assets/images/zolta/codex-anim-plan.png)

## 높은 토큰 사용량

원하는 동작은 "제자리에서 낮은 도약과 함께 크게 베고, 지나간 경로에 데미지를 남기면서 끝 지점에서 검기를 방출"하는 스킬 애니메이션이었다. 레퍼런스로 리그 오브 레전드 요네의 Q3를 던져줬다.

작업을 시켜놓고 보니, 내부적으로는 UE Python 코드를 이용해서 headless로 에디터를 돌리며 키를 찍는 방식을 사용한 것 같다. 그런데 그 과정이 순탄치 않았다.

![Codex 작업 진행 중 — 요네 Q3 레퍼런스를 받아 이동 거리와 애니메이션을 분리하기로 결정하고, headless 실행 실패와 NullRHI 버그를 우회해가는 과정](/assets/images/zolta/codex-anim-progress.png)

- 첫 headless 실행은 로그 파일 경로 옵션에서 실패
- 임시 Actor를 월드에 배치하는 과정에서 UE 5.7의 `NullRHI` 버그로 생성 중단
- 새 Control Rig 트랙 생성 API는 commandlet에서 Sequencer UI를 열려다 엔진 assertion 발생
- 결국 기존에 정상 동작하는 `LS_Animation`의 Control Rig 트랙을 복제해서 바인딩을 재사용하는 방식으로 우회

이런 식으로 막힐 때마다 다른 경로를 찾아가며 정말 한참을 돌았다. 최종적으로 Control Rig 섹션에 1,306개의 키를 찍고 Level Sequence·Animation Sequence·Montage 베이크까지 완료하긴 했다. 중간에 FBX 미리보기를 뽑아 실루엣을 검증하는 단계까지 스스로 넣었는데, 여기서도 FBX Exporter가 `NullRHI`에서 assertion을 내서 GPU 오프스크린 모드로 다시 돌리는 등 삽질이 이어졌다.

흥미로웠던 건 실패 원인 분석이었다. 첫 프리뷰에서 팔과 다리가 과하게 비틀렸는데, Codex는 Manny Control Rig의 로컬 회전축을 일반적인 XYZ 축처럼 가정한 게 원인이라고 스스로 진단하고, 진단용 시퀀스를 만들어 축을 실제로 확인한 뒤 다시 키를 잡았다.

## Codex의 UE 에디터 접근 작업

이 과정에서 unreal-editor 스킬을 이용한 에디터 조작 자체는 잘 작동한다는 걸 확인했다. 자산 생성, 시퀀스 조작, 베이크, 검증까지 에디터를 직접 켜지 않고 Python으로 다 해냈다. 애니메이션처럼 미적 감각이 필요한 작업 말고, 대규모 월드 배치 같은 반복적이고 기계적인 작업에 이용하면 나쁘지 않을 것 같다.

## 높은 토큰에 비한 이상한 결과

기대는 했지만, 결과는 이랬다.

<div class="video-embed"><iframe src="https://www.youtube.com/embed/Sk0beC3LULg" title="Codex가 생성한 검기 발사 스킬 애니메이션" allowfullscreen></iframe></div>

귀엽다... 귀여운 애니메이션으로 잘 만들었다... 토이스토리에서 고장난 인형 쯤....?

## 결론

Codex는 아직 애니메이션을 직접 만드는 것까지는 한계가 있다... 내 토큰 ㅜㅜ

데이터를 다루는 능력과 문제를 우회하는 끈기는 확실히 인상적이었지만, 결과물이 "자연스러운 동작"인지 판단하는 눈은 없었다. 키 1,306개를 찍어도 그게 살아있는 움직임이 되는 건 다른 문제였다.

UE 5.8에서는 또 다를 수도 있겠지만, 우선은 5.7을 쓰고 있으므로 애니메이션은 직접 구해서 붙이는 걸로 결론냈다. Codex는 GA(GameplayAbility)를 이용한 스킬 이펙트와 효과 구현 쪽으로 써야겠다.
