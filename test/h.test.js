import test from "node:test";
import assert from "node:assert/strict";

import {
  h,
  createTextVNode,
  VNODE_INTERNAL_TYPES,
  VNODE_TYPES,
} from "../src/index.js";

test("h creates an element vnode", () => {
  const vnode = h("div", { id: "app" }, "hello");

  assert.equal(vnode.nodeType, VNODE_TYPES.ELEMENT);
  assert.equal(vnode.type, "div");
  assert.equal(vnode.props.id, "app");
  assert.equal(vnode.children[0].nodeType, VNODE_TYPES.TEXT);
  assert.equal(vnode.children[0].type, VNODE_INTERNAL_TYPES.TEXT_ELEMENT);
  assert.equal(vnode.children[0].props.nodeValue, "hello");
});

test("h converts number children into TEXT vnodes", () => {
  const vnode = h("span", null, 42);

  assert.equal(vnode.children[0].nodeType, VNODE_TYPES.TEXT);
  assert.equal(vnode.children[0].props.nodeValue, "42");
});

test("h preserves props including key", () => {
  const vnode = h("li", { key: "todo-1", className: "item" }, "A");

  assert.equal(vnode.props.key, "todo-1");
  assert.equal(vnode.props.className, "item");
});

test("h creates a COMPONENT vnode when type is a function", () => {
  function Counter() {
    return h("div", null, "Count");
  }

  const vnode = h(Counter, { count: 1 });

  assert.equal(vnode.nodeType, VNODE_TYPES.COMPONENT);
  assert.equal(vnode.type, Counter);
  assert.equal(vnode.props.count, 1);
});

test("h ignores null and boolean children", () => {
  const vnode = h("div", null, null, false, true, "hello");

  assert.equal(vnode.children.length, 1);
  assert.equal(vnode.children[0].nodeType, VNODE_TYPES.TEXT);
  assert.equal(vnode.children[0].props.nodeValue, "hello");
});

test("createTextVNode creates a TEXT vnode explicitly", () => {
  const vnode = createTextVNode("manual");

  assert.equal(vnode.nodeType, VNODE_TYPES.TEXT);
  assert.equal(vnode.type, VNODE_INTERNAL_TYPES.TEXT_ELEMENT);
  assert.equal(vnode.props.nodeValue, "manual");
  assert.deepEqual(vnode.children, []);
});
