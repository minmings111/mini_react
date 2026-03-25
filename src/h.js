import { VNODE_INTERNAL_TYPES, VNODE_TYPES } from "./constants.js";

// h.js의 목적:
// 사용자가 넘긴 UI 입력(type, props, children)을
// 프로젝트 규칙에 맞는 VNode JS 객체로 바꾸는 것이다.
//
// 파일 이름이 h인 이유:
// React의 createElement처럼 "VNode를 만드는 함수"를 짧게 부르기 위해서다.
// JSX를 쓰지 않는 지금 단계에서는 h("div", ...) 같은 형태로 직접 호출한다.

// 문자열/숫자 자식은 그대로 두지 않고 TEXT VNode로 감싸야
// diff와 commit 단계에서 텍스트도 하나의 노드로 비교할 수 있다.
function createTextNode(value) {
  return {
    nodeType: VNODE_TYPES.TEXT,
    type: VNODE_INTERNAL_TYPES.TEXT_ELEMENT,
    props: {
      nodeValue: String(value),
    },
    children: [],
  };
}

// children에는 문자열, 숫자, null, boolean, 이미 만들어진 VNode 등이 섞여 들어올 수 있다.
// 그래서 h() 안으로 들어오는 자식을 "프로젝트가 다룰 수 있는 VNode 형태"로 정규화한다.
//
// A 역할에서 확인해야 할 것:
// 1. 문자열/숫자가 TEXT VNode로 바뀌는지
// 2. null/boolean을 어떻게 처리할지 팀 기준과 맞는지
function normalizeChild(child) {
  if (child == null || child === false || child === true) {
    return null;
  }

  if (typeof child === "string" || typeof child === "number") {
    return createTextNode(child);
  }

  return child;
}

// h()는 이 프로젝트의 "VNode 생성 진입점"이다.
// 실제 DOM을 만드는 함수가 아니라, Virtual DOM 객체를 만드는 함수다.
//
// 입력:
// - type: "div", "button" 같은 태그명 또는 컴포넌트 함수
// - props: 속성 객체
// - children: 자식들
//
// 출력:
// - { nodeType, type, props, children } 형태의 VNode
//
// A 역할에서 가장 중요하게 봐야 하는 함수:
// - nodeType이 ELEMENT / COMPONENT 중 무엇이 되는지
// - props가 그대로 들어가는지
// - children이 normalizeChild를 거쳐 일관된 VNode 배열이 되는지
export function h(type, props, ...children) {
  const nodeType =
    typeof type === "function" ? VNODE_TYPES.COMPONENT : VNODE_TYPES.ELEMENT;

  return {
    nodeType,
    type,
    props: props || {},
    children: children.flat().map(normalizeChild).filter(Boolean),
  };
}

// 외부에서 TEXT VNode를 직접 만들고 싶을 때 쓰는 보조 함수다.
// 현재는 createTextNode를 한 번 감싼 얇은 wrapper 역할만 한다.
//
// A 역할에서 구현을 검토할 대상:
// - createTextVNode를 공개 helper로 유지할지
// - 테스트와 문서에서 명시적으로 사용할지
export function createTextVNode(value) {
  return createTextNode(value);
}
