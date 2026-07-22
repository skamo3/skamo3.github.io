---
title: "[프로그래머스] 기사단원의 무기"
date: 2026-07-22
category: algorithm
---

문제 링크: [프로그래머스 - 기사단원의 무기](https://school.programmers.co.kr/learn/courses/30/lessons/136798)

각 번호의 약수 개수를 공격력으로 삼되, 그 값이 `limit`을 넘어가는 기사는 `power`로 대체해서 전부 더하면 되는 문제.

## 처음 완성한 코드

`1`부터 `number`까지 각각 `sqrt(n)`까지 순회하며 약수의 개수를 직접 셌다.

```cpp
#include <vector>
#include <cmath>

using namespace std;

int solution(int number, int limit, int power) {
    int answer = 0;

    for (int n = 1; n <= number; n++)
    {
        int sum = 0;
        for (int i = 1; i <= sqrt(n); i++)
        {
            if (n % i == 0)
            {
                sum++;
                if (i != n / i)
                    sum++;
            }
            if (sum > limit)
            {
                sum = power;
                break;
            }
        }
        answer += sum;
    }
    return answer;
}
```

## 에라토스테네스의 체 방식

풀이법 중 에라토스테네스의 체를 사용하는 방법이 있었고, 이런 문제에 효과적이라 생각해 기록한다.

에라토스테네스의 체는 목표 인덱스까지 각 인덱스별로 약수를 누적해 기록하는 방식이다. 완성 코드는 아래와 같다.

```cpp
#include <vector>

using namespace std;

int solution(int number, int limit, int power) {
    vector<int> counts(number + 1, 0);

    for (int i = 1; i <= number; i++)
    {
        for (int j = i; j <= number; j += i)
            counts[j]++;
    }

    int answer = 0;
    for (int i = 1; i <= number; i++)
    {
        answer += counts[i] > limit ? power : counts[i];
    }

    return answer;
}
```

## 배열이 채워지는 과정

`number`가 5라면 `counts`는 `[0, 0, 0, 0, 0, 0]`으로 시작한다. `1`부터 `5`까지 순회하면서 자기 자신의 배수 자리에 `1`씩 더해준다.

- `i = 1` 일 때 1의 배수에 +1
- `i = 2` 일 때 2의 배수에 +1
- `i = 3` 일 때 3의 배수에 +1

이런 식으로 진행되면, 각 인덱스에는 결국 그 수를 약수로 가지는 값이 몇 번 더해졌는지, 즉 약수의 개수가 쌓인다.

![number가 5일 때 counts 배열이 i=1부터 5까지 각 단계마다 배수 자리에 1씩 누적되는 과정. 파란 칸은 그 단계에서 +1 된 자리이고, 마지막 행은 최종 약수 개수](/assets/images/blog/programmers-knight-weapon/sieve-array.svg)

파란 칸이 그 단계에서 `+1` 된 자리이고, 맨 아래 행이 최종 약수 개수다. `4`는 약수가 `1, 2, 4`로 3개, 나머지는 예상대로 채워진다.

기존 코드와 달리 나머지·나누기 연산 없이 더하는 연산만 사용하기 때문에 컴퓨터 입장에서 더 빠르다. 또 반복 횟수도 극적으로 감소해 `O(N log N)`의 시간 복잡도를 가진다.

`i = 1` 일 땐 `n`개만큼 돌지만 `i = 2` 일 땐 `n / 2`, `i = 3` 일 땐 `n / 3` 으로 안쪽 반복이 점점 줄어들기 때문이다.

에라토스테네스의 체는 전부터 어디에 쓸 수 있을까 고민이 많았는데, 이런 약수 세기 문제에 마침 딱이었다.
