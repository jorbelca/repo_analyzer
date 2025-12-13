process.removeAllListeners("warning");
import pkg from "enquirer";
const { prompt, MultiSelect } = pkg;
import { downloadRepo, fetchReposFromGitHub } from "./helpers/fetchRepos.js";
import ora from "ora";
import fs from "fs";

async function cleanupAfterProcessing() {
  try {
    // Eliminar carpeta repos
    if (fs.existsSync("repos")) {
      fs.rmSync("repos", { recursive: true, force: true });
    }

    // Eliminar final_query.txt
    if (fs.existsSync("final_query.txt")) {
      fs.rmSync("final_query.txt", { force: true });
    }
  } catch (error) {
    console.error("⚠️  Error durante la limpieza:", error.message);
  }
}

async function main() {
  try {
    const response = await prompt([
      {
        type: "input",
        name: "username",
        message: "Enter your Github username:",
      },
    ]);

    const fetchSpinner = ora("Fetching repositories...").start();
    const repos = await fetchReposFromGitHub(response.username);
    fetchSpinner.succeed(`Found ${repos.length} repositories`);

    const repoSelect = new MultiSelect({
      name: "value",
      message: "Pick your repos to analyze:",
      limit: 10,
      choices: repos,
    });

    const repoSelected = await repoSelect.run();
    console.log(`\n✅ Selected ${repoSelected.length} repositories\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < repoSelected.length; i++) {
      const repoName = repoSelected[i];
      const progress = `[${i + 1}/${repoSelected.length}]`;

      const repoSpinner = ora(`${progress} Processing ${repoName}...`).start();

      try {
        await downloadRepo(response.username, repoName);
        repoSpinner.succeed(`${progress} ${repoName} completed`);
        successCount++;
      } catch (error) {
        repoSpinner.fail(`${progress} ${repoName} failed: ${error.message}`);
        failCount++;
      }
    }

    console.log("\n═══════════════════════════════════════════════════════");
    console.log(`✅ Completed: ${successCount} | ❌ Failed: ${failCount}`);
    console.log("═══════════════════════════════════════════════════════\n");

    // Limpiar archivos temporales solo si todo fue exitoso
    if (failCount === 0) {
      await cleanupAfterProcessing();
      console.log("\n🎉 All repositories processed successfully!");
    } else {
      console.log(
        "\n⚠️  Some repositories failed. Temporary files preserved for debugging."
      );
    }

    return;
  } catch (error) {
    console.error("❌ An error occurred:", error);
  }
}

main();
