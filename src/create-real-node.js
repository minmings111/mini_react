import { VNODE_TYPES } from "./constants.js";
import { setProp } from "./dom-props.js";

function resolveVNode(vnode) {
  if (vnode?.nodeType === VNODE_TYPES.COMPONENT) {
    return vnode.type({
      ...(vnode.props || {}),
      children: vnode.children,
    });
  }

  return vnode;
}

export function createRealNode(inputVNode) {
  const vnode = resolveVNode(inputVNode);

  if (vnode.nodeType === VNODE_TYPES.TEXT) {
    return document.createTextNode(vnode.props.nodeValue);
  }

  const domNode = document.createElement(vnode.type);

  Object.entries(vnode.props || {}).forEach(([key, value]) => {
    setProp(domNode, key, value);
  });

  vnode.children.forEach((child) => {
    domNode.appendChild(createRealNode(child));
  });

  return domNode;
}

export function resolveComponentVNode(vnode) {
  return resolveVNode(vnode);
}
