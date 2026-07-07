---
title: SEA:ME Pilot Program
type: personal
category: embedded-cpp
period: "2022.09 - 2023.02"
order: 6
thumbnail: /assets/images/sea-me/SEAME_Thumbnail.png
summary: "독일 42 Wolfsburg · 폭스바겐 연계 자동차 임베디드 소프트웨어 인재양성 프로그램"
team: "팀 프로젝트 · 독일 42 Wolfsburg Pilot Program"
stack: ["Raspberry Pi", "Arduino", "C++", "Qt/QML", "CAN", "D-Bus", "Yocto"]
toc:
  - label: "프로젝트 소개"
    anchor: "#프로젝트-소개"
  - label: "Project 1 — Pi-Racer 조립과 구동"
    anchor: "#project-1--pi-racer-조립과-구동"
  - label: "Project 2 — CAN 통신과 인포테인먼트 시스템"
    anchor: "#project-2--can-통신과-인포테인먼트-시스템"
  - label: "Project 3 — Yocto 커스텀 OS"
    anchor: "#project-3--yocto-커스텀-os"
  - label: "회고"
    anchor: "#회고"
---

# 프로젝트 소개

독일 Wolfsburg 42 캠퍼스에서 폭스바겐 그룹코리아 연계로 진행된 SEA:ME(Software Engineering in Automotive & Mobility Ecosystems) Pilot Program. SEA:ME는 임베디드 시스템·자율주행·자동차 에코 시스템 3개 메인 코스로 구성되며, Pilot Program 기간에는 그중 임베디드 시스템 커리큘럼(DES 단계)을 진행. Raspberry Pi 기반 자동차(Pi-Racer)를 이해하고, 전원을 켜면 관련 소프트웨어가 자동 실행되며 자동차 상태를 계기판에 띄워주는 것이 프로그램의 목표.

![42 Mobility Specialization 커리큘럼 구조 — DES(임베디드)/ADS(자율주행)/ME(모빌리티) 3개 트랙](/assets/images/sea-me/mobility-specialization.png){: width="85%"}

팀 프로젝트로 Project 1~3 전 과정을 팀원들과 함께 구현. 발표 자리에서는 파트별로 발표자만 나누어 맡았을 뿐, 실제 구현은 처음부터 끝까지 다같이 참여.

# Project 1 — Pi-Racer 조립과 구동

- Waveshare Pi-Racer Pro AI Kit 조립
- Raspberry Pi에 DonkeyCar(Pi-Racer가 제공하는 자율주행차 구동 프레임워크) 설치 및 구동
- DonkeyCar 코드를 응용해 자동차에 연결된 OLED-Display에 배터리, CPU 사용량, 현재 IP를 표시
- 조이스틱 또는 Web 컨트롤러(`http://{Raspberry Pi IP}:8887`)로 원격 조종

![조립한 Pi-Racer](/assets/images/sea-me/pi-racer.png){: width="80%"}

# Project 2 — CAN 통신과 인포테인먼트 시스템

Pi-Racer ↔ CAN ↔ Arduino ↔ Sensor 구조로 센서 데이터를 Raspberry Pi까지 전송하고, 이를 Qt/QML 기반 디지털 계기판과 Head Unit(인포테인먼트)으로 시각화하는 프로젝트.

- Arduino가 속도·온도·습도 센서 데이터를 수집해 MCP2515 CAN 컨트롤러로 CAN 버스를 통해 Raspberry Pi에 전송 — 센서 데이터 수집을 Raspberry Pi가 아닌 Arduino에 맡긴 이유는, Arduino가 아날로그 센서와의 호환성이 좋고 전력 소모와 가격도 낮아 단순 데이터 입력에 더 적합하기 때문. Raspberry Pi는 더 고사양 칩으로 복잡한 연산에 최적화되어 있어 역할을 나눔
- socket 프로그래밍으로 Arduino발 CAN 데이터 수신 로직을 구현 — CAN protocol이 제공하는 `sockaddr_can` API로 소켓 연결
- Raspberry Pi에서는 D-Bus로 CAN 데이터를 여러 애플리케이션(계기판, HUD 등)에 배분하는 서버 구조로 설계 — 각 애플리케이션이 CAN 데이터를 개별적으로 읽어오게 하면 공유되는 데이터마다 연결을 하나씩 따로 만들어줘야 함. D-Bus는 Raspberry Pi 쪽에서 데이터를 한 곳으로 모아 관리하는 창구 역할을 하도록 도입 — 프로세스끼리 서로 직접 연결하는 대신 하나의 D-Bus 버스에 데이터를 발행하고, 필요한 애플리케이션이 구독해가는 방식

CAN 통신 자체를 안정적으로 붙이는 과정이 만만치 않았다. 양쪽 CAN Bus 설정이 조금만 어긋나도 통신이 되다 안 되다를 반복해서 설정값을 맞추는 데 많이 헤맸고, 실제로는 하드웨어에 미세한 결함이 있어 작동하지 않는 경우도 종종 있었는데 이걸 소프트웨어 문제로 오해하고 애꿎은 코드만 계속 뜯어본 적도 많았다.

