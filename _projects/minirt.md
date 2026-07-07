---
title: MiniRT
type: personal
category: game-graphics
period: "2020.09 - 2020.11"
order: 4
thumbnail: /assets/images/minirt/thumbnail.svg
summary: "C언어로 구현한 Ray Tracing 렌더러 · Phong 조명, 재귀 반사·굴절, 멀티스레드"
team: "2인 프로젝트 · 핵심 로직 전담"
stack: ["C", "miniLibX", "pthread", "Vector/Matrix Math"]
link_cards:
  - name: "Github"
    url: "https://github.com/skamo3/miniRT/tree/90ef39c1fc02f5135990b123b65dc1ad7bceae1b"
    inline: true
toc:
  - label: "프로젝트 소개"
    anchor: "#프로젝트-소개"
  - label: "카메라"
    anchor: "#카메라"
  - label: "도형"
    anchor: "#도형"
  - label: "빛"
    anchor: "#빛"
  - label: "반사와 굴절"
    anchor: "#반사와-굴절"
  - label: "텍스처"
    anchor: "#텍스처"
  - label: "멀티스레드"
    anchor: "#멀티스레드"
  - label: "안티앨리어싱"
    anchor: "#안티앨리어싱"
  - label: "회고"
    anchor: "#회고"
---

# 프로젝트 소개

42 Seoul 커리큘럼의 개인 프로젝트로, C언어만으로 Ray Tracing 렌더러를 밑바닥부터 구현. 벡터/행렬 연산부터 직접 만들어 카메라·도형·광원 배치를 계산하고, `.rt` 확장자의 텍스트 씬 파일을 파싱해 렌더링하는 구조. 구/평면/사각형/삼각형/원기둥/큐브/피라미드 7종 도형과 Ambient+Lambert+Phong 조명 모델, 재귀 기반 반사·굴절, 절차적 텍스처, 멀티스레드 렌더링까지 구현.

2인 프로젝트로 진행했지만 카메라·도형 교차 판정·조명·파서·최적화 등 핵심 로직 대부분을 직접 구현.

# 카메라

카메라 원점과 방향벡터를 기준으로 View Plane을 구성하고, 각 픽셀 방향으로 Ray를 발사해 교차 여부를 계산하는 구조. 픽셀 좌표를 카메라 공간의 레이 방향으로 바꾸는 `set_camera()`에서, x·y 좌표 계산에 `(1 - 2*t)`처럼 1에서 빼고 2를 곱하는 연산이 들어가는 이유를 처음엔 이해하지 못하고 한참 헤맴.

```c
p.x = (1 - 2 * ((rss.x + x_offset) / rss.xres)) * asp_ratio * correct_fov;
p.y = (1 - 2 * ((rss.y + y_offset) / rss.yres)) * correct_fov;
```

각 항을 하나씩 빼고 렌더링해보며 역할을 직접 확인:

![정상 출력 — 체커보드 바닥 위 RGB 3개 구](/assets/images/minirt/cam-normal.png){: width="70%"}

![1에서 빼주지 않은 경우 — 상하좌우가 반전되고 크기도 이상하게 잡힘](/assets/images/minirt/cam-no-1-subtract.png){: width="70%"}

`1 -`을 빼면 래스터 좌표(왼쪽 위가 원점, 아래·오른쪽으로 증가)가 그대로 카메라 공간에 들어가면서 상하좌우가 반전됨.

![2를 곱해주지 않은 경우 — 위치는 맞지만 크기가 1/4로 잡힘](/assets/images/minirt/cam-no-2-multiply.png){: width="70%"}

`× 2`를 빼면 View Plane의 절반 범위(0~1)만 사용하게 되어 이미지가 1/4 크기로 축소됨.

![둘 다 없는 경우 — 반전과 축소가 함께 나타남](/assets/images/minirt/cam-neither.png){: width="70%"}

두 항을 모두 없애면 반전과 축소가 겹쳐서 나타남 — 이 네 가지 케이스를 직접 비교하며 왜 두 연산이 함께 필요한지 이해함.

# 도형

Ray가 어떤 도형과 교차하는지 판단한 뒤 해당 픽셀의 색상을 결정하는 구조로, Sphere / Plane / Square / Triangle / Cylinder / Cube / Pyramid 7종을 지원. 뒤의 3종(Cube/Pyramid는 각각 Square·Triangle 6~4개의 조합)은 앞의 기본 도형 교차 판정을 재사용해서 구현.

