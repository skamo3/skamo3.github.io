---
title: "언리얼 엔진 간단 팁 모음"
date: 2024-12-16
category: unreal
---

## 언리얼 C++ Visual Studio에서 현재 프로젝트 Directory 기본 검색으로 Path 추가

프로젝트.build.cs 에서 IncludePath 추가

```csharp
 PublicIncludePaths.AddRange(
     new string[] {
         ModuleDirectory,
     }
 );
```
