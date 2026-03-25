export function getNodeByPath(rootNode, path) {
  if (path === "root") {
    return rootNode;
  }

  const indexes = [...path.matchAll(/children\[(\d+)\]/g)].map((match) =>
    Number(match[1])
  );

  let node = rootNode;

  for (const index of indexes) {
    node = node.childNodes[index];
  }

  return node;
}

export function getParentPath(path) {
  return path.replace(/\.children\[\d+\]$/, "");
}
