---
title: "[프로그래머스] 두 정수 사이의 합"
date: 2026-07-01
category: algorithm
---

문제 링크: [프로그래머스 - 두 정수 사이의 합](https://school.programmers.co.kr/learn/courses/30/lessons/12912)

(a, b) 사이 값을 모두 더하는 가장 간단한 문제이다.

풀이 자체는 어렵지 않았는데 다른 사람의 코드를 보면서 시그마 공식에 대해 보고 가장 기본적인 수학을 놓치고 있어 기록하기위해 남김

내 코드

```cpp
#include <algorithm>

using namespace std;

long long solution(int a, int b) {
    long long answer = 0;
    int i = abs(a - b);
    int target = max(a, b);
    while (i--)
    {
        answer += target--;
    }
    answer += target;
    return answer;
}
```

### 시그마 공식을 활용한 풀이

시그마 공식은

> 1 + 2 + 3 + ... + n = n(n + 1) / 2

1부터 10까지 합을 구할 때 보통은

> 1 + 2 + 3 + ... + 10 = 55

시그마 공식으로 하면

> 10 * 11 / 2 = 55

결과적으로 같은 값이 나온다.

시그마 공식의 핵심은 평균 값을 기준으로 수가 몇개 들어있느냐를 구하는 것

> 3 + 4 + 5 + 6 + 7

가 있을 때 직접 더하면 25 가 나옴

이 수들의 가운데 값은 5. 즉 평균은 5라는 것.

연속된 수인 경우 뒤와 앞의 숫자 개수만큼 평균값을 곱해주면 같은 값이 나온다

> 평균값 * 숫자의 개수

연속된 수에서 평균은 이렇게 구할 수 있다

> 평균 = (첫 번째 수 + 마지막 수) / 2

문제로 돌아가서 a 와 b 사이 값을 구할 때 중요한 건 숫자의 개수가 몇개 있는가를 파악하는 것이다

> (첫 수 + 끝 수) / 2 * 개수
> 원래라면 위처럼 해야하지만 보기좋게 아래 방식으로 한다.
> (첫 수 + 끝 수) * 개수 / 2

이 때 개수는 a - b + 1 이 된다.

최종 제출 코드

```cpp
#include <algorithm>

using namespace std;

long long solution(int a, int b) {
    return static_cast<long long>(a + b) * (abs(a - b) + 1) / 2;
}
```
