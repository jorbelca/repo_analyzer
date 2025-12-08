const { prompt, MultiSelect } = require("enquirer");

async function main() {
  try {
    const response = await prompt([
      {
        type: "input",
        name: "username",
        message: "Enter your Github username:",
      },
    ]);
    const repos = await fetchReposFromGitHub(response.username);

    const repoSelect = new MultiSelect({
      name: "value",
      message: "Pick your repos to analyze:",
      limit: 7,
      choices: repos,
    });

    const repoSelected = await repoSelect.run();
    console.log("You selected:", repoSelected);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function fetchReposFromGitHub(username) {
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

main();
