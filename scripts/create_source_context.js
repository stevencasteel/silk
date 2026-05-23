import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const fsp = fs.promises;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const outputFile = path.join(docsDir, 'all_source_code.txt');

function shouldInclude(filePath) {
  const relPath = path.relative(rootDir, filePath).split(path.sep).join('/');
  
  if (
    path.basename(filePath) === 'all_source_code.txt' || 
    path.basename(filePath) === 'source_code_manifest.json' ||
    path.basename(filePath) === 'sourceCodeManifest.ts'
  ) {
    return false;
  }

  const ignoredPaths = ['node_modules', '.git', 'dist', '.vscode', '.github', 'BOX_BATTLE_ARCHIVE'];
  if (ignoredPaths.some(p => relPath.startsWith(p) || relPath.includes(`/${p}/`))) return false;
  
  const boilerplateConfigs = ['.DS_Store', 'package-lock.json', 'tsconfig.tsbuildinfo'];
  if (boilerplateConfigs.includes(path.basename(relPath))) return false;

  const ext = path.extname(relPath);
  const allowedExts = ['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.md', '.txt', '.glsl', '.command'];
  return allowedExts.includes(ext);
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const fileName = path.basename(filePath);
    if (fs.statSync(filePath).isDirectory()) {
      if (!fileName.startsWith('.') && fileName !== 'node_modules' && fileName !== 'dist') {
        getAllFiles(filePath, fileList);
      }
    } else {
      if (shouldInclude(filePath)) fileList.push(filePath);
    }
  }
  return fileList;
}

function generateTree(dir, prefix = '') {
  let output = '';
  const files = fs.readdirSync(dir);
  
  const items = files
    .map(file => {
      const filePath = path.join(dir, file);
      let isDir = false;
      try {
        isDir = fs.statSync(filePath).isDirectory();
      } catch (e) {}
      return { name: file, isDir, path: filePath };
    })
    .filter(item => {
      if (item.name.startsWith('.') && item.name !== '.env') return false;
      return true;
    })
    .sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    
    const skippedDirs = ['node_modules', 'dist', '.git', 'BOX_BATTLE_ARCHIVE'];
    if (item.isDir && skippedDirs.includes(item.name)) {
      output += `${prefix}${branch}${item.name}/ (contents skipped)\n`;
      continue;
    }

    output += `${prefix}${branch}${item.name}${item.isDir ? '/' : ''}\n`;

    if (item.isDir) {
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      output += generateTree(item.path, nextPrefix);
    }
  }
  return output;
}

async function main() {
  try {
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const now = new Date().toLocaleString();
    let content = '┌──────────────────────────────────────────────────┐\n';
    content += '│                    PROJECT SILK                  │\n';
    content += '│               Vite + React + Babylon             │\n';
    content += '└──────────────────────────────────────────────────┘\n';
    content += ` [SYSTEM] Generated: ${now}\n`;
    content += ` [BASELINE]: React 19, TypeScript 6, Babylon.js, Rapier 3D, Tone.js\n\n`;
    
    content += '─── ABRIDGED DIRECTORY STRUCTURE ───────────────────\n';
    content += '.\n';
    content += generateTree(rootDir, '');
    content += '\n\n─── SOURCE FILES ───────────────────────────────────\n\n';

    const files = getAllFiles(rootDir);
    
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const relPath = path.relative(rootDir, filePath).split(path.sep).join('/');
      
      content += `● ./${relPath}\n`;
      content += `────────────────────────────────────────────────────\n`;
      const fileContent = await fsp.readFile(filePath, 'utf8');
      content += fileContent + '\n\n\n';
    }

    await fsp.writeFile(outputFile, content, 'utf8');
    const publicOutputFile = path.join(rootDir, 'public', 'all_source_code.txt');
    await fsp.writeFile(publicOutputFile, content, 'utf8');
    
    console.log('Source context assembled successfully.');
    process.exit(0);

  } catch (err) {
    console.error('Error during context compilation:', err);
    process.exit(1);
  }
}

main();
