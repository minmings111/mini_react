import { PATCH_TYPES, VNODE_TYPES } from "./constants.js";
import { resolveComponentVNode } from "./create-real-node.js";

const KEY_PROP = "key";

function normalizeVNode(vnode) {
  if (!vnode) {
    return vnode;
  }

  if (vnode.nodeType === VNODE_TYPES.COMPONENT) {
    const resolvedVNode = normalizeVNode(resolveComponentVNode(vnode));

    if (!resolvedVNode) {
      return resolvedVNode;
    }

    const componentKey = vnode.props?.[KEY_PROP];

    if (
      componentKey === undefined ||
      resolvedVNode.props?.[KEY_PROP] !== undefined
    ) {
      return resolvedVNode;
    }

    return {
      ...resolvedVNode,
      props: {
        ...(resolvedVNode.props || {}),
        [KEY_PROP]: componentKey,
      },
    };
  }

  return vnode;
}

function getChildPath(parentPath, index) {
  return `${parentPath}.children[${index}]`;
}

function getNodeKey(vnode) {
  if (!vnode) {
    return null;
  }

  return vnode.props?.[KEY_PROP] ?? null;
}

function createPatch(type, fields) {
  return {
    type,
    ...fields,
  };
}

function createReplacePatch(path, oldNode, newNode) {
  return createPatch(PATCH_TYPES.REPLACE, {
    path,
    oldNode,
    newNode,
  });
}

function hasAnyKey(children) {
  return children.some((child) => getNodeKey(child) !== null);
}

function findKeyIndex(children, key, startIndex) {
  for (let index = startIndex; index < children.length; index += 1) {
    if (getNodeKey(children[index]) === key) {
      return index;
    }
  }

  return -1;
}

function warnDuplicateKeys(children, parentPath, side) {
  const seen = new Set();
  let hasDuplicate = false;

  for (const child of children) {
    const key = getNodeKey(child);

    if (key === null) {
      continue;
    }

    if (seen.has(key)) {
      console.warn(
        `Duplicate key "${key}" found in ${side} children at ${parentPath}. Falling back to index-based diff.`
      );
      hasDuplicate = true;
      continue;
    }

    seen.add(key);
  }

  return hasDuplicate;
}

function diffProps(oldNode, newNode, path) {
  const oldProps = oldNode.props || {};
  const newProps = newNode.props || {};
  const propKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
  const patches = [];

  for (const key of [...propKeys].sort()) {
    if (key === KEY_PROP) {
      continue;
    }

    if (oldProps[key] === newProps[key]) {
      continue;
    }

    patches.push(
      createPatch(PATCH_TYPES.UPDATE_PROP, {
        path,
        key,
        oldValue: oldProps[key],
        newValue: newProps[key],
      })
    );
  }

  return patches;
}

function diffChildrenByIndex(oldChildren, newChildren, parentPath) {
  const patches = [];
  const workingChildren = [...oldChildren];

  for (let index = 0; index < newChildren.length; index += 1) {
    const childPath = getChildPath(parentPath, index);
    const newChild = newChildren[index];

    if (index >= workingChildren.length) {
      patches.push(
        createPatch(PATCH_TYPES.CREATE, {
          path: childPath,
          node: newChild,
        })
      );
      workingChildren.push(newChild);
      continue;
    }

    patches.push(...diffNode(workingChildren[index], newChild, childPath));
    workingChildren[index] = newChild;
  }

  while (workingChildren.length > newChildren.length) {
    const removeIndex = newChildren.length;

    patches.push(
      createPatch(PATCH_TYPES.REMOVE, {
        path: getChildPath(parentPath, removeIndex),
      })
    );
    workingChildren.splice(removeIndex, 1);
  }

  return patches;
}

