---
title: CheckChack
type: personal
category: ai
period: "2019.10"
order: 7
thumbnail: /assets/images/checkchack/thumbnail.png
summary: "서울시 다산콜센터 120 FAQ 챗봇 · TF-IDF 기반, 2019 서울 인공지능 챗봇톤 우수상"
team: "3인 프로젝트"
stack: ["Python", "TF-IDF", "카카오톡 챗봇", "Heroku"]
link_cards:
  - name: "Github"
    url: "https://github.com/skamo3/team-check-chack"
  - name: "인공지능 챗봇톤 뉴스"
    url: "https://www.donga.com/news/Society/article/all/20191016/97895354/1"
    inline: true
toc:
  - label: "프로젝트 소개"
    anchor: "#프로젝트-소개"
  - label: "구현 방식"
    anchor: "#구현-방식"
  - label: "서버 인프라 문제"
    anchor: "#서버-인프라-문제"
  - label: "결과"
    anchor: "#결과"
---

# 프로젝트 소개

2019 서울 인공지능 챗봇톤(2019.10.09, 1일 해커톤) 출품작. 서울시 다산콜센터 120의 카카오톡 챗봇 "톡톡120"을 보완해, 서울정보소통광장 FAQ 데이터를 이용한 챗봇을 만드는 것이 과제.

기존 톡톡120은 질문을 정형화된 형태로 하지 않으면 곧바로 "답변을 찾지 못했어요"를 반환하는 한계가 있었다. 예를 들어 "서울시 예방접종은 어디가서 해야할까"처럼 자연스럽게 물어도 관련 FAQ를 찾지 못하고 안내 문구만 돌려주는 식.

![기존 톡톡120의 한계 — 자연스러운 질문에도 "답변을 찾지 못했어요"만 반환](/assets/images/checkchack/toktok120-limitation.png){: width="70%"}

이 한계를 보완해, 사용자가 자연스럽게 질문해도 관련도 높은 FAQ 답변을 찾아주는 챗봇을 만드는 것이 목표.

3인 팀으로 진행했고, 그중 FAQ 크롤링과 서버 배포를 중심으로 담당. 크롤링은 다른 팀원과 함께 작업.

팀 이름 "Check Chack"은 모든 걸 다 체크한다는 의미에서 지었다. 후보로 "CheckChat"도 있었지만 "췍췍"이라는 어감이 마음에 들어 지금 이름으로 정했다고 함. 챗봇에는 "다알"이라는 이름을 붙였는데, "다 알려주다"와 "다 알고싶다"라는 중의적 의미를 담았고, 당시 유행하던 '그것이 알고싶다' 김상중 말투 컨셉을 챗봇 페르소나에 반영.

# 구현 방식

- 서울정보소통광장 FAQ 페이지를 크롤링해 질문·답변 데이터를 수집 — 원본 페이지가 카테고리별로 잘 정리되어 있어 크롤링 자체는 생각보다 수월했음
- TF-IDF로 각 FAQ 질문의 핵심 단어를 분석해 분야·제목별로 분류 — 여러 유사도 알고리즘 중 TF-IDF를 택한 이유는, 가장 단순하면서도 팀원이 이미 깊게 이해하고 있던 알고리즘이라 1일 해커톤이라는 시간 제약 안에서 팀 전체가 바로 이해하고 다룰 수 있었기 때문
- 사용자 질문이 들어오면 TF-IDF 기반 유사도 계산으로 가장 가까운 FAQ 질문을 찾아 답변을 제공

FAQ 데이터 자체가 많지 않다 보니, 비슷비슷한 질문에 계속 같은 답변만 뽑아내는 문제를 겪었다. 가중치를 조금씩 조정해가며 개선을 시도했지만 근본적인 데이터 부족은 해커톤 시간 안에 해결하기 어려웠고, 이 경험으로 AI 모델에서 왜 데이터의 양과 질이 중요한지를 체감.

# 서버 인프라 문제

처음엔 ngrok으로 서버를 노출해 개발했지만, 챗봇톤 당일 다중 접속에 대한 안정성이 부족해 Heroku로 이전. 발표 전 다른 참가자들이 직접 링크를 타고 챗봇을 체험해보는 시연 시간이 있었는데, 분당 100회 요청을 넘어가는 시점부터 서버가 터지기 시작해 발표 전 약 2시간 안에 급하게 Heroku 세팅을 마쳐야 했던 경험. Heroku의 클라우드 컴퓨팅 자원으로 옮겨 시간당 처리량 한계를 해결.

# 결과

2019 서울 인공지능 챗봇톤에 출품해 우수상(2등)을 수상. 현장 취재 기사에도 소개됨.

{% assign news_card = page.link_cards | where: "name", "인공지능 챗봇톤 뉴스" | first %}
{% include link-card.html name=news_card.name url=news_card.url desc=news_card.desc logo=news_card.logo og_image=news_card.og_image %}
