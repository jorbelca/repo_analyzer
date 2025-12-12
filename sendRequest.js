import fs from "fs";

export async function generateQuery(tree, archivosEnTexto) {
  try {
    const factores = fs.readFileSync("factores_analisis.json", "utf-8");
    const factoresAnalisis = JSON.parse(factores);
    // Extraer query y el resto de factores
    const { query, ...factoresRestantes } = factoresAnalisis;

    return `${query}\n\n===CODE QUALITY FACTORS===\n${JSON.stringify(
        factoresRestantes,
        null,
        2
      )}\n\n===PROJECT STRUCTURE===\n${tree}\n\n===FILE CONTENT===\n${archivosEnTexto}`
    
  } catch (error) {
    console.error("Error generating query:", error);
    throw error;
  }
}

export async function sendRequest(tree, archivosEnTexto) {
  try {
   

    const texto = await generateQuery(tree, archivosEnTexto);

    return fs.writeFileSync("final_query.txt", texto, "utf-8");

    const response = await fetch("API_ENDPOINT", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(texto),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error sending request:", error);
    throw error;
  }
}
