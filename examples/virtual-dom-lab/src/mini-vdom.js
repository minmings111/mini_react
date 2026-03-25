const INTERNAL_ATTR_PREFIX = "data-lab-";
const INTERNAL_ATTRS = new Set(["contenteditable", "spellcheck"]);

function isIgnorableAttr(name) {
  const lower = name.toLowerCase();
  return lower.startsWith(INTERNAL_ATTR_PREFIX) || INTERNAL_ATTRS.has(lower);
}

function cloneAttrs(attrs = {}) {
  return Object.keys(attrs).reduce((next, key) => {
    next[key] = attrs[key];
    return next;
  }, {});
}

export function cloneVNode(vnode) {
  if (!vnode) return null;
  if (vnode.kind === "text") {
    return { kind: "text", text: vnode.text };
  }

  return {
    kind: "element",
    tagName: vnode.tagName,
    attrs: cloneAttrs(vnode.attrs),
    children: (vnode.children || []).map(cloneVNode),
  };
}

export function domToVNode(node) {
  if (!node) return null;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text.trim()) return null;
    return {
      kind: "text",
      text,
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const attrs = {};
  const attrNames = node.getAttributeNames().sort();
  for (const name of attrNames) {
    if (isIgnorableAttr(name)) continue;
    attrs[name] = node.getAttribute(name) ?? "";
  }

  const children = [];
  for (const childNode of node.childNodes) {
    const childVNode = domToVNode(childNode);
    if (childVNode) children.push(childVNode);
  }

  return {
    kind: "element",
    tagName: node.tagName.toLowerCase(),
    attrs,
    children,
  };
}

export function createDomFromVNode(vnode, doc = document) {
  if (!vnode) return null;

  if (vnode.kind === "text") {
    return doc.createTextNode(vnode.text);
  }

  const element = doc.createElement(vnode.tagName);
  const attrs = vnode.attrs || {};
  for (const [name, value] of Object.entries(attrs)) {
    element.setAttribute(name, value);
  }

  for (const child of vnode.children || []) {
    const childNode = createDomFromVNode(child, doc);
    if (childNode) element.appendChild(childNode);
  }

  return element;
}

function diffAttrs(oldAttrs = {}, newAttrs = {}) {
  const set = {};
  const remove = [];
  const seenKeys = new Set([...Object.keys(oldAttrs), ...Object.keys(newAttrs)]);

  for (const key of seenKeys) {
    if (!(key in newAttrs)) {
      remove.push(key);
      continue;
    }
    if (!(key in oldAttrs) || oldAttrs[key] !== newAttrs[key]) {
      set[key] = newAttrs[key];
    }
  }

  return {
    set,
    remove,
  };
}

export function diff(oldVNode, newVNode, path = []) {
  const patches = [];

  if (!oldVNode && !newVNode) {
    return patches;
  }

  if (!oldVNode && newVNode) {
    if (path.length === 0) {
      patches.push({
        type: "REPLACE",
        path: [],
        node: cloneVNode(newVNode),
      });
      return patches;
    }

    patches.push({
      type: "CREATE",
      path: path.slice(0, -1),
      index: path[path.length - 1],
      node: cloneVNode(newVNode),
    });
    return patches;
  }

  if (oldVNode && !newVNode) {
    patches.push({
      type: "REMOVE",
      path: [...path],
    });
    return patches;
  }

  if (oldVNode.kind !== newVNode.kind) {
    patches.push({
      type: "REPLACE",
      path: [...path],
      node: cloneVNode(newVNode),
    });
    return patches;
  }

  if (oldVNode.kind === "text" && newVNode.kind === "text") {
    if (oldVNode.text !== newVNode.text) {
      patches.push({
        type: "TEXT",
        path: [...path],
        value: newVNode.text,
      });
    }
    return patches;
  }

  if (oldVNode.tagName !== newVNode.tagName) {
    patches.push({
      type: "REPLACE",
      path: [...path],
      node: cloneVNode(newVNode),
    });
    return patches;
  }

  const attrChanges = diffAttrs(oldVNode.attrs, newVNode.attrs);
  if (Object.keys(attrChanges.set).length || attrChanges.remove.length) {
    patches.push({
      type: "ATTRS",
      path: [...path],
      set: attrChanges.set,
      remove: attrChanges.remove,
    });
  }

  const oldChildren = oldVNode.children || [];
  const newChildren = newVNode.children || [];
  const maxChildren = Math.max(oldChildren.length, newChildren.length);

  for (let index = 0; index < maxChildren; index += 1) {
    const childPath = [...path, index];

    if (index >= oldChildren.length) {
      patches.push({
        type: "CREATE",
        path: [...path],
        index,
        node: cloneVNode(newChildren[index]),
      });
      continue;
    }

    if (index >= newChildren.length) {
      patches.push({
        type: "REMOVE",
        path: childPath,
      });
      continue;
    }

    patches.push(...diff(oldChildren[index], newChildren[index], childPath));
  }

  return patches;
}

