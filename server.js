// (Este código NÃO roda no navegador, apenas em um servidor Node.js)
const puppeteer = require('puppeteer');

async function getApiKey(loginUrl, username, password) {
    let browser = null;
    try {
        browser = await puppeteer.launch({ headless: true }); // 'true' para rodar invisível
        const page = await browser.newPage();
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });

        // Encontra os campos e o botão (os seletores '#user', '#pass', '#loginBtn' são exemplos)
        await page.type('#username-input-selector', username); // Troque pelo seletor real
        await page.type('#password-input-selector', password); // Troque pelo seletor real
        await page.click('#login-button-selector'); // Troque pelo seletor real

        // Espera a página carregar após o login
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Executa um script DENTRO da página logada para pegar a chave do localStorage
        const apiKey = await page.evaluate(() => {
            // O nome 'x-api-key' é um exemplo, você precisa descobrir o nome real
            return localStorage.getItem('nome_real_da_chave_api'); 
        });

        if (!apiKey) {
            throw new Error('Chave de API não encontrada após o login.');
        }

        return apiKey;

    } catch (error) {
        console.error("Erro no robô Puppeteer:", error);
        throw new Error("Automação falhou: " + error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
