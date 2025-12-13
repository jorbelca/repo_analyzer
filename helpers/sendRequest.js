import fs from "fs";

process.loadEnvFile();

export async function generateQuery(tree, archivosEnTexto) {
  try {
    const factores = fs.readFileSync("config/factores_analisis.json", "utf-8");
    const factoresAnalisis = JSON.parse(factores);
    // Extraer query y el resto de factores
    const { query, ...factoresRestantes } = factoresAnalisis;

    return `${query}\n\n===CODE QUALITY FACTORS===\n${JSON.stringify(
      factoresRestantes,
      null,
      2
    )}\n\n===PROJECT STRUCTURE===\n${tree}\n\n===FILE CONTENT===\n${archivosEnTexto}`;
  } catch (error) {
    console.error("Error generating query:", error);
    throw error;
  }
}

export async function sendRequest(tree, archivosEnTexto) {
  try {
    const texto = await generateQuery(tree, archivosEnTexto);

    fs.writeFileSync("final_query.txt", texto, "utf-8");

    const endpoint = process.env.OPEN_AI_API_ENDPOINT;
    if (!endpoint) throw new Error("OPEN_AI_API_ENDPOINT no está definido");
    const model = process.env.OPEN_AI_MODEL;
    if (!model) throw new Error("OPEN_AI_MODEL no está definido");
    const apiKey = process.env.OPEN_AI_API_KEY;
    if (!apiKey) throw new Error("OPEN_AI_API_KEY no está definido");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        input: texto,
      }),
    });

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "(no error)");
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const answer =
      result?.output?.[0]?.content?.[0]?.text ??
      result?.output?.[0]?.content ??
      result?.text ??
      JSON.stringify(result);

    //console.log("\n📨 Respuesta de OpenAI:\n", answer);
    console.log(`\n📊 Tokens used: ${result?.usage?.total_tokens ?? "N/A"}`);

    const firstLine = tree.split("\n")[0];
    const repoName = firstLine?.replace(/\/$/, "").trim() || "unknown_repo";

    // Crear directorio results si no existe
    if (!fs.existsSync("results")) {
      fs.mkdirSync("results");
    }

    // 👇 Guardar con nombre significativo
    const outputFile = `results/${repoName}_analysis.txt`;
    fs.writeFileSync(outputFile, answer, "utf-8");

    console.log(`Analysis saved in: ${outputFile}`);
    return answer;
  } catch (error) {
    console.error("Error sending request:", error);
    throw error;
  }
}