function comparePathsDescending(left, right) {
  const leftPath = left.path || [];
  const rightPath = right.path || [];

  if (leftPath.length !== rightPath.length) {
    return rightPath.length - leftPath.length;
  }

  for (let index = 0; index < Math.max(leftPath.length, rightPath.length); index += 1) {
    const leftValue = leftPath[index] ?? -1;
    const rightValue = rightPath[index] ?? -1;
    if (leftValue !== rightValue) {
      return rightValue - leftValue;
    }
  }

  return 0;
}

function compareCreates(left, right) {
  const leftPath = left.path || [];
  const rightPath = right.path || [];

  if (leftPath.length !== rightPath.length) {
    return leftPath.length - rightPath.length;
  }

  for (let index = 0; index < Math.max(leftPath.length, rightPath.length); index += 1) {
    const leftValue = leftPath[index] ?? -1;
    const rightValue = rightPath[index] ?? -1;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return left.index - right.index;
}

function getNodeByPath(rootNode, path) {
  let current = rootNode;
  for (const index of path) {
    if (!current || !current.childNodes || !current.childNodes[index]) {
      return null;
    }
    current = current.childNodes[index];
  }
  return current;
}

function pushTouchedNode(touchedNodes, touchedSet, node) {
  if (!node) return;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!element || touchedSet.has(element)) return;
  touchedSet.add(element);
  touchedNodes.push(element);
}

export function applyPatches(rootEl, patches) {
  let currentRoot = rootEl;
  const operations = [];
  const touchedNodes = [];
  const touchedSet = new Set();

  const mutationPatches = patches.filter((patch) => patch.type !== "CREATE").sort(comparePathsDescending);
  const createPatches = patches.filter((patch) => patch.type === "CREATE").sort(compareCreates);

  for (const patch of mutationPatches) {
    if (!currentRoot && patch.path.length !== 0) continue;

    if (patch.type === "REMOVE") {
      const target = getNodeByPath(currentRoot, patch.path);
      if (!target) continue;
      pushTouchedNode(touchedNodes, touchedSet, target);
      operations.push({
        api: "remove",
        path: [...patch.path],
        detail: `path ${JSON.stringify(patch.path)} 노드를 제거했습니다.`,
      });
      if (patch.path.length === 0) {
        target.remove();
        currentRoot = null;
      } else {
        target.remove();
      }
      continue;
    }

    if (patch.type === "REPLACE") {
      const target = patch.path.length === 0 ? currentRoot : getNodeByPath(currentRoot, patch.path);
      if (!target) continue;
      const nextNode = createDomFromVNode(patch.node, target.ownerDocument);
      if (!nextNode) continue;
      pushTouchedNode(touchedNodes, touchedSet, target);
      pushTouchedNode(touchedNodes, touchedSet, nextNode);
      operations.push({
        api: "replaceWith",
        path: [...patch.path],
        detail: `path ${JSON.stringify(patch.path)} 노드를 <${patch.node.tagName || "text"}>로 교체했습니다.`,
      });
      target.replaceWith(nextNode);
      if (patch.path.length === 0) {
        currentRoot = nextNode;
      }
      continue;
    }

    if (patch.type === "TEXT") {
      const target = getNodeByPath(currentRoot, patch.path);
      if (!target) continue;
      target.textContent = patch.value;
      pushTouchedNode(touchedNodes, touchedSet, target);
      operations.push({
        api: "textContent",
        path: [...patch.path],
        detail: `path ${JSON.stringify(patch.path)} 텍스트를 ${JSON.stringify(patch.value)}로 바꿨습니다.`,
      });
      continue;
    }

    if (patch.type === "ATTRS") {
      const target = getNodeByPath(currentRoot, patch.path);
      if (!target || target.nodeType !== Node.ELEMENT_NODE) continue;
      const applied = [];
      for (const [name, value] of Object.entries(patch.set)) {
        target.setAttribute(name, value);
        applied.push(`${name}="${value}"`);
      }
      for (const name of patch.remove) {
        target.removeAttribute(name);
        applied.push(`${name} removed`);
      }
      pushTouchedNode(touchedNodes, touchedSet, target);
      operations.push({
        api: "setAttribute",
        path: [...patch.path],
        detail: `path ${JSON.stringify(patch.path)} 속성 변경: ${applied.join(", ") || "none"}`,
      });
    }
  }

  for (const patch of createPatches) {
    const parentNode = patch.path.length === 0 ? currentRoot : getNodeByPath(currentRoot, patch.path);
    if (!parentNode) continue;
    const nextNode = createDomFromVNode(patch.node, parentNode.ownerDocument);
    if (!nextNode) continue;
    const referenceNode = parentNode.childNodes[patch.index] ?? null;
    parentNode.insertBefore(nextNode, referenceNode);
    pushTouchedNode(touchedNodes, touchedSet, parentNode);
    pushTouchedNode(touchedNodes, touchedSet, nextNode);
    operations.push({
      api: "createElement",
      path: [...patch.path, patch.index],
      detail: `path ${JSON.stringify(patch.path)} 아래 index ${patch.index}에 <${patch.node.tagName || "text"}>를 생성했습니다.`,
    });
  }

  return {
    root: currentRoot,
    operations,
    touchedNodes,
  };
}
