import test from "node:test";
import assert from "node:assert/strict";

import { h, diff, PATCH_TYPES } from "../src/index.js";

test("diff returns UPDATE_TEXT for changed text node", () => {
  const oldNode = h("div", null, "A");
  const newNode = h("div", null, "B");

  const patches = diff(oldNode, newNode);

  assert.equal(patches[0].type, PATCH_TYPES.UPDATE_TEXT);
});
