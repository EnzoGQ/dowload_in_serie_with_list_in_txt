const fs = require('fs');
const path = require('path');
const { http, https } = require('follow-redirects');

const listaPath = path.join(__dirname, 'dowload.txt');
const downloadFolder = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadFolder)) fs.mkdirSync(downloadFolder);

const urls = fs.readFileSync(listaPath, 'utf-8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.startsWith('http://') || l.startsWith('https://'));

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

function downloadFile(url, attempt = 1) {
  return new Promise((resolve) => {
    const fileName = path.basename(url);
    const filePath = path.join(downloadFolder, fileName);

    if (fs.existsSync(filePath)) {
      console.log(`⏭️  Já existe: ${fileName}`);
      return resolve();
    }

    const file = fs.createWriteStream(filePath);
    const client = url.startsWith('https') ? https : http;

    console.log(`📥 Baixando: ${fileName} (Tentativa ${attempt})`);

    client.get(url, (response) => {
      if (response.statusCode === 200) {
        const total = parseInt(response.headers['content-length'], 10);
        let downloaded = 0;

        response.on('data', (chunk) => {
          downloaded += chunk.length;
          if (total) {
            const percent = ((downloaded / total) * 100).toFixed(2);
            process.stdout.write(`\r📊 ${fileName}: ${percent}%`);
          }
        });

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`\r✔️  Concluído: ${fileName}                    `); // sobrescreve a linha anterior
          resolve();
        });
      } else if (response.statusCode === 503 && attempt < MAX_RETRIES) {
        console.warn(`⚠️  Erro 503 em ${fileName}, tentando novamente em ${RETRY_DELAY_MS / 1000}s...`);
        file.close();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        setTimeout(() => resolve(downloadFile(url, attempt + 1)), RETRY_DELAY_MS);
      } else {
        console.error(`❌ Erro ao baixar ${fileName} - Status: ${response.statusCode}`);
        file.close();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        resolve();
      }
    }).on('error', (err) => {
      console.error(`❌ Erro ao baixar ${fileName}: ${err.message}`);
      file.close();
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      resolve();
    });
  });
}

// Executa downloads 1 por 1
async function baixarTodosSequencialmente() {
  for (const url of urls) {
    await downloadFile(url);
  }
}

baixarTodosSequencialmente();