**구(Sphere)**: 광선의 방정식을 구의 방정식에 대입하면 2차방정식이 되고, 판별식의 해가 0/1/2개인지에 따라 광선이 구를 비껴가는지, 접하는지, 뚫고 지나가는지가 갈림.

![Ray-Sphere 교차 — 판별식 해가 0/1/2개인 경우](/assets/images/minirt/sphere-roots.png){: width="70%"}

**삼각형(Triangle)**: 평면과의 교차점을 먼저 구한 뒤, 그 점이 삼각형 내부에 있는지를 외적으로 판별. 각 변의 벡터(v1, v2)와 교차점 방향 벡터(vp)를 외적해 나온 두 벡터가 같은 방향이면 내부, 하나라도 반대 방향이면 외부로 판정.

![삼각형 내부/외부 판별 — v1×v2와 v1×vp의 외적 방향 비교](/assets/images/minirt/triangle-inout.png){: width="70%"}

**원기둥(Cylinder)**이 가장 까다로웠음. 축이 기울어질 수 있는 3D 오블리크 실린더라서, 광선과 축의 관계를 2차방정식(`ax² + bx + c = 0`) 형태로 환원하는 과정 자체를 이해하는 데 오래 걸림. 몸체는 이 2차방정식으로, 위아래 뚜껑은 평면 교차 후 반지름 안에 들어오는지로 따로 판정해 몸체와 뚜껑 중 더 가까운 쪽을 반환.

# 빛

Ambient(주변광) + Lambert(난반사) + Phong(정반사)을 조합한 조명 모델 구현.

- **Lambert**: `광량 × cos(법선, 광원 방향)`으로 확산광 계산
- **Phong**: 반사벡터(`reflect_ray`, `2×(N·L)×N - L`)를 구하고, 반사벡터와 시점 벡터 사이 각도의 코사인을 재질별 `specular` 지수만큼 거듭제곱해 하이라이트를 표현 — 도형마다 정반사 세기를 다르게 줄 수 있도록 함

각 도형이 픽셀에 어떤 색을 얼마나 반영할지는 int로 패킹된 색상값을 비트 연산으로 채널별 분리해서 계산:

```c
void	add_coefficient(double (*rgb)[3], double coef, int color)
{
	unsigned int	mask;

	mask = 255 << 16;
	(*rgb)[0] += coef * ((color & mask) >> 16) / 255;
	mask >>= 8;
	(*rgb)[1] += coef * ((color & mask) >> 8) / 255;
	mask >>= 8;
	(*rgb)[2] += coef * (color & mask) / 255;
}
```

`0xAABBCCDDEEFF` 형태로 저장된 색상값에서 `255 << 16` 마스크로 R 채널(16~23비트)만 남기고 `>> 16`으로 끌어내린 뒤, 마스크를 8비트씩 오른쪽으로 옮겨가며 G·B 채널도 같은 방식으로 분리. 분리한 값에 광량 계수(`coef`)를 곱하고 255로 나눠 비율화한 뒤 누적해서 최종 RGB를 계산.

![color 값에서 mask로 R 채널만 분리해 result를 얻는 비트 연산 과정](/assets/images/minirt/bitmask-diagram.png){: width="70%"}

# 반사와 굴절

레이를 재귀적으로 추적해 거울 같은 반사와 유리 같은 굴절을 표현.

![specular(정반사) 적용 전(왼) 적용 후(오) — 구 표면 하이라이트와 바닥 반사광 차이](/assets/images/minirt/specular-before-after.png){: width="70%"}

**반사**: 교차점의 법선벡터(`norm`)와 교차점에서 광원을 향한 벡터(`dir`)로 빛이 어느 방향으로 반사될지 계산하는 것이 출발점 — 이 반사 방향 계산 함수(`reflect_ray`)를 정반사(Phong specular) 하이라이트뿐 아니라 거울처럼 튕겨나가는 레이 자체의 재귀 반사 방향을 구하는 데도 그대로 재사용:

![직접 그린 반사 방향 계산 다이어그램 — 법선(norm)과 광원 방향(dir)으로 반사 벡터(2·dn - dir)를 구하는 과정](/assets/images/minirt/reflect-diagram.png){: width="70%"}

```c
t_p3	reflect_ray(t_p3 ray, t_p3 normal)
{
	return (vsubstract(scal_x_vec(2 * vdot(normal, ray), normal),
			ray));
}
```

