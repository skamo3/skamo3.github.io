---
title: "[프로그래머스] 덧칠하기"
date: 2026-07-22
category: algorithm
---

문제 링크: [프로그래머스 - 덧칠하기](https://school.programmers.co.kr/learn/courses/30/lessons/161989)

레벨 1 문제인데 너무 어렵게 생각해서 쉽지 않았던 문제. 기록으로 남긴다.

## 정답 코드

```cpp
#include <vector>
using namespace std;

int solution(int n, int m, vector<int> section) {
    int answer = 0;
    int paintedUntil = 0; // 현재까지 칠해진 마지막 구역 번호

    for (int pos : section) {
        // 이미 이전 롤러 칠로 덮인 구역이면 건너뜀
        if (pos <= paintedUntil) {
            continue;
        }

        // pos부터 길이 m만큼 새로 칠함
        answer++;
        paintedUntil = pos + m - 1;
    }

    return answer;
}
```

## 그리디 접근

처음에는 더 많이 칠해야 하는 경우의 수를 먼저 찾아서 거기부터 칠해야 한다고 생각했다. 그런데 그렇게 접근하니 오히려 복잡해졌다.

`section`은 이미 오름차순으로 주어지기 때문에, 앞에서부터 순회하면서 아직 칠이 안 된 구역을 만나면 그 자리에서 길이 `m`짜리 롤러를 한 번 칠하고 `paintedUntil`을 옮겨주면 된다. 이미 덮인 구역은 건너뛰기만 하면 되니 단순 그리디로 풀리는 문제였다.

## 칠하는 과정

`n = 8`, `m = 4`, `section = [2, 3, 6]` 인 경우를 그림으로 보면 흐름이 명확하다.

시작 상태는 2, 3, 6번 구역의 칠이 벗겨져 있다.

![시작 상태: 2, 3, 6번 구역의 칠이 벗겨진 모습](/assets/images/blog/programmers-paint-roller/state-1-initial.svg)

처음 벗겨진 2번부터 롤러(`m = 4`)를 칠하면 2 ~ 5번까지 덮인다. 남은 건 6번뿐이다.

![첫 번째 롤러: 2번부터 4칸을 칠해 2 ~ 5번이 덮이고 6번만 남은 모습](/assets/images/blog/programmers-paint-roller/state-2-first-roller.svg)

이어서 6번부터 한 번 더 칠하면 모든 벗겨진 칸이 덮이면서 롤러 2번으로 끝난다.

![두 번째 롤러: 6번부터 칠해 2 ~ 5번, 6 ~ 9번이 모두 덮인 모습](/assets/images/blog/programmers-paint-roller/state-3-second-roller.svg)

너무 복잡하게 생각하지 말고 간단한 접근부터 시작하자..
