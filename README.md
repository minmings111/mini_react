# mini-react

JSX 없이 Virtual DOM과 diff/commit 흐름을 학습하고 구현하기 위한 작은 라이브러리 뼈대입니다.

## Current Assumptions

- VNode shape 필드
  - `nodeType`
  - `type`
  - `props`
  - `children`
- VNode internal type
  - `TEXT_ELEMENT`
- Virtual DOM node category 3개
  - `ELEMENT`
  - `TEXT`
  - `COMPONENT`
- Patch type 5개
  - `CREATE`
  - `REMOVE`
  - `REPLACE`
  - `UPDATE_PROP`
  - `UPDATE_TEXT`

## Child Normalization

- string child -> `TEXT` VNode
- number child -> string으로 바꾼 뒤 `TEXT` VNode
- `null`, `undefined`, `true`, `false` -> children에서 제거

## Structure

- `src/`: 라이브러리 소스
- `examples/`: 브라우저 예제
- `test/`: 최소 테스트