function diffChildrenByKey(oldChildren, newChildren, parentPath) {
  const patches = [];
  const workingChildren = [...oldChildren];

  for (let index = 0; index < newChildren.length; index += 1) {
    const childPath = getChildPath(parentPath, index);
    const newChild = newChildren[index];

    if (index >= workingChildren.length) {
      patches.push(
        createPatch(PATCH_TYPES.CREATE, {
          path: childPath,
          node: newChild,
        })
      );
      workingChildren.push(newChild);
      continue;
    }

    const currentChild = workingChildren[index];
    const currentKey = getNodeKey(currentChild);
    const nextKey = getNodeKey(newChild);

    if (currentKey !== null && currentKey === nextKey) {
      patches.push(...diffNode(currentChild, newChild, childPath));
      workingChildren[index] = newChild;
      continue;
    }

    if (nextKey !== null) {
      const matchIndex = findKeyIndex(workingChildren, nextKey, index + 1);

      if (matchIndex !== -1) {
        while (index < workingChildren.length) {
          if (getNodeKey(workingChildren[index]) === nextKey) {
            break;
          }

          patches.push(
            createPatch(PATCH_TYPES.REMOVE, {
              path: childPath,
            })
          );
          workingChildren.splice(index, 1);
        }

        patches.push(...diffNode(workingChildren[index], newChild, childPath));
        workingChildren[index] = newChild;
        continue;
      }
    }

    if (currentKey === null && nextKey === null) {
      patches.push(...diffNode(currentChild, newChild, childPath));
      workingChildren[index] = newChild;
      continue;
    }

    patches.push(createReplacePatch(childPath, currentChild, newChild));
    workingChildren[index] = newChild;
  }

  while (workingChildren.length > newChildren.length) {
    const removeIndex = newChildren.length;

    patches.push(
      createPatch(PATCH_TYPES.REMOVE, {
        path: getChildPath(parentPath, removeIndex),
      })
    );
    workingChildren.splice(removeIndex, 1);
  }

  return patches;
}

function diffChildren(oldChildrenInput, newChildrenInput, parentPath) {
  const oldChildren = (oldChildrenInput || []).map(normalizeVNode);
  const newChildren = (newChildrenInput || []).map(normalizeVNode);

  if (!hasAnyKey(oldChildren) && !hasAnyKey(newChildren)) {
    return diffChildrenByIndex(oldChildren, newChildren, parentPath);
  }

  const hasDuplicateOldKeys = warnDuplicateKeys(oldChildren, parentPath, "old");
  const hasDuplicateNewKeys = warnDuplicateKeys(newChildren, parentPath, "new");

  if (hasDuplicateOldKeys || hasDuplicateNewKeys) {
    return diffChildrenByIndex(oldChildren, newChildren, parentPath);
  }

  return diffChildrenByKey(oldChildren, newChildren, parentPath);
}

function diffNode(oldInput, newInput, path) {
  const oldNode = normalizeVNode(oldInput);
  const newNode = normalizeVNode(newInput);

  if (oldNode == null && newNode == null) {
    return [];
  }

  if (oldNode == null) {
    return [
      createPatch(PATCH_TYPES.CREATE, {
        path,
        node: newNode,
      }),
    ];
  }

  if (newNode == null) {
    return [
      createPatch(PATCH_TYPES.REMOVE, {
        path,
      }),
    ];
  }

  if (
    oldNode.nodeType === VNODE_TYPES.TEXT &&
    newNode.nodeType === VNODE_TYPES.TEXT
  ) {
    if (oldNode.props.nodeValue === newNode.props.nodeValue) {
      return [];
    }

    return [
      createPatch(PATCH_TYPES.UPDATE_TEXT, {
        path,
        oldValue: oldNode.props.nodeValue,
        newValue: newNode.props.nodeValue,
      }),
    ];
  }

  if (
    oldNode.nodeType !== newNode.nodeType ||
    oldNode.type !== newNode.type
  ) {
    return [createReplacePatch(path, oldNode, newNode)];
  }

  return [
    ...diffProps(oldNode, newNode, path),
    ...diffChildren(oldNode.children, newNode.children, path),
  ];
}

export function diff(oldInput, newInput, path = "root") {
  return diffNode(oldInput, newInput, path);
}
