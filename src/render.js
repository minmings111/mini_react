import { diff } from "./diff.js";
import { commitPatches } from "./commit.js";

const roots = new WeakMap();

export function render(nextVNode, container) {
  const previousState = roots.get(container) || {
    currentVNode: null,
    rootDomNode: null,
  };

  const patches = diff(previousState.currentVNode, nextVNode);
  const rootDomNode = commitPatches(
    previousState.rootDomNode,
    patches,
    container
  );

  roots.set(container, {
    currentVNode: nextVNode,
    rootDomNode,
  });

  return {
    oldVNode: previousState.currentVNode,
    newVNode: nextVNode,
    patches,
    rootDomNode,
  };
}
