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

    // Generar árbol del repositorio
    const tree = generateTree(finalPath);

    // Limpiar el repositorio según extensiones
    await cleanRepo(finalPath);

    // Convertir archivos a texto
    const archivosEnTexto = await repoFilesToText(finalPath);

    //peticion a API
    const response = await sendRequest(tree, archivosEnTexto);

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
      "config/extensiones_analizar.txt",
      "utf-8"
    );
    const allowedExtensions = extensionsContent
      .split("\n")
      .filter(
        (line) => line.trim() && !line.startsWith("#") && !line.startsWith("!")
      )
      .flatMap((line) => line.split(/\s+/))
      .map((pattern) => {
        const match = pattern.match(/\.(\w+)$/);
        return match ? match[0] : null;
      })
      .filter(Boolean);

    const uniqueExtensions = new Set(allowedExtensions);
    // Carpetas a eliminar completamente
    const foldersToDelete = [
      "vendor", // PHP
      "node_modules", // JS
      "target", // Java/Maven
      "build", // Java/Gradle
      "out", // Java/IntelliJ
      ".gradle", // Gradle cache
      ".m2", // Maven cache
      "storage", // Laravel
      "bootstrap/cache", // Laravel
      "public/build", // Laravel Mix/Vite
      "public/fonts",
      "public/images",
      "public/icons",
      "public/imgs",
      "public/capturas",
      "dist", // JS build
      "coverage", // Test coverage
      ".next", // Next.js
      ".nuxt", // Nuxt.js
    ];
    for (const folder of foldersToDelete) {
      const folderPath = path.join(repoPath, folder);
      if (fs.existsSync(folderPath)) {
        await fs.promises.rm(folderPath, { recursive: true, force: true });
      }
    }
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
          const filesToDelete = [
            "package-lock.json",
            "yarn.lock",
            "pnpm-lock.yaml",
            "composer.lock",
            "vite.config.js",
            "vite.config.ts",
            "webpack.config.js",
            "tailwind.config.js",
            "postcss.config.js",
            "phpunit.xml",
            "jest.config.js",
            "cypress.config.js",
            "pom.xml",
            "build.gradle",
            "build.gradle.kts",
            "settings.gradle",
            "gradlew",
            "gradlew.bat",
            "mvnw",
            "mvnw.cmd",
          ];

          if (filesToDelete.includes(basename)) {
            await fs.promises.rm(fullPath);
          } else if (!ext) {
            if (!allowedNoExt.includes(basename)) {
              await fs.promises.rm(fullPath);
            }
          } else if (!uniqueExtensions.has(ext)) {
            await fs.promises.rm(fullPath);
          }
        }
      }
    }
    await walkAndFilter(repoPath);

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

    return output;
  } catch (error) {
    console.error("Error listing repository structure:", error);
    throw error;
  }
}
