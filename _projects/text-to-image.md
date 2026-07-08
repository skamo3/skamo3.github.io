---
title: Text to Image
type: personal
category: ai
period: "2019.10 - 2019.12"
order: 8
thumbnail: /assets/images/text-to-image/thumbnail.svg
summary: "QuickDraw Dataset · Text 조건부 GAN(CGAN+DCGAN)으로 스케치 이미지 생성"
team: "3인 프로젝트"
stack: ["Python", "TensorFlow", "Keras", "CGAN", "DCGAN"]
link_cards:
  - name: "Github"
    url: "https://github.com/skamo3/text-to-image"
    inline: true
toc:
  - label: "프로젝트 소개"
    anchor: "#프로젝트-소개"
  - label: "1차 모델 — cDCGAN"
    anchor: "#1차-모델--cdcgan"
  - label: "2차 모델 — Condition 제거"
    anchor: "#2차-모델--condition-제거"
  - label: "문제 진단과 3차 모델"
    anchor: "#문제-진단과-3차-모델"
  - label: "회고"
    anchor: "#회고"
---

# 프로젝트 소개

Google의 [QuickDraw Dataset](https://github.com/googlecreativelab/quickdraw-dataset)을 이용해, 유저가 입력한 Text에 맞는 QuickDraw 스타일 스케치 이미지를 그려주는 GAN 모델을 만든 3인 팀 프로젝트. 기존 CGAN(Conditional GAN)의 Condition 개념과 DCGAN의 Convolution 기반 생성 구조를 결합해, Text(class label)를 조건으로 받아 이미지를 생성하는 모델을 직접 설계.

![QuickDraw Dataset 샘플](https://user-images.githubusercontent.com/54701846/69910685-ecbe7500-1452-11ea-855f-9e83a8edd4d8.png){: width="70%"}

Colab + TensorFlow 2.x/Keras 환경에서 실험을 진행했고, 모델 이름은 CGAN과 DCGAN을 합쳐 편의상 cDCGAN으로 명명. Condition 값을 어디에 어떻게 넣을지, Convolution 계층 구성을 어떻게 바꿀지를 축으로 여러 차례 재설계하며 실험을 반복.

# 1차 모델 — cDCGAN

Generator에 341개(전체 class 수 + Condition 없음을 뜻하는 False 항 1개)의 Condition 벡터와 100차원 Noise를 함께 입력하고, Discriminator에는 Label이 붙은 이미지를 넣어 진짜/가짜와 함께 어떤 class인지도 분류하도록 하는 구조로 첫 모델을 설계.

![1차 모델 구조](https://user-images.githubusercontent.com/54701846/69911937-f4d3e000-1465-11ea-9420-741b6f1543c6.png){: width="70%"}

결과는 그림을 전혀 그려내지 못하고 Noise 이미지만 생성. Condition 정보량 대비 학습이 따라가지 못하는 것으로 보고 다음 모델에서 구조를 단순화.

# 2차 모델 — Condition 제거

Generator에 넣던 341차원 Condition 벡터를 제거하고, Discriminator에서만 class를 분류하도록 구조를 단순화. Generator가 Noise만으로 이미지를 생성하고, Discriminator가 진짜/가짜 판별과 함께 class 분류까지 담당하는 형태로 재설계.

![2차 모델 구조](https://user-images.githubusercontent.com/54701846/69912704-58630b00-1470-11ea-8b88-b969250aa351.png){: width="70%"}

여전히 결과물은 1차와 크게 다르지 않았음.

![2차 모델 학습 결과 — 여전히 Noise에 가까움](https://user-images.githubusercontent.com/54701846/69912799-94e33680-1471-11ea-9270-b22fe4468a9f.png){: width="70%"}

# 문제 진단과 3차 모델

두 차례의 실패 원인을 두 가지로 정리:

1. Class 개수가 341개로 너무 많아, 이 정도 규모의 모델과 데이터로는 한 번에 학습하기 어려울 수 있음
2. Loss Function이 QuickDraw 데이터 특성에 적합하지 않을 수 있음

원인을 좁혀서 확인하기 위해, 전체 341개 class 대신 사과 단일 class 데이터로만 학습하는 DCGAN으로 모델을 축소.

![3차 모델(사과 단일 class) 학습 결과 — 놀랍게도 사과다](https://user-images.githubusercontent.com/54701846/69912789-7ed57600-1471-11ea-82b7-f4d1ffc36be4.png){: width="70%"}

이전 두 모델보다 뚜렷하게 나아진 결과를 얻었고, class 수를 줄이는 방향이 유효했음을 확인. 다만 여전히 QuickDraw 특유의 단순한 선화를 세밀하게 그려내는 데는 한계가 있었음.

# 회고

파라미터를 하나씩 바꿔가며 어떤 변화가 유의미한 결과 차이로 이어지는지 확인하는 과정에서, GAN 모델이 파라미터 변화에 따라 어떻게 반응하는지에 대한 감을 익힘. 또한 기존에 쓰던 Loss Function이 QuickDraw 데이터에 잘 맞지 않는다는 걸 확인하면서, GAN에 쓰이는 다양한 Loss Function을 찾아보고 학습하는 계기가 됨.

추후 개선 방향으로는 Loss Function 자체를 WGAN, SAGAN 등 다른 GAN 변형 모델이 사용하는 방식으로 바꿔보는 것을 정리. GAN은 Loss Function에 따라 학습 불안정성이 크게 갈리기 때문에, 다양한 파생 모델이 어떤 아이디어로 안정성과 정확도를 높였는지 파악해 적용해보는 것을 다음 과제로 남김.
