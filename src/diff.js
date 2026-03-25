import { PATCH_TYPES, VNODE_TYPES } from "./constants.js";
import { resolveComponentVNode } from "./create-real-node.js";

function normalizeVNode(vnode) {
  if (!vnode) {
    return vnode;
  }

  if (vnode.nodeType === VNODE_TYPES.COMPONENT) {
    return normalizeVNode(resolveComponentVNode(vnode));
  }

  return vnode;
}

export function diff(oldInput, newInput, path = "root") {
  const oldNode = normalizeVNode(oldInput);
  const newNode = normalizeVNode(newInput);
  const patches = [];

  if (oldNode == null) {
    patches.push({ type: PATCH_TYPES.CREATE, path, node: newNode });
    return patches;
  }

  if (newNode == null) {
    patches.push({ type: PATCH_TYPES.REMOVE, path });
    return patches;
  }

  if (oldNode.nodeType === VNODE_TYPES.TEXT && newNode.nodeType === VNODE_TYPES.TEXT) {
    if (oldNode.props.nodeValue !== newNode.props.nodeValue) {
      patches.push({
        type: PATCH_TYPES.UPDATE_TEXT,
        path,
        oldValue: oldNode.props.nodeValue,
        newValue: newNode.props.nodeValue,
      });
    }
    return patches;
  }

  if (
    oldNode.nodeType !== newNode.nodeType ||
    oldNode.type !== newNode.type
  ) {
    patches.push({
      type: PATCH_TYPES.REPLACE,
      path,
      oldNode,
      newNode,
    });
    return patches;
  }

  const oldProps = oldNode.props || {};
  const newProps = newNode.props || {};
  const propKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

  propKeys.forEach((key) => {
    if (oldProps[key] !== newProps[key]) {
      patches.push({
        type: PATCH_TYPES.UPDATE_PROP,
        path,
        key,
        oldValue: oldProps[key],
        newValue: newProps[key],
      });
    }
  });

  const maxLength = Math.max(oldNode.children.length, newNode.children.length);

  for (let index = 0; index < maxLength; index += 1) {
    patches.push(
      ...diff(
        oldNode.children[index],
        newNode.children[index],
        `${path}.children[${index}]`
      )
    );
  }

  return patches;
}
