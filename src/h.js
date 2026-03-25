import { VNODE_TYPES } from "./constants.js";

function createTextNode(value) {
  return {
    nodeType: VNODE_TYPES.TEXT,
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: String(value),
    },
    children: [],
  };
}

function normalizeChild(child) {
  if (child == null || child === false || child === true) {
    return createTextNode("");
  }

  if (typeof child === "string" || typeof child === "number") {
    return createTextNode(child);
  }

  return child;
}

export function h(type, props, ...children) {
  const nodeType =
    typeof type === "function" ? VNODE_TYPES.COMPONENT : VNODE_TYPES.ELEMENT;

  return {
    nodeType,
    type,
    props: props || {},
    children: children.flat().map(normalizeChild),
  };
}

export function createTextVNode(value) {
  return createTextNode(value);
}