법선 벡터에 `2 × (법선·입사벡터)`를 곱한 뒤 입사벡터를 빼주면 반사 벡터가 나옴 — 이 벡터를 따라 레이를 다시 추적해 거울 표면에 비치는 다른 물체를 재귀적으로 렌더링. 최대 3회까지 재귀 추적하고, 굴절은 Snell의 법칙으로 굴절 방향을 계산:

![직접 그린 Snell의 법칙 다이어그램 — 입사광선/반사광선/굴절광선과 공기-유리 경계, θ1(입사각)·θ2(굴절각)](/assets/images/minirt/snell-diagram.png){: width="70%"}

`sinθ2/sinθ1 = v2/v1` (매질 속 빛의 속력 비) 관계를 굴절률 `n = c/v`로 바꿔 코드에 반영:

```c
t_p3	refract_ray(t_p3 d, t_p3 normal, t_fig *lst)
{
	double	cosi;
	double	etai;
	double	etat;
	double	eta;
	double	k;

	cosi = vdot(d, normal);
	etai = 1;
	etat = lst->refr_idx;
	if (lst->fig.sp.inside == 1)
	{
		k = etai;
		etai = etat;
		etat = k;
	}
	eta = etai / etat;
	k = 1 - eta * eta * (1 - cosi * cosi);
	if (k < 0)
		return (reflect_ray(scal_x_vec(-1, d), normal));
	return (vadd(scal_x_vec(eta, d),
			scal_x_vec(eta - (sqrt(k) / cosi), normal)));
}
```

레이가 구 내부에 있는지(`inside`)에 따라 굴절률(`etai`/`etat`)의 위치를 바꿔주고, 판별식 `k`가 0보다 작아지면(전반사 조건) 굴절 대신 반사로 처리. 최종적으로 반사색과 원래 색을 반사율 비율로 블렌딩해 최종 색을 만듦.

# 텍스처

절차적 텍스처 3종 구현: 흑백 체커보드, 법선을 사인파로 흔들어 표면 굴곡을 표현하는 범프 효과, 파장 값을 RGB로 변환하는 무지개 그라디언트.

# 멀티스레드

씬(카메라)별 렌더링을 pthread 기반 스레드 풀(4개 스레드)로 분산 처리해 병렬로 렌더링하도록 구현 — 화면을 y축 기준으로 스레드 수만큼 나눠 각 스레드가 자기 구간만 렌더링. 스레드 간 구간 분배 방식을 잘못 설계해 특정 상황에서는 오히려 더 느려지기도 했지만, 멀티스레드 렌더링 파이프라인을 직접 구성해본 경험.

# 안티앨리어싱

픽셀당 네 모서리(2×2)를 우선 샘플링하고, 인접한 네 모서리 색상 차이가 임계값(1000) 이상으로 크게 벌어지는 픽셀만 재귀적으로 더 잘게 나눠(최대 3단계) 다시 샘플링하는 적응형 슈퍼샘플링. 색상 차이가 크지 않은 대부분의 픽셀은 4개 모서리 평균만으로 마무리해 불필요한 연산을 줄임. 인접 픽셀끼리 겹치는 모서리 샘플은 캐싱해서 재사용.

![적응형 슈퍼샘플링 — 1차에서 색상 차이가 큰 픽셀만 2차, 3차, 4차로 재귀적으로 더 잘게 나눠 재샘플링](/assets/images/minirt/aa-grid.png){: width="70%"}

# 회고

`.rt` 파일 분석부터 시작해, 3D 공간에서의 카메라에 대한 이해와 도형 방정식에 대한 이해가 함께 필요했던 프로젝트.

벡터는커녕 도형 판별식에 쓰이는 근의 공식조차 잊고 지냈던 수포자였기에, 3개월 중 1개월 반을 수학 기초를 다시 학습하는 데 사용. 게임 수학을 완벽히 이해하지는 못했지만, 벡터를 왜 쓰는지와 위상 수학이 컴퓨터 그래픽스에서 어떤 방식으로 쓰이는지는 이해할 수 있었음.

이 프로젝트를 기초로 그래픽스/게임 엔지니어링에 관심을 갖게 되었고, UE4를 본격적으로 학습하는 계기가 됨.

{% assign gh_card = page.link_cards | where: "name", "Github" | first %}
{% include link-card.html name=gh_card.name url=gh_card.url desc=gh_card.desc logo=gh_card.logo og_image=gh_card.og_image %}
