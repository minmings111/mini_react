export function setProp(domNode, key, value) {
  if (key === "className") {
    domNode.className = value;
    return;
  }

  if (key === "nodeValue") {
    domNode.nodeValue = value;
    return;
  }

  if (value == null) {
    domNode.removeAttribute(key);
    return;
  }

  domNode.setAttribute(key, value);
}

export function removeProp(domNode, key) {
  if (key === "className") {
    domNode.className = "";
    return;
  }

  if (key === "nodeValue") {
    domNode.nodeValue = "";
    return;
  }

  domNode.removeAttribute(key);
}

export function updateProps(domNode, oldProps = {}, newProps = {}) {
  const keys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

  keys.forEach((key) => {
    if (oldProps[key] === newProps[key]) {
      return;
    }

    if (!(key in newProps)) {
      removeProp(domNode, key);
      return;
    }

    setProp(domNode, key, newProps[key]);
  });
}
