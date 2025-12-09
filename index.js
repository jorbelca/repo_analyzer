import pkg from "enquirer";
const { prompt, MultiSelect } = pkg;
import { downloadRepo, fetchReposFromGitHub } from "./fetchRepos.js";

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
      limit: 10,
      choices: repos,
    });

    const repoSelected = await repoSelect.run();
    console.log("You selected:", repoSelected);
   
    repoSelect.map((repo) => downloadRepo(response.username, repo.name));
    return;
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

main();
