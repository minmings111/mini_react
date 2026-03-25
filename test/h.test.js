import test from "node:test";
import assert from "node:assert/strict";

import { h, VNODE_TYPES } from "../src/index.js";

test("h creates an element vnode", () => {
  const vnode = h("div", { id: "app" }, "hello");

  assert.equal(vnode.nodeType, VNODE_TYPES.ELEMENT);
  assert.equal(vnode.type, "div");
  assert.equal(vnode.props.id, "app");
  assert.equal(vnode.children[0].nodeType, VNODE_TYPES.TEXT);
});
