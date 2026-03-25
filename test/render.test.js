import test from "node:test";
import assert from "node:assert/strict";

import { h, render } from "../src/index.js";

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