![전체 아키텍처 — Arduino·CAN·Raspberry Pi·D-Bus 연결 구조를 직접 정리한 보드](/assets/images/sea-me/structure-diagram.png){: width="70%"}

- Qt 라이브러리의 QML로 계기판 UI를 구현 — C++로는 데이터를 관리하고 QML로는 UI 상태를 관리하는 MVVM 모델 적용

![Qt/QML로 구현한 디지털 계기판 — 속도·RPM·배터리·온습도 표시](/assets/images/sea-me/instrument-cluster.png){: width="85%"}

같은 시스템 위에 Head Unit(인포테인먼트)도 함께 구현 — 지도(Map)·음악(Music)·조명(Light)·설정(Setting) 메뉴와 기어(P/R/N/D) 선택 화면을 구성. 이 중 Qt 기반 속도 계기판 UI 작성과 데이터 구조 설계를 직접 담당했고, 내비게이션과 기어 선택 화면은 팀원들과 함께 연구하며 구현.

![Head Unit UI — Map/Music/Light/Setting 메뉴와 내비게이션 화면](/assets/images/sea-me/headunit-mockup.png){: width="90%"}

![실제 하드웨어에서 계기판(좌)과 Head Unit(우) 화면을 함께 구동한 데모](/assets/images/sea-me/headunit-demo.png){: width="90%"}

# Project 3 — Yocto 커스텀 OS

Linux 임베디드 OS 빌드 툴인 Yocto Project를 익히고, Project 1·2의 결과물을 하나의 자동 실행 OS로 묶는 커스텀 레시피를 제작.

- Yocto의 기본 레시피 구조를 바탕으로, Project 1·2의 소스를 GitHub에서 직접 fetch해와 빌드 시점에 컴파일하는 커스텀 레이어 작성
- `SRC_URI`에 `git://github.com/.../SEA-ME-Project-2.git` 형태로 Git 소스를 지정하고, `do_fetch → do_unpack → do_configure → do_compile → do_install`로 이어지는 빌드 태스크 흐름을 커스터마이징
- 자동차 전원 On 시 Project 1·2에서 만든 프로그램이 모두 자동 실행되는 이미지를 완성

![팀에서 작성한 Yocto meta 레이어 예시 폴더 구조](/assets/images/sea-me/yocto-layer-structure.png){: width="70%"}

한 번 세팅하고 테스트하는 데 시간이 오래 걸려서 시간과의 싸움이 컸던 과제. 자료가 많지 않아 대부분 소스코드를 직접 읽어가며 진행했는데, 다행히 Yocto를 개발한 개발자가 Fellow(일종의 멘토)로 함께해줘서 막힐 때마다 직접 물어보며 풀어갈 수 있었다. OS가 제대로 만들어졌는지 확인하고 다시 세팅하는 과정을 반복하면서 난항을 겪음.

# 회고

6개월간 독일 Wolfsburg에 체류하며 42Wolfsburg 커뮤니티 미팅에서 SEA:ME 프로젝트를 현지 학생들 앞에서 발표.

CAN 데이터 처리 로직을 짤 때 Receiver(데이터 수신)·Server(데이터 저장)·App(데이터 소비) 역할을 나눠 객체 단위로 분리하는 OOP 구조를 적용 — App은 Qt의 MVVM 모델로 구현.

프로젝트 구현 외에도 Main Program 자체의 개선점을 찾아 수정하는 QA 역할과, 새로 진입하는 학생들의 진입 장벽을 낮춰줄 SEA:ME Warm-up 자료 제작에도 참여. Main Program 연구·개발 해커톤에도 참여해, 언리얼 엔진 기반 자율주행 시뮬레이터 Carla를 활용한 예제를 만들어보기도 함.

자동차 임베디드라는 생소한 분야를 진행하면서 임베디드 시스템이 어떻게 돌아가는지, 하드웨어에는 어떤 방식으로 접근할 수 있는지를 배웠고, 해외에서는 좀 더 자유로운 분위기로 소통하고 개발한다는 것도 몸소 체험할 수 있었다. 영어로 소통하는 것이 가장 어려웠는데, 6개월간 틈틈이 단어와 문장을 공부하며 채워나갔다. 특히 작업 중 애매했던 단어를 그때그때 기록해두고 곱씹는 방식이 실제 프로젝트 커뮤니케이션에서 큰 도움이 됐다.

SEA:ME Warm-up 자료를 만들면서는 프로젝트를 진행하며 겪었던 불편함, "이런 가이드가 있었다면 더 쉽게 길을 찾았을 텐데" 싶었던 지점들을 되짚어볼 수 있었다. 내가 걸어본 길을 걸어올 다음 사람을 생각하며 정리하다 보니, 정작 프로젝트를 진행할 때는 놓쳤던 부분들을 다시 짚어보는 기회도 됐다.
