# Team Decisions

이 문서는 우리 팀이 `mini-react`를 구현할 때 지켜야 하는 공통 기준을 기록한 문서입니다.
헷갈릴 때마다 이 문서를 먼저 확인합니다.

## Project Goal

- 이 프로젝트는 `학습용 mini-react 라이브러리`를 만드는 것이 목적입니다.
- 우리는 React의 모든 기능을 복제하지 않습니다.
- 1차 목표는 `Virtual DOM`, `diff`, `commit`, `key 기반 매칭`의 핵심 원리를 직접 구현하고 이해하는 것입니다.

## Current Scope

이번 단계에서 포함하는 것:

- JSX 없이 동작하는 mini-react 코어
- Virtual DOM type 3개
- Patch type 5개
- 실제 DOM 반영 로직
- `key` 기반 자식 매칭
- 학습용 데모 페이지

이번 단계에서 포함하지 않는 것:

- JSX 파싱/변환
- hooks
- React와 동일한 수준의 최적화
- 고급 reconciliation
- `MOVE` patch
- production-ready 패키지 품질 보장

## Directory Roles

- `src/`
  - 라이브러리 코어 구현
  - Virtual DOM 생성, diff, commit, render 등 엔진 코드만 둡니다.

- `examples/`
  - 라이브러리를 사용한 데모 앱
  - 학습용 페이지, 시각화 페이지, 샘플 앱을 둡니다.

- `test/`
  - 코어 로직 검증용 테스트

## Core Data Model

### Virtual DOM Types

우리는 Virtual DOM node type을 아래 3개로 고정합니다.

- `ELEMENT`
- `TEXT`
- `COMPONENT`

설명:

- `ELEMENT`: 일반 HTML 태그 노드
- `TEXT`: 텍스트 노드
- `COMPONENT`: 함수형 컴포넌트 같은 추상 노드

### Patch Types

우리는 patch type을 아래 5개로 고정합니다.

- `CREATE`
- `REMOVE`
- `REPLACE`
- `UPDATE_PROP`
- `UPDATE_TEXT`

설명:

- `CREATE`: 새 노드 생성
- `REMOVE`: 기존 노드 제거
- `REPLACE`: 노드 전체 교체
- `UPDATE_PROP`: 속성 변경
- `UPDATE_TEXT`: 텍스트 변경

주의:

- 1차 구현에서는 `MOVE` patch를 도입하지 않습니다.
- reorder는 `key 기반 매칭`까지만 고려하고, 실제 이동 최적화는 다음 단계 과제로 둡니다.

## Key Policy

우리 팀은 아래 기준으로 `key`를 구현합니다.

- `key`는 `props.key`에 둡니다.
- `key`는 같은 부모의 형제 자식끼리만 비교합니다.
- `key`가 없으면 `index` 기준 비교로 fallback합니다.
- 중복 `key`가 발견되면 경고를 남깁니다.
- 1차 구현에서는 `MOVE` patch 없이 진행합니다.
- 이번 주 목표는 `key 기반 매칭`까지만 구현합니다.

예시:

```js
h("li", { key: "todo-1" }, "첫 번째 아이템")
```

### Key-related Team Rules

- `diff` 담당자는 key가 있는 경우와 없는 경우를 분리해서 생각합니다.
- `commit` 담당자는 key 기반 최적화보다 현재 patch 타입 5개 안정화에 집중합니다.
- `examples` 담당자는 `key 없음 / key 있음` 비교를 눈으로 볼 수 있게 데모를 설계합니다.
- `test` 담당자는 key 중복, key 없음, key 있음의 3가지 케이스를 최소 테스트로 만듭니다.

## Render / Commit Rule

용어를 아래처럼 통일합니다.

- `render`
  - 새 Virtual DOM을 계산하는 단계
  - 이전 스냅샷과 비교할 준비를 하는 단계

- `commit`
  - patch를 실제 DOM에 반영하는 단계

- `mount`
  - 실제 DOM에 처음 붙는 commit

주의:

- `render`와 `commit`은 구분해서 생각합니다.
- 학습용 코드에서 함수 이름이 단순해도 개념은 분리해서 설명합니다.

## Demo Policy

우리 팀의 데모는 아래 목표를 가져야 합니다.

- 사용자가 상태 변화 흐름을 눈으로 볼 수 있어야 합니다.
- 최소한 아래 값들을 화면에서 확인할 수 있어야 합니다.
  - `state`
  - `oldVdom`
  - `newVdom`
  - `diff 결과`

- 가능하면 아래도 보여줍니다.
  - patch 개수
  - patch type 종류
  - 실제 DOM 반영 결과

### Demo Responsibilities

- 데모 코드는 `examples/` 아래에 둡니다.
- 데모를 위해 필요한 시각화 코드는 `src/`에 넣지 않습니다.
- 데모 편의용 문자열, 버튼, 패널 UI는 코어 엔진과 분리합니다.

