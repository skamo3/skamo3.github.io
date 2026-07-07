---
title: "[Github] 협업 시 Github을 이용하는 방법"
date: 2022-02-24
category: dev-notes
---

## Issues를 이용한 할 일 정리

![Github 레포지토리 탭](/assets/images/blog/github-collab-guide/repo-tabs.png)

Gihub 레포지토리를 만들어서 들어가면 위와 같이 각종 탭이 나온다.

이 중 Issues에 들어가면 아래와 같은 화면으로 시작한다.

![Issues 화면](/assets/images/blog/github-collab-guide/issues-screen.png)

New issue를 누르면 새 이슈를 등록할 수 있다.

![New issue 등록 폼](/assets/images/blog/github-collab-guide/new-issue-form.png)

#### Issue 내용

- Title: 이슈의 간단한 내용
- Write: 이슈 상세 내용 및 참고사항 등 **이슈에 관련된 자세한 사항**
- Preview: 현재 내가 작성중인 markdown 형식을 미리보기 식으로 확인이 가능

#### Issue 특성 설정

- Assignees : 해당 이슈의 담당자 -> 이슈 등록자가 될 수도 있고, 이슈 해결자가 될 수도 있음
- Labels : 해당 이슈의 특징으로 각 라벨별 의미에 따라 부여해주면 됨. 여러개도 가능
  - Label은 직접 Edit해서 사용할 수도 있어서 팀의 작업 방식에 맞춰 새로 생성해 사용하는 것이 편할 수도 있음
- Projects : 이슈를 등록할 칸반보드. 여기에 등록하게 되면 Projects란의 칸반보드에 이슈가 올라가게 됨.
- Milestone : 하나의 큰 목표로 작업의 단위로 보면 됨.
- Linked pull requests : 해당 이슈가 close 되면 연결된 pull requests도 닫히도록 연결

## Milestones

작업을 진행하면서 이슈가 많아지게 되면 각각의 이슈가 어떤 작업을 하다 나왔는지 헷갈리는 경우가 생기게 되는데, Milestone을 이용해 프로젝트의 흐름을 만들어 줄 수 있다.

milestone은 과거 로마에서 도로를 건설할 때 사용했던 이정표로 남은 거리, 방향 등을 새겨놓은 돌이다.

Github의 milestone도 여기서 따온 것으로 프로젝트의 성공을 위해 반드시 거쳐야 하는 지점들을 등록하는데 사용할 수 있다. 게임을 만든다고 하면 플레이어 구현, Level 구현, 디자인 적용 등등 해당 프로젝트를 구성하는 큼직한 일들이다.

![Milestones 진입 링크](/assets/images/blog/github-collab-guide/milestones-link.png)

Issues의 New issue 등록 왼쪽에 Milestones가 있다. 클릭해보면 아래와 같이 나온다

![Milestones 화면](/assets/images/blog/github-collab-guide/milestones-screen.png)

New milestone 버튼을 클릭해보자.

![New milestone 등록 폼](/assets/images/blog/github-collab-guide/new-milestone-form.png)

- Title : 목표 이름 -> 달성해야할 목표의 제목
- Due date -> 달성 기한. 설정한 날짜로 카운트를 해줌
- Description -> 달성해야할 목표의 세부내용. 구현 시 주의사항 또는 구현 해야할 세세한 목록들을 적어둘 수 있음

이렇게 생성한 Milestone을 추후 생성하게 될 각각의 Issue에 설정해주면 된다.

## Projects 칸반보드

Projects에서 New project 를 클릭해 새로운 프로젝트를 생성해보자.

![New project 생성 폼](/assets/images/blog/github-collab-guide/new-project-form.png)

- Project board name : 프로젝트 보드의 이름
- Description : 보드에 대한 설명
- Project template
  - 칸반 보드의 템플릿으로 None으로 되어있으면 아무것도 없는 상태에서 만들기 시작할 수 있다.
  - 칸반 보드의 성질에 따라 템플릿을 이용하거나 또는 직접 설정해서 사용할 수 있다.

프로젝트를 생성하고 아까 생성한 이슈에 Projects에 만든 프로젝트를 연결해주면 아래처럼 블럭이 생긴다.

![칸반 보드에 등록된 이슈](/assets/images/blog/github-collab-guide/kanban-board.png)

작업의 진행에 따라 In Progress 또는 Done으로 옮겨 팀원들과 각 이슈에 대한 진행 내용 공유가 가능하다.

칸반 보드를 이용해 팀원들과 작업의 진행 내용을 실시간으로 공유하면서 각자 역할 분담을 편하게 할 수 있다.

세부적인 내용이 더 많이 있지만 기본적으로는 위 3개의 내용만 알고있으면 협업을 하는 과정에서 큰 문제는 없다.

협업을 시작할 때 중요한건 Issue나 milestone을 등록할 때 어떤식으로 등록할 건지 규칙을 정해두고 시작하는 것이 좋다.

해당 기능들을 쓰게되면 처음에는 작업을 하는 과정에서 한번씩 신경써줘야 하는 번거롭다 생각될 수 있지만 협업을 진행하다보면 기능들을 사용하면서 진행하는 것이 장기적인 협업 과정에서 더 좋은 퍼포먼스를 기대할 수 있다.
