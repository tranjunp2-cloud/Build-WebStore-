import type { PortfolioProject } from "./config";

export type ResolvedPortfolioProject = PortfolioProject & { imageUrl: string };

export function resolvePortfolioProjects(
  rawProjects: PortfolioProject[],
  fallbackUrls: string[],
): ResolvedPortfolioProject[] {
  const sourceProjects =
    rawProjects.length > 0
      ? rawProjects
      : fallbackUrls.map(() => ({ title: "", description: "", category: "" }));

  return sourceProjects.map((project, index) => {
    const imageUrl =
      project.image?.url ||
      project.imageUrl ||
      fallbackUrls[index % fallbackUrls.length] ||
      fallbackUrls[0] ||
      "";

    return { ...project, imageUrl };
  });
}
