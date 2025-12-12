import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { sendRequest } from "./sendRequest.js";

export async function extractInfo(zipPath) {
  const finalPath = zipPath.replace(".zip", "");

  try {
    // Limpiar si ya existe el mismo fichero
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
    // Limpiar el repositorio según extensiones
    await cleanRepo(finalPath);
    console.log(`Repositorio limpio en: ${finalPath}`);

    // Convertir archivos a texto
    const archivosEnTexto = await repoFilesToText(finalPath);

    //peticion a API
    const response = await sendRequest(tree, archivosEnTexto);
    console.log("Respuesta de la API:", response);

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

async function cleanRepo(repoPath) {
  try {
    const extensionsContent = await fs.promises.readFile(
      "extensiones_analizar.txt",
      "utf-8"
    );
    const allowedExtensions = extensionsContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .flatMap((line) => line.split(/\s+/))
      .filter((pattern) => !pattern.startsWith("!"))
      .map((pattern) => {
        const match = pattern.match(/\.(\w+)$/);
        return match ? match[0] : null;
      })
      .filter(Boolean);

    const uniqueExtensions = new Set(allowedExtensions);
    console.log("Manteniendo SOLO extensiones:", [...uniqueExtensions]);

    async function walkAndFilter(currentPath) {
      const entries = await fs.promises.readdir(currentPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await walkAndFilter(fullPath);
          // eliminar carpeta si queda vacía
          const remaining = await fs.promises.readdir(fullPath);
          if (remaining.length === 0) {
            await fs.promises.rmdir(fullPath);
          }
        } else {
          const ext = path.extname(entry.name);
          const basename = path.basename(entry.name);

          // Lista de archivos sin extensión permitidos
          const allowedNoExt = ["Dockerfile", "Makefile", "Jenkinsfile"];

          if (!ext) {
            // Si no tiene extensión, solo mantener si está en allowedNoExt
            if (!allowedNoExt.includes(basename)) {
              await fs.promises.rm(fullPath);
              console.log(`🗑️  Borrado: ${fullPath}`);
            }
          } else if (!uniqueExtensions.has(ext)) {
            // Si tiene extensión pero no está permitida
            await fs.promises.rm(fullPath);
            console.log(`🗑️  Borrado: ${fullPath}`);
          }
        }
      }
    }
    await walkAndFilter(repoPath);
    console.log("Limpieza por extensiones completada.");
    return repoPath;
  } catch (error) {
    console.error("Error cleaning repository:", error);
    throw error;
  }
}

async function repoFilesToText(repoPath) {
  try {
    let output = "";

    async function walkAndRead(currentPath, relativePath = "") {
      const entries = await fs.promises.readdir(currentPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relPath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;

        if (entry.isDirectory()) {
          await walkAndRead(fullPath, relPath);
        } else {
          try {
            const content = await fs.promises.readFile(fullPath, "utf-8");
            output += `${relPath}:[${content}]\n\n`;
          } catch (error) {
            // Si no se puede leer como texto (ej: binarios), lo saltamos
            console.warn(`⚠️  No se pudo leer: ${relPath}`);
          }
        }
      }
    }

    await walkAndRead(repoPath);

    // Guardar en archivo de texto
    const outputPath = `${repoPath}_content.txt`;
    await fs.promises.writeFile(outputPath, output, "utf-8");
    console.log(`📄 Contenido del repo guardado en: ${outputPath}`);

    return output;
  } catch (error) {
    console.error("Error listing repository structure:", error);
    throw error;
  }
}
