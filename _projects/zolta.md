---
title: Zolta
type: personal
category: game-graphics
period: "2026.01 - 진행 중"
order: 4
thumbnail: /assets/images/blog/zolta-devlog/hero-move.gif
summary: "UE5 기반 캠프 점령형 탑다운 핵앤슬래시 게임 · Codex 기반 AI 협업 개발 프로젝트"
team: "개인 프로젝트"
stack: ["Unreal Engine 5", "UE C++", "GAS", "Codex"]
result: "탑다운 쿼터뷰 · 거점 점령형 팀 전쟁 핵앤슬래시"
toc:
  - label: "프로젝트 소개"
    anchor: "#프로젝트-소개"
  - label: "Zolta는?"
    anchor: "#zolta는"
  - label: "개발 방식"
    anchor: "#개발-방식"
  - label: "AI 개발 필수 사항으로 정해둔 것"
    anchor: "#ai-개발-필수-사항으로-정해둔-것"
  - label: "적 유닛 AI 및 어그로 시스템"
    anchor: "#적-유닛-ai-및-어그로-시스템"
  - label: "전투 시스템"
    anchor: "#전투-시스템"
  - label: "개발 과정 블로그"
    anchor: "#개발-과정-블로그"
---

# 프로젝트 소개

Zolta는 캠프를 점령할수록 전선이 앞으로 밀려나는 탑다운 팀 전쟁 핵앤슬래시. 스타크래프트 유즈맵 "왕의 기사" 시리즈에서 출발해, 영웅 조작과 거점 점령을 하나의 전투 루프로 묶는 것을 목표로 개인 개발 중이며, Codex를 전체 설계와 세부 구현, 리팩터링 등에 활용

# Zolta는?

