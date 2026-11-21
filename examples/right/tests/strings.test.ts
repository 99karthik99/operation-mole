import { greet } from "../src/utils/strings";

test("greet", () => {
  expect(greet("a")).toBe("Hi there, a!");
});