## Implementation Boundaries

### What Must Stay in `src/`

- `h`
- Virtual DOM 구조
- diff 로직
- patch 생성/반영
- render 흐름
- DOM helper

### What Must Stay out of `src/`

- 학습용 문구
- 버튼 클릭 안내 문구
- 시각화용 패널 UI
- 강의/설명 목적의 상태 표시

## Team Working Rules

- 코드를 수정하기 전에 현재 합의사항과 충돌하지 않는지 확인합니다.
- 새로운 기능을 넣기 전에는:
  - 범위에 포함되는지
  - patch type 추가가 필요한지
  - 데모에도 보여줄지
  를 먼저 결정합니다.

- 팀원이 파일을 수정할 때는 다른 사람이 맡은 책임 영역을 침범하지 않도록 합니다.
- 모호한 용어는 README나 이 문서에 추가합니다.

## Suggested Role Split For 4 People

### Fixed File Ownership Labels

팀에서는 아래의 `A / B / C / D` 라벨에 사람 이름만 매핑해서 사용합니다.

- `A`
  - 목적: Virtual DOM node의 형태와 생성 규칙을 고정합니다.
  - 개발 목표: `h()`가 일관된 VNode를 만들고, `ELEMENT / TEXT / COMPONENT` 기준이 프로젝트 전체에서 흔들리지 않게 합니다.
  - `src/h.js`
  - `src/constants.js`

- `B`
  - 목적: 이전 VDOM과 새 VDOM을 비교해서 patch를 올바르게 계산합니다.
  - 개발 목표: patch type 5개와 key 정책이 정확히 반영된 `diff()`를 구현합니다.
  - `src/diff.js`

- `C`
  - 목적: diff 결과를 실제 DOM에 안전하게 반영하고 전체 렌더 흐름을 연결합니다.
  - 개발 목표: `commit`, `render`, DOM helper가 함께 동작해서 patch가 실제 화면 변경으로 이어지게 만듭니다.
  - `src/commit.js`
  - `src/render.js`
  - `src/path.js`
  - `src/dom-props.js`

- `D`
  - 목적: 사용자가 우리 엔진의 동작을 이해할 수 있도록 데모, 테스트, 문서를 관리합니다.
  - 개발 목표: `examples/`에서 상태 변화와 diff 결과를 보여주고, `test/`와 문서로 팀 이해를 돕습니다.
  - `examples/`
  - `test/`
  - `README.md`
  - `DECISIONS.md`

주의:

- 팀원끼리는 `누가 A를 맡을지`, `누가 B를 맡을지`만 정하면 됩니다.
- 기본적으로 다른 라벨의 파일은 함부로 수정하지 않습니다.
- 다른 라벨 영역 수정이 필요하면 먼저 팀원과 합의합니다.

### 1. Virtual DOM / `h`

담당 파일 예시:

- `src/h.js`
- `src/constants.js`

주요 책임:

- VNode shape 고정
- `ELEMENT / TEXT / COMPONENT` 규칙 유지
- child normalization 정리

### 2. Diff / Key

담당 파일 예시:

- `src/diff.js`

주요 책임:

- patch type 5개 유지
- key 정책 구현
- key fallback 정책 반영
- 중복 key 경고 처리

### 3. Commit / Render

담당 파일 예시:

- `src/commit.js`
- `src/render.js`
- `src/dom-props.js`
- `src/path.js`

주요 책임:

- patch를 실제 DOM에 반영
- render / commit 흐름 관리
- DOM helper 보강

### 4. Demo / Tests / Docs

담당 파일 예시:

- `examples/`
- `test/`
- `README.md`
- `DECISIONS.md`

주요 책임:

- 학습용 시각화 페이지
- key 비교 시나리오 데모
- 테스트 보강
- 문서 업데이트

## Definition of Done For This Phase

이번 단계가 끝났다고 볼 기준:

- `src/`에서 Virtual DOM type 3개가 일관되게 사용된다.
- patch type 5개가 일관되게 사용된다.
- `key`가 `props.key`로 동작한다.
- key가 없으면 index 기준 fallback이 동작한다.
- 중복 key 경고가 동작한다.
- `examples/`에서 key 없음 / key 있음 비교 데모가 보인다.
- `test/`에 key 관련 테스트가 추가된다.

## Things We Intentionally Postpone

아래 항목은 지금 당장 하지 않습니다.

- JSX 지원
- `MOVE` patch
- hook 시스템
- React와 동일한 scheduling
- production build / bundler 최적화

## When We Need a New Team Decision

아래 상황이 생기면 새로 합의가 필요합니다.

- patch type을 추가하고 싶을 때
- `MOVE` patch를 도입하고 싶을 때
- component 지원 범위를 넓히고 싶을 때
- key 정책을 바꾸고 싶을 때
- demo와 core 경계가 흔들릴 때