스타크래프트 유즈맵 "왕의 기사" 시리즈, 흔히 [왕기류](https://namu.wiki/w/%EC%99%95%EC%9D%98%20%EA%B8%B0%EC%82%AC%20%EC%8B%9C%EB%A6%AC%EC%A6%88)라고 불리는 장르에서 출발. 왕기류의 핵심 시스템은 1군주와 N명의 기사가 적 세력을 막아내며 주변 영지를 하나씩 점령해 정복해나가는 것으로, 오펜스·디펜스·보스전·점령전·핵앤슬래시가 혼합된 구조를 가짐

이 시스템 안에 재미 요소가 적절하게 섞여있고 협동으로도 즐길 수 있다고 판단해, 기존 게임 시스템에 원하는 요소를 더해 발전시켜보면 어떨까 하는 생각에서 시작

기획할 때 가장 중점으로 두는 기준은 "이걸 내가 했을 때 재밌을까"와 "복잡하진 않을까" 두 가지. 시스템이 많아도 직관적이고 재밌어야 한다고 생각하며, 그 기준을 적절히 녹여내면서 개발 중

게임의 레퍼런스는 당연히 기본적으로 왕의 기사 시리즈를 메인으로 잡고 있음. 하지만 스타크래프트라는 특성상 연출과 표현에 한계가 있어 Top-Down 또는 쿼터뷰 게임을 레퍼런스로 많이 참고 중. LOL, Lost Ark, Shape of Dreams와 같이 전투 관련된 게임을 메인으로 참고 중이며, PoE2, V Rising과 같은 게임에서 핵앤슬래시나 건물 형태 같은 세부 요소를 참고 중

# 개발 방식

Codex에 하네스 엔지니어링을 적용해 개발 진행

개발 중 나오는 생각과 과정은 `docs`에 저장하고, `AGENTS.md`에 기본 규칙과 작업 범위, 검증 방식을 적어두고 Codex가 이상한 방향으로 가지 않도록 튜닝하며 개발 중

<div class="link-cards">
  <div><a class="link-card" href="/blog/2026/07/09/codex-zolta-workflow/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">게임 개발에 Codex 활용하기</p>
      <p class="link-card-desc">Codex에 하네스 엔지니어링을 적용해 튜닝해나간 과정 정리</p>
      <p class="link-card-date">2026.07.09</p>
    </div>
  </a></div>
</div>

# AI 개발 필수 사항으로 정해둔 것

<div class="failure-loop">
  <div class="failure-card">
    <p class="failure-index">01</p>
    <h2>필요한 만큼만 만든다</h2>
    <dl>
      <dt>계기</dt>
      <dd>AI가 확장성을 고려해 시킨 것보다 많은 상속 구조를 먼저 만든 적 있음</dd>
      <dt>원칙</dt>
      <dd>지금 필요한 범위만 구현하고, 확장은 실제로 필요해졌을 때 한다</dd>
    </dl>
  </div>
  <div class="failure-card">
    <p class="failure-index">02</p>
    <h2>잘못된 방향은 빠르게 되돌린다</h2>
    <dl>
      <dt>계기</dt>
      <dd>과한 추상화로 판단된 구조를 붙잡지 않고 바로 단순화한 경험</dd>
      <dt>원칙</dt>
      <dd>AI가 잘했는지보다, 잘못된 방향을 얼마나 빨리 감지하고 되돌릴 수 있는지를 더 중요하게 봄</dd>
    </dl>
  </div>
  <div class="failure-card">
    <p class="failure-index">03</p>
    <h2>문서는 가볍게 유지한다</h2>
    <dl>
      <dt>계기</dt>
      <dd>모든 결정과 과정을 문서에 누적하다 문서가 계속 비대해진 경험</dd>
      <dt>원칙</dt>
      <dd>현재 결정만 문서화하고, 상세 변경 이력은 Git 커밋과 세션 기록에 맡긴다</dd>
    </dl>
  </div>
  <div class="failure-card">
    <p class="failure-index">04</p>
    <h2>결과는 직접 플레이해서 검증한다</h2>
    <dl>
      <dt>계기</dt>
      <dd>Codex는 UE 에디터에서 직접 플레이할 수 없음</dd>
      <dt>원칙</dt>
      <dd>AI에게 DoD를 작성시키고, 실제 플레이 테스트 결과를 다시 피드백으로 넣는다</dd>
    </dl>
  </div>
</div>

# 적 유닛 AI 및 어그로 시스템

처음엔 컴포넌트 하나가 Tick마다 전투를 처리했지만, 유닛 수가 늘며 Behavior Tree/Blackboard 기반으로 전환. 가장 오래 걸린 건 어그로였고, 위협치·거리·사거리 진입 여부·최근 피격 여부를 점수화한 `AggroThreat` 값 하나로 통일하기까지 다섯 번 넘게 로직을 고침. Codex와 함께 실패 사례를 기록하며 원인을 좁혀나갔고, 복잡한 분기 제안은 실제 플레이 테스트 후 단순화하는 방향으로 되돌림

<div class="link-cards">
  <div><a class="link-card" href="/blog/2026/07/13/zolta-unit-ai-aggro/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">유닛 AI와 어그로 시스템</p>
      <p class="link-card-desc">Behavior Tree 전환과 AggroThreat 값 하나로 통일하기까지의 시행착오</p>
      <p class="link-card-date">2026.07.13</p>
    </div>
  </a></div>
</div>

# 전투 시스템

처음엔 무기가 스킬 구성을 결정하는 무기 중심 전투로 시작. 무기를 소켓 장착 방식으로 분리하고 DataAsset+GameplayAbility로 콤보 판정을 데이터화하는 데까지 갔지만, 무기 조합이 주는 다양성이 곧 학습곡선과 밸런스 고착, 그리고 1인 개발의 데이터 관리 비용으로 돌아온다고 판단해 무기 시스템 자체를 걷어냄

지금은 캐릭터가 기본공격과 `Skill 1~4`를 직접 소유하고, 룬으로 스킬을 변주해 다양성을 주는 방향으로 전환. 스킬의 판정과 상태는 GAS(GA/GE/GC)로 옮겨, 무기 콜리전과 복제 bool로 흩어져 있던 상태를 Ability의 수명 하나로 관리하는 구조로 정리 중

<video class="post-video" controls preload="metadata">
  <source src="{{ '/assets/video/zolta-weapon-to-character-skill/hero-attack-skill.mp4' | relative_url }}" type="video/mp4">
  브라우저가 동영상 재생을 지원하지 않습니다.
</video>

<div class="link-cards">
  <div><a class="link-card" href="/blog/2026/07/22/zolta-weapon-to-character-skill/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">무기 시스템에서 캐릭터 스킬로</p>
      <p class="link-card-desc">무기 시스템을 걷어내고 캐릭터별 스킬로 전환한 기획 판단</p>
      <p class="link-card-date">2026.07.22</p>
    </div>
  </a></div>
  <div><a class="link-card" href="/blog/2026/07/22/gas-skill-implementation/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">GAS 로 스킬 구현하기</p>
      <p class="link-card-desc">돌진 베기·차징 스킬을 예시로 GA/GE/GC 책임 분리 정리</p>
      <p class="link-card-date">2026.07.22</p>
    </div>
  </a></div>
  <div><a class="link-card" href="/blog/2026/07/13/zolta-weapon-system/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">무기 시스템, 상속에서 데이터 기반으로</p>
      <p class="link-card-desc">걷어내기 전 무기 중심 구조를 DataAsset+GAS로 정리했던 과정</p>
      <p class="link-card-date">2026.07.13</p>
    </div>
  </a></div>
</div>

# 개발 과정 블로그

<div class="link-cards">
  <div><a class="link-card" href="/blog/2026/07/22/gas-skill-implementation/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">GAS 로 스킬 구현하기</p>
      <p class="link-card-desc">돌진 베기·차징 스킬을 예시로 GA/GE/GC 책임 분리 정리</p>
      <p class="link-card-date">2026.07.22</p>
    </div>
  </a></div>
  <div><a class="link-card" href="/blog/2026/07/22/zolta-weapon-to-character-skill/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">[Zolta] 무기 시스템에서 캐릭터 스킬로</p>
      <p class="link-card-desc">무기 시스템을 걷어내고 캐릭터별 스킬로 전환한 기획 판단</p>
      <p class="link-card-date">2026.07.22</p>
    </div>
  </a></div>
  <div><a class="link-card" href="/blog/2026/07/20/codex-ue-control-rig-animation/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">Codex 이용해 UE 애니메이션 제작해보기</p>
      <p class="link-card-desc">Zolta 발도 스킬 모션을 Codex로 만들어보며 확인한 가능성과 한계</p>
      <p class="link-card-date">2026.07.20</p>
    </div>
  </a></div>
  <div><a class="link-card" href="/blog/2026/07/13/zolta-weapon-system/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">[Zolta] 무기 시스템, 상속에서 데이터 기반으로</p>
      <p class="link-card-desc">3단 상속을 되돌린 계기와 DataAsset+GAS 기반 무기 구조 정리</p>
      <p class="link-card-date">2026.07.13</p>
    </div>
  </a></div>
  <div><a class="link-card" href="/blog/2026/07/13/zolta-unit-ai-aggro/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">[Zolta] 유닛 AI와 어그로 시스템</p>
      <p class="link-card-desc">Behavior Tree 전환과 AggroThreat 값 하나로 통일하기까지의 시행착오</p>
      <p class="link-card-date">2026.07.13</p>
    </div>
  </a></div>
  <div><a class="link-card" href="/blog/2026/07/09/codex-zolta-workflow/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">[Codex] Zolta 개발하며 코덱스 조련하기</p>
      <p class="link-card-desc">Codex를 장기 프로젝트의 개발 파트너로 활용하기 위해 문서, 규칙, 검증 루프를 정리한 개발기</p>
      <p class="link-card-date">2026.07.09</p>
    </div>
  </a></div>
  <div><a class="link-card" href="/blog/2026/04/17/zolta-devlog/" target="_blank" rel="noopener">
    <div class="link-card-text">
      <p class="link-card-name">[Zolta] 스타크래프트 유즈맵 왕의 기사 시리즈로부터</p>
      <p class="link-card-desc">Zolta의 시작점과 하네스 엔지니어링 기반 작업 환경 정리</p>
      <p class="link-card-date">2026.04.17</p>
    </div>
  </a></div>
</div>
