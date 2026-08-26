import { describe, expect, it } from "vitest";
import { resolvePortfolioProjects } from "@/blocks/portfolio-grid/resolve-projects";

describe("resolvePortfolioProjects", () => {
  it("preserves the exact source project count when projects exist", () => {
    const projects = resolvePortfolioProjects(
      [
        {
          title: "Vegetables",
          description: "",
          category: "Vegetables",
          imageUrl: "/vegetables.jpg",
        },
        {
          title: "Fruits",
          description: "",
          category: "Fruits",
          imageUrl: "/fruits.jpg",
        },
        {
          title: "Food",
          description: "",
          category: "Food",
          imageUrl: "/food.jpg",
        },
      ],
      [
        "/fallback-1.jpg",
        "/fallback-2.jpg",
        "/fallback-3.jpg",
        "/fallback-4.jpg",
      ],
    );

    expect(projects).toHaveLength(3);
    expect(projects.map((project) => project.title)).toEqual([
      "Vegetables",
      "Fruits",
      "Food",
    ]);
  });

  it("uses fallback images only for missing media without adding projects", () => {
    const projects = resolvePortfolioProjects(
      [{ title: "Vegetables", description: "", category: "Vegetables" }],
      ["/fallback.jpg"],
    );

    expect(projects).toEqual([
      {
        title: "Vegetables",
        description: "",
        category: "Vegetables",
        imageUrl: "/fallback.jpg",
      },
    ]);
  });

  it("creates fallback slots only when no source projects exist", () => {
    const projects = resolvePortfolioProjects([], ["/one.jpg", "/two.jpg"]);

    expect(projects).toHaveLength(2);
    expect(projects.map((project) => project.imageUrl)).toEqual([
      "/one.jpg",
      "/two.jpg",
    ]);
  });
});
