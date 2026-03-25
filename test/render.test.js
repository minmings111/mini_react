import test from "node:test";
import assert from "node:assert/strict";

import { applyPatch, h, PATCH_TYPES, render } from "../src/index.js";

test("render returns patches array", () => {
  const container = {
    appendChild(node) {
      this.node = node;
    },
    replaceChild(node) {
      this.node = node;
    },
  };

  global.document = {
    createElement(tag) {
      return {
        tag,
        childNodes: [],
        appendChild(node) {
          this.childNodes.push(node);
        },
        setAttribute() {},
      };
    },
    createTextNode(value) {
      return { nodeValue: value };
    },
  };

  const result = render(h("div", null, "hello"), container);

  assert.ok(Array.isArray(result.patches));
});

test("applyPatch removes className when UPDATE_PROP sets newValue to undefined", () => {
  const rootNode = {
    className: "card",
    removeAttributeCalls: [],
    removeAttribute(name) {
      this.removeAttributeCalls.push(name);
    },
    setAttribute() {},
  };

  const result = applyPatch(
    rootNode,
    {
      type: PATCH_TYPES.UPDATE_PROP,
      path: "root",
      key: "className",
      oldValue: "card",
      newValue: undefined,
    },
    {}
  );

  assert.equal(result, rootNode);
  assert.equal(rootNode.className, "");
});
