import { PATCH_TYPES } from "./constants.js";
import { createRealNode } from "./create-real-node.js";
import { updateProps } from "./dom-props.js";
import { getNodeByPath, getParentPath } from "./path.js";

function appendAtPath(rootNode, path, vnode) {
  if (path === "root") {
    return createRealNode(vnode);
  }

  const parentPath = getParentPath(path);
  const parentNode = getNodeByPath(rootNode, parentPath);
  const childNode = createRealNode(vnode);
  parentNode.appendChild(childNode);
  return rootNode;
}

export function applyPatch(rootNode, patch, container) {
  if (patch.type === PATCH_TYPES.CREATE) {
    if (patch.path === "root") {
      const newRoot = createRealNode(patch.node);
      container.appendChild(newRoot);
      return newRoot;
    }

    return appendAtPath(rootNode, patch.path, patch.node);
  }

  if (patch.type === PATCH_TYPES.REMOVE) {
    const target = getNodeByPath(rootNode, patch.path);
    target.parentNode.removeChild(target);
    return rootNode;
  }

  if (patch.type === PATCH_TYPES.REPLACE) {
    if (patch.path === "root") {
      const newRoot = createRealNode(patch.newNode);
      container.replaceChild(newRoot, rootNode);
      return newRoot;
    }

    const target = getNodeByPath(rootNode, patch.path);
    const parent = target.parentNode;
    const newNode = createRealNode(patch.newNode);
    parent.replaceChild(newNode, target);
    return rootNode;
  }

  if (patch.type === PATCH_TYPES.UPDATE_PROP) {
    const target = getNodeByPath(rootNode, patch.path);
    const nextProps =
      patch.newValue === undefined ? {} : { [patch.key]: patch.newValue };
    updateProps(target, { [patch.key]: patch.oldValue }, nextProps);
    return rootNode;
  }

  if (patch.type === PATCH_TYPES.UPDATE_TEXT) {
    const target = getNodeByPath(rootNode, patch.path);
    target.nodeValue = patch.newValue;
    return rootNode;
  }

  return rootNode;
}

export function commitPatches(rootNode, patches, container) {
  let nextRootNode = rootNode;

  patches.forEach((patch) => {
    nextRootNode = applyPatch(nextRootNode, patch, container);
  });

  return nextRootNode;
}
