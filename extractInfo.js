import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

export async function extractInfo(zipPath) {
  const finalPath = zipPath.replace(".zip", "");

  try {
    // Limpiar si existe
    if (fs.existsSync(finalPath)) {
      fs.rmSync(finalPath, { recursive: true, force: true });
    }

    const zip = new AdmZip(zipPath);
    const tempPath = `${finalPath}_temp`;
    zip.extractAllTo(tempPath, true);

    // GitHub siempre crea una carpeta con formato: repo-commit
    const entries = fs.readdirSync(tempPath);

    if (entries.length !== 1) {
      throw new Error("Estructura de ZIP inesperada");
    }

    const subFolder = path.join(tempPath, entries[0]);

    // Mover la subcarpeta al destino final
    fs.renameSync(subFolder, finalPath);

    // Eliminar carpeta temporal vacía
    fs.rmSync(tempPath, { recursive: true, force: true });
    // Eliminar el ZIP
    fs.rmSync(zipPath, { force: true });
    console.log(`ZIP eliminado: ${zipPath}`);

    // Generar árbol del repositorio
    const tree = generateTree(finalPath);
    console.log("\n📂 Estructura del repositorio:\n");
    console.log(tree);
    return finalPath;
  } catch (error) {
    // Cleanup
    if (fs.existsSync(finalPath)) {
      fs.rmSync(finalPath, { recursive: true, force: true });
    }
    if (fs.existsSync(`${finalPath}_temp`)) {
      fs.rmSync(`${finalPath}_temp`, { recursive: true, force: true });
    }
    throw error;
  }
}

function generateTree(dirPath, prefix = "", isLast = true) {
  const items = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((item) => !item.name.startsWith(".")) // Ignorar ocultos
    .sort((a, b) => {
      // Directorios primero
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  let tree = "";
  const baseName = path.basename(dirPath);

  if (prefix === "") {
    tree += `${baseName}/\n`;
  }

  items.forEach((item, index) => {
    const isLastItem = index === items.length - 1;
    const connector = isLastItem ? "└── " : "├── ";
    const newPrefix = prefix + (isLastItem ? "    " : "│   ");

    if (item.isDirectory()) {
      tree += `${prefix}${connector}${item.name}/\n`;
      tree += generateTree(
        path.join(dirPath, item.name),
        newPrefix,
        isLastItem
      );
    } else {
      tree += `${prefix}${connector}${item.name}\n`;
    }
  });

  return tree;
}
