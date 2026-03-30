import { describe, expect, it } from "vitest";

import { App } from "./App.js";

describe("frontend app", () => {
  it("exports the application shell", () => {
    expect(App).toBeTypeOf("function");
  });
});
