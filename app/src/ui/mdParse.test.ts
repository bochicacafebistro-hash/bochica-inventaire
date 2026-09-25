import { describe, expect, it } from "vitest";
import { autoList, parseInline, parseMarkdown } from "./mdParse";

describe("markdown léger", () => {
  it("gras, italique, barré", () => {
    expect(parseInline("a **b** *c* ~~d~~")).toEqual([
      { t: "text", v: "a " },
      { t: "b", v: "b" },
      { t: "text", v: " " },
      { t: "i", v: "c" },
      { t: "text", v: " " },
      { t: "s", v: "d" },
    ]);
  });
  it("listes et paragraphes", () => {
    const b = parseMarkdown("Intro\n- un\n- deux\n\n1. a\n2. b");
    expect(b.map((x) => x.kind)).toEqual(["p", "ul", "ol"]);
  });
  it("le HTML reste du texte", () => {
    expect(parseInline("<script>x</script>")).toEqual([{ t: "text", v: "<script>x</script>" }]);
  });
  it("texte ancien sans marques → liste", () => {
    expect(autoList("farine\nœufs", "bullet")).toBe("- farine\n- œufs");
    expect(autoList("- déjà", "bullet")).toBe("- déjà");
  });
});
