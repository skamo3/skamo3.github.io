---
title: "[Unreal Engine] Linux CrossCompile - Missing precompiled manifest 에러 해결"
date: 2024-07-31
category: unreal
---

Pixel streaming 서버 Auto Scaling을 진행하면서 k8s로 자동 배포는 Windows 환경에선 한계가 있다.

Linux 형태로 패키징할 필요가 생겼다.

## 크로스 컴파일

[언리얼 리눅스 크로스 컴파일](https://dev.epicgames.com/documentation/ko-kr/unreal-engine/linux-development-requirements-for-unreal-engine?application_version=5.2)

언리얼 엔진은 자체적으로 크로스 컴파일을 지원한다.

![언리얼 패키징 옵션에서 Linux 타겟 선택](/assets/images/blog/unreal-linux-crosscompile/linux-package-option.png)

GUI 상에서 Linux로 패키징을 시도하면 된다.

내부적으로는 RunUAT 를 실행하는 방식

## 컴파일 에러

```
Missing precompiled manifest for 'SubstanceCore', 'C:\Program Files\Epic Games\UE_5.2\Engine\Plugins\Marketplace\Substance\Intermediate\Build\Linux\UnrealGame\Development\SubstanceCore\SubstanceCore.precompiled'. This module was most likely not flagged for being included in a precompiled build - set 'PrecompileForTargets = PrecompileTargetsType.Any;' in SubstanceCore.build.cs to override. If part of a plugin, also check if its 'Type' is correct.
```

precompiled 파일이 없어서 생긴 문제

실제 경로로 가보니 Intermediate/ 하위에 Linux/ 전용 폴더가 생기지 않았다.

### GPT에서 내놓은 해결책

1. build.cs 파일에 문구 추가

```bash
PrecompileForTargets = PrecompileTargetsType.Any;
```

-> 외부 라이브러리이기 때문에 build.cs를 추가하는 것만으로는 해결할 수 없고 실제로 추가 후에 패키징을 시도해도 자동으로 Linux용 precompiled 파일이 생성되진 않는다

2. uplugin에 Type 추가

```bash
"Modules": [
    {
        "Name": "Substance",
        "Type": "Runtime",
        "LoadingPhase": "Default"
    }
]
```

-> 1번과 같이 외부 라이브러리라 좋지 않은 방법이고, 적용해도 되지 않는 방식.

## 해결 방법

핵심은 Linux용 precompiled 파일이 생성되지 않는 것.

사용 중인 플러그인은 Substance 3D for Unreal Engine

![Substance 마켓플레이스 페이지](/assets/images/blog/unreal-linux-crosscompile/substance-marketplace.png)

마켓플레이스에 보면 버전 및 지원 플랫폼에 대한 정보가 모두 들어있다.

![Substance 플러그인 지원 플랫폼 정보](/assets/images/blog/unreal-linux-crosscompile/substance-platform-support.png)

실제 Substance 플러그인이 설치된 폴더에 Libs 파일을 봐도 Linux용 파일이 있다.

그렇다면 precompiled 파일만 제대로 생성이 되면 된다는 뜻

```bash
.\Engine\Build\BatchFiles\RunUAT.bat BuildPlugin -Plugin="C:\Path\To\YourProject\Plugins\MyPlugin\MyPlugin.uplugin" --Package="C:\Path\To\YourProject\Plugins\MyPlugin\Binaries\Linux" -TargetPlatforms=Linux -Precompile
```

RunUAT 를 이용해서 플러그인을 미리 컴파일한다

중요한 점은 TargetPlatform이 Linux로 되어있어야 한다는 것.

-Package 로 지정한 경로에 해당하는 파일들이 생성되고 Intermediate로 들어가보면 정상적으로 Linux용 precompiled 파일이 생성됨을 확인할 수 있다

해당 폴더를 엔진 플러그인의 Intermediate/로 복사해준 후에 다시 에디터로 돌아가 크로스컴파일을 시도해보면 해결.

위 방법은 타겟으로 하는 플랫폼의 코드가 제대로 준비되어 있다는 가정하에 가능한 방법이다.

언리얼 크로스 컴파일 기능에는 아직 부족한 부분이 많은 것 같다...

누가 언리얼을 리눅스로 컴파일 할 생각을 하겠어.....
