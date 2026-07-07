---
title: "[백준] 팩토리얼 0의 개수"
date: 2024-11-13
category: algorithm
---

문제 링크: [백준 1676번](https://www.acmicpc.net/problem/1676)

![문제 화면](/assets/images/blog/baekjoon-factorial-zeros/problem-statement.png)

처음 구현할 때는 팩토리얼 함수를 짜고 거기서 F(N) / 10 을 하면서 0이 아닌 값을 구할 생각을 했다.

하지만 N의 값의 범위가 증가할수록 팩토리얼에서 나오는 수는 자료형에 담을 수 없을 정도로 방대해지기에 계산이 불가능.

그 다음으로 접근한 방법은 N / 5이다.

5의 배수가 될 때마다 0의 개수가 늘어나는 것을 발견했고, 이를 이용하고자 했지만 5의 거듭제곱이 나올 때는 0의 개수가 추가로 증가.

![5의 배수 접근 방식](/assets/images/blog/baekjoon-factorial-zeros/attempt2.png)

조언을 받아 해결한 방법은 각 수가 5의 거듭제곱을 몇 개씩 가지고 있는가를 판별하는 것.

![5의 거듭제곱 개수 계산](/assets/images/blog/baekjoon-factorial-zeros/solution-approach.png)

수가 증가함에 따른 결과를 계산하는 것이 아니라 해당하는 N에 대해 5의 거듭제곱 즉 500이하인 5, 25, 125를 몇 개씩 소유하고 있는 지에 대해 구하면 0의 개수가 나오는 문제였다.

이렇게 접근하는 이유는 수에 0이 생긴다는 것은 **(현재 숫자 &times; 10)** 을 했다는 것, &times;10은 즉 **2 &times; 5**이고, 2의 개수보단 5의 개수가 많기 때문에 5를 기준으로 계산해도 **&times;10** 의 개수를 구할 수 있다.

```cpp
#include <iostream>

using namespace std;

int main()
{
    cin.tie(0);
    ios::sync_with_stdio(false);

    int N;
    cin >> N;
    cout << N / 5 + N / 25 + N / 125 << endl;

    return 0;
}
```

규칙만 잘 찾는다면 간단한 문제이지만.. 수포자로서 개발자를 해 나가는 건 정말 쉽지 않다..

간단한 규칙임에도 조언이 없었다면 평생 도달하지 못했을 풀이법이다....
