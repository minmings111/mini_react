import { VNODE_INTERNAL_TYPES, VNODE_TYPES } from "./constants.js";

export function cloneVNode(vnode) {
  if (!vnode) return null;

  return {
    nodeType: vnode.nodeType,
    type: vnode.type,
    props: { ...(vnode.props || {}) },
    children: (vnode.children || []).map(cloneVNode),
  };
}

export function domToVNode(node) {
  if (!node) return null;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text.trim()) return null;

    return {
      nodeType: VNODE_TYPES.TEXT,
      type: VNODE_INTERNAL_TYPES.TEXT_ELEMENT,
      props: {
        nodeValue: text,
      },
      children: [],
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const props = {};

  for (const name of node.getAttributeNames().sort()) {
    props[name] = node.getAttribute(name) ?? "";
  }

  const children = [];

  for (const childNode of node.childNodes) {
    const childVNode = domToVNode(childNode);
    if (childVNode) {
      children.push(childVNode);
    }
  }

  return {
    nodeType: VNODE_TYPES.ELEMENT,
    type: node.tagName.toLowerCase(),
    props,
    children,
  };
}
