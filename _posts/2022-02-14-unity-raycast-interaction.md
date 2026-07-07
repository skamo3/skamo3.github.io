---
title: "[Unity] 1인칭 캐릭터 Raycast로 오브젝트와 상호작용 하기"
date: 2022-02-14
category: unity
---

1인칭 캐릭터의 눈 앞에 있는 오브젝트와의 상호작용 구현 중 제대로 된 정보가 없어 직접 쓰기로 함.

Unity Document에서 Physics.Raycast를 찾아보면 사용할 수 있는 함수형태가 아주 많다.

```cs
public static bool Raycast(Vector3 origin, Vector3 direction, float maxDistance = Mathf.Infinity, int layerMask = DefaultRaycastLayers, QueryTriggerInteraction queryTriggerInteraction = QueryTriggerInteraction.UseGlobal);
public static bool Raycast(Vector3 origin, Vector3 direction, out RaycastHit hitInfo, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction);
public static bool Raycast(Ray ray, float maxDistance = Mathf.Infinity, int layerMask = DefaultRaycastLayers, QueryTriggerInteraction queryTriggerInteraction = QueryTriggerInteraction.UseGlobal);
public static bool Raycast(Ray ray, out RaycastHit hitInfo, float maxDistance = Mathf.Infinity, int layerMask = DefaultRaycastLayers, QueryTriggerInteraction queryTriggerInteraction = QueryTriggerInteraction.UseGlobal);
```

### 카메라를 기준으로 한 Raycast

1인칭 시점의 캐릭터는 카메라가 캐릭터에 고정되어 있다.

이를 이용해 캐릭터 자체가 아닌 현재 내 시점을 기준으로 앞에 놓인 오브젝트 상호작용을 위해서는 transform.position을 쓰는것보다 카메라에서 나온 Ray를 이용하는 것이 더 좋다.

우선 예시 코드부터 보자.

```cs
public class PlayerMovement : MonoBehaviour
{
    private Vector3 ScreenCenter;

    Vector3 lookDirection = new Vector3(1, 0, 0);

    void Start()
    {
        ScreenCenter = new Vector3(Camera.main.pixelWidth / 2, Camera.main.pixelHeight / 2);
    }

    void Update()
    {
        RaycastHit hit;
        Ray ray = Camera.main.ScreenPointToRay(ScreenCenter);

        if (Physics.Raycast(ray, out hit, 0.5f))
        {
            Object obj = hit.collider.GetComponent<Object>();
            if (obj != null)
            {
            	// 동작 구현
            }
        }
        
    }
}
```

#### 화면 중앙 위치 찾아두기

```cs
ScreenCenter = new Vector3(Camera.main.pixelWidth / 2, Camera.main.pixelHeight / 2);
```

#### Ray 구해오기

```cs
RaycastHit hit;
Ray ray = Camera.main.ScreenPointToRay(ScreenCenter);
```

RaycastHit의 경우 맞은 물체를 저장해줄 변수. 아래에서 out 키워드를 활용해 오브젝트를 담아올 예정이니 우선 선언만 해둔다.

Main Camera를 참조한 후 위에서 구해둔 ScreenCenter 변수를 이용해 화면 중앙으로부터 나아가는 Ray를 구해준다.

#### Raycast 후 오브젝트 동작 구현

```cs
if (Physics.Raycast(ray, out hit, 0.5f))
{
    Object obj = hit.collider.GetComponent<Object>();
    if (obj != null)
    {
        // 동작 구현
    }
}
```

Physics.Raycast() 함수의 return되는 변수는 bool 형태이기에 if 문의 조건으로 활용할 수 있다. 아무것도 부딪히지 않는다면 로직을 지나간다.

여기서 위에 구해둔 Ray를 활용하기 위해 Raycast() 함수의 4번째 형태를 이용.

```cs
public static bool Raycast(Ray ray, out RaycastHit hitInfo, float maxDistance = Mathf.Infinity, int layerMask = DefaultRaycastLayers, QueryTriggerInteraction queryTriggerInteraction = QueryTriggerInteraction.UseGlobal);
```

3번째 형태와 4번째 형태의 차이는 RaycastHit 변수를 이용해 마주한 오브젝트를 가져오냐 가져오지 않느냐의 차이이다.

여기선 이를 이용하기 위해 위에 선언해둔 hit 변수를 넣어준다. 그리고 3번째 매개변수로는 0.5f 를 넣어주고 있는데, **감지할 거리**이다. 아무것도 지정해주지 않는다면 무한한 직선으로 Raycast를 실행하게 된다.

Raycast해서 나온 hit 변수는 collider를 가진 Object라는 가정하에 Getcomponent<>() 를 이용해 오브젝트를 할당한 후 null 체크를 해주며 원하는 동작을 구현한다.

### 구현 예시

오브젝트와 마주한 상태로 상호작용 할 경우 오브젝트

![Raycast 상호작용 데모](/assets/images/blog/unity-raycast-interaction/raycast-demo.gif)

의 출력 함수를 실행해주는 GIF
