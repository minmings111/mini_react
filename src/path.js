export function getPathIndexes(path) {
  if (path === "root") {
    return [];
  }

  return [...path.matchAll(/children\[(\d+)\]/g)].map((match) =>
    Number(match[1])
  );
}

export function getNodeByPath(rootNode, path) {
  if (path === "root") {
    return rootNode;
  }

  const indexes = getPathIndexes(path);
  let node = rootNode;

  for (const index of indexes) {
    if (!node?.childNodes || node.childNodes[index] == null) {
      throw new Error(`Cannot resolve DOM node for path: ${path}`);
    }

    node = node.childNodes[index];
  }

  return node;
}

export function getParentPath(path) {
  if (path === "root") {
    return null;
  }

  return path.replace(/\.children\[\d+\]$/, "");
}

export function getChildIndex(path) {
  const indexes = getPathIndexes(path);

  if (indexes.length === 0) {
    return null;
  }

  return indexes[indexes.length - 1];
}
