import { describe, expect, it } from "vitest";
import { cleanDraft, copyName, filterSuppliers, productsBySupplier, sortSuppliers, telHref, validateDraft } from "./fournisseurs.logic";

const sups = [
  { id: "a", name: "Viandex", contact: "418 555-1234" },
  { id: "b", name: "Costco entreprises", email: "info@costco.ca" },
  { id: "c", name: "épicerie Latina", notes: "livraison mardi" },
];
const prods = [
  { id: "p1", name: "Poulet", supplierId: "a" },
  { id: "p2", name: "Boeuf haché", supplierId: "a" },
  { id: "p3", name: "Vieux produit", supplierId: "a", archived: true },
  { id: "p4", name: "Riz", supplierId: "b" },
];

describe("fournisseurs", () => {
  it("trie en ordre alphabétique français (accents ignorés)", () => {
    expect(sortSuppliers(sups).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });
  it("ignore les produits archivés", () => {
    const m = productsBySupplier(prods);
    expect(m.get("a")!.map((p) => p.name)).toEqual(["Boeuf haché", "Poulet"]);
  });
  it("cherche sans accents, y compris dans les produits liés", () => {
    const m = productsBySupplier(prods);
    expect(filterSuppliers(sups, "EPICERIE", m).map((s) => s.id)).toEqual(["c"]);
    expect(filterSuppliers(sups, "boeuf", m).map((s) => s.id)).toEqual(["a"]);
    expect(filterSuppliers(sups, "mardi", m).map((s) => s.id)).toEqual(["c"]);
  });
  it("valide le nom (obligatoire, unique) et le courriel", () => {
    expect(validateDraft({ name: " ", contact: "", email: "", notes: "" }, sups).name).toBeTruthy();
    expect(validateDraft({ name: "viandex", contact: "", email: "", notes: "" }, sups).name).toMatch(/déjà/);
    expect(validateDraft({ name: "Viandex", contact: "", email: "", notes: "" }, sups, "a")).toEqual({});
    expect(validateDraft({ name: "X", contact: "", email: "pas-un-courriel", notes: "" }, sups).email).toBeTruthy();
  });
  it("nettoie les champs", () => {
    expect(cleanDraft({ name: " A ", contact: " 1 ", email: " A@B.CA ", notes: " n " })).toEqual({
      name: "A",
      contact: "1",
      email: "a@b.ca",
      notes: "n",
    });
  });
  it("crée un lien téléphone utilisable", () => {
    expect(telHref("418 555-1234 poste 2")).toBe("tel:4185551234");
    expect(telHref("Jean")).toBeNull();
  });
  it("nomme les copies sans doublon", () => {
    expect(copyName("Viandex", sups)).toBe("Viandex (copie)");
    expect(copyName("Viandex", [...sups, { id: "d", name: "Viandex (copie)" }])).toBe("Viandex (copie 2)");
  });
});
