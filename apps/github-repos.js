(function () {
  const GITHUB_USER = "sanjinpepic";
  const API_URL = `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`;

  function repoToProject(repo, index) {
    const hasHomepage = repo.homepage && repo.homepage.trim() !== "";
    const url = hasHomepage
      ? repo.homepage.trim()
      : `apps/github-view.html?repo=${encodeURIComponent(repo.name)}`;
    const openLabel = hasHomepage ? "Open in new tab" : "View on GitHub";

    return {
      id: `gh-${repo.name}`,
      order: 100 + index,
      title: repo.name
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      browserTitle: repo.name,
      url,
      description: repo.description,
      role: "Author",
      stack: repo.language ? [repo.language] : [],
      openInNewTabLabel: openLabel,
      isGithubSource: true,
      githubUrl: repo.html_url,
    };
  }

  function shouldInclude(repo) {
    if (repo.fork) return false;
    if (repo.name === "portfolio") return false;
    if (!repo.description || repo.description.trim() === "") return false;
    return true;
  }

  async function fetchAndMerge() {
    if (typeof window.addGithubRepos !== "function") return;
    const loadingEl = document.getElementById("github-loading");
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        console.warn(`[github-repos] API responded ${response.status}. Skipping GitHub repos.`);
        return;
      }
      const repos = await response.json();
      const projects = repos.filter(shouldInclude).map(repoToProject);
      if (projects.length > 0) window.addGithubRepos(projects);
    } catch (err) {
      console.warn("[github-repos] Failed to load GitHub repos:", err.message);
    } finally {
      if (loadingEl) loadingEl.remove();
    }
  }

  fetchAndMerge();
})();
