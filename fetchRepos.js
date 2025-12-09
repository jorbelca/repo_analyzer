import fs from "fs/promises";
import { extractInfo } from "./extractInfo.js";

export async function fetchReposFromGitHub(username) {
  console.log(`Fetching repositories for user: ${username}`);

  let page = 1;
  const perPage = 100;
  let allRepos = [];

  while (true) {
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=${perPage}&page=${page}`
    );

    if (!response.ok) {
      console.error(
        "GitHub API error:",
        response.status,
        await response.text()
      );
      return;
    }

    const repos = await response.json();
    if (repos.length === 0) break; // no hay más páginas

    allRepos = allRepos.concat(repos);
    page++;
  }

  const repoArray = allRepos.map((repo) => ({
    name: repo.name, // lo que se muestra
    value: repo.html_url, // o repo.html_url, según lo que quieras usar
  }));
  console.log(`Total repos for ${username}: ${repoArray.length}`);
  return repoArray;
}

export async function downloadRepo(repoOwner, repoName) {
  const repoUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/zipball`;
  console.log(repoUrl);

  try {
    const response = await fetch(repoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download repo: ${response.statusText}`);
    }
    const data = await response.blob();
    console.log(`Repository downloaded successfully from: ${repoUrl}`);
    const path = await saveRepoData(repoOwner, repoName, data);
    await extractInfo(path);
    return;
  } catch (error) {
    console.error("Error downloading repository:", error);
    throw error;
  }
}

async function saveRepoData(owner, repoName, data) {
  const path = `./repos/${owner}/${repoName}.zip`;
  try {
    const dirPath = `./repos/${owner}`;
    await fs.mkdir(dirPath, { recursive: true });
    const buffer = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(path, buffer);
    return path;
  } catch (error) {
    console.error("Error saving repository data:", error);
    throw error;
  }
}
