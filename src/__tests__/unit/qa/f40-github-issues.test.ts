import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeGithubIssue,
  synchronizeGithubIssueMirror,
  type GithubIssueMirror,
} from "@/lib/admin/qa/github-issues";

const issue: GithubIssueMirror = {
  issueNumber: 1744,
  url: "https://github.com/primeproduction/ech-prime-web-v2/issues/1744",
  title: "A confirmed P1 issue",
  state: "open",
  labels: ["P1"],
  severity: "P1",
  githubUpdatedAt: "2026-08-11T01:00:00.000Z",
};

describe("[TC-F40-05-01] GitHub issue metadata normalization", () => {
  it("classifies only an exact P1 label as critical severity", () => {
    // Arrange
    const base = {
      number: 1744,
      html_url: issue.url,
      title: issue.title,
      state: "open",
      updated_at: issue.githubUpdatedAt,
    };

    // Act
    const exactP1 = normalizeGithubIssue({ ...base, labels: [{ name: "P1" }] });
    const lowerCase = normalizeGithubIssue({ ...base, labels: [{ name: "p1" }] });
    const similar = normalizeGithubIssue({ ...base, labels: [{ name: "P1-blocker" }] });

    // Assert
    expect(exactP1?.severity).toBe("P1");
    expect(lowerCase?.severity).toBe("other");
    expect(similar?.severity).toBe("other");
  });

  it("accepts bounded metadata and rejects malformed GitHub issue payloads", () => {
    // Arrange
    const valid = {
      number: 1744,
      html_url: issue.url,
      title: "x".repeat(600),
      state: "closed",
      updated_at: issue.githubUpdatedAt,
      labels: [{ name: "bug" }, { name: 1 }],
    };

    // Act
    const normalized = normalizeGithubIssue(valid);
    const malformed = normalizeGithubIssue({ ...valid, updated_at: "not-a-date" });

    // Assert
    expect(normalized).toMatchObject({ issueNumber: 1744, state: "closed", labels: ["bug"], severity: "other" });
    expect(normalized?.title).toHaveLength(500);
    expect(malformed).toBeNull();
  });
});

describe("[TC-F40-05-02] GitHub issue mirror upsert", () => {
  const payload = {
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates an existing issue by GitHub number without changing its mapping", async () => {
    // Arrange
    payload.find.mockResolvedValue({ docs: [{ id: 88, targetId: "editor-publish-lifecycle", mappingStatus: "confirmed" }] });
    payload.update.mockResolvedValue({});

    // Act
    await synchronizeGithubIssueMirror(payload as never, issue);

    // Assert
    expect(payload.create).not.toHaveBeenCalled();
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "qa_github_issues",
      id: 88,
      data: expect.objectContaining({ issueNumber: 1744, state: "open" }),
    }));
    expect(payload.update.mock.calls[0][0].data).not.toHaveProperty("mappingStatus");
  });

  it("creates a new issue with an explicitly safe unknown mapping", async () => {
    // Arrange
    payload.find.mockResolvedValue({ docs: [] });
    payload.create.mockResolvedValue({ id: 88 });

    // Act
    await synchronizeGithubIssueMirror(payload as never, issue);

    // Assert
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "qa_github_issues",
      data: expect.objectContaining({ mappingStatus: "unknown", mappingHistory: [] }),
    }));
    expect(payload.update).not.toHaveBeenCalled();
  });

  it("reconciles a concurrent create by updating the winning mirror", async () => {
    // Arrange
    payload.find
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [{ id: 99 }] });
    payload.create.mockRejectedValue(new Error("unique constraint"));
    payload.update.mockResolvedValue({});

    // Act
    await synchronizeGithubIssueMirror(payload as never, { ...issue, state: "closed" });

    // Assert
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      id: 99,
      data: expect.objectContaining({ state: "closed" }),
    }));
  });

  it("does not let an older GitHub response reopen a newer closed mirror", async () => {
    // Arrange
    payload.find.mockResolvedValue({ docs: [{ id: 88, githubUpdatedAt: "2026-08-12T01:00:00.000Z" }] });

    // Act
    await synchronizeGithubIssueMirror(payload as never, { ...issue, state: "open", githubUpdatedAt: "2026-08-11T01:00:00.000Z" });

    // Assert
    expect(payload.update).not.toHaveBeenCalled();
    expect(payload.create).not.toHaveBeenCalled();
  });

  it("does not overwrite a newer winner after a concurrent create race", async () => {
    // Arrange
    payload.find.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [{ id: 99, githubUpdatedAt: "2026-08-12T01:00:00.000Z" }] });
    payload.create.mockRejectedValue(new Error("unique constraint"));

    // Act
    await synchronizeGithubIssueMirror(payload as never, { ...issue, githubUpdatedAt: "2026-08-11T01:00:00.000Z" });

    // Assert
    expect(payload.update).not.toHaveBeenCalled();
  });
});
