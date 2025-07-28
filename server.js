// /api/server.js
// Versão 12.0: Modo Investigador Forense com endpoints separados para cada passo da investigação.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// --- FUNÇÃO DE CABEÇALHOS PADRÃO ---
// Centraliza a criação dos cabeçalhos que imitam o Taskitos.
const getTaskitosHeaders = (token) => ({
    'x-api-key': token,
    'x-client-domain': 'taskitos.cupiditys.lol',
    'origin': 'https://taskitos.cupiditys.lol',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
});

// --- ROTAS DA API ---

// ROTA PARA PASSO 1: BUSCAR "SALAS" (TURMAS E OUTROS DADOS)
app.post('/api/get-rooms', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'O token (x-api-key) é necessário.' });

    try {
        console.log("[FORENSE] Passo 1: Buscando dados de /room/user...");
        const roomsResponse = await axios.get('https://edusp-api.ip.tv/room/user', { 
            headers: getTaskitosHeaders(token) 
        });
        // Retorna a resposta bruta para análise no frontend.
        res.status(200).json(roomsResponse.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: 'Falha ao buscar dados das salas.', details: error.response?.data });
    }
});

// ROTA PARA PASSO 2: BUSCAR TAREFAS COM OS ALVOS CORRETOS
app.post('/api/get-tasks', async (req, res) => {
    const { token, targets } = req.body;
    if (!token || !targets || !Array.isArray(targets) || targets.length === 0) {
        return res.status(400).json({ error: 'Token e uma lista de "targets" são necessários.' });
    }

    try {
        console.log("[FORENSE] Passo 2: Buscando tarefas com os alvos:", targets);
        
        // Constrói a parte da URL com todos os publication_target[]
        const publicationTargets = targets.map(target => `publication_target[]=${target}`).join('&');
        const urlTarefas = `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&is_essay=false&is_exam=false&answer_statuses=draft&answer_statuses=pending&with_answer=true&with_apply_moment=true&limit=100&filter_expired=true&offset=0&${publicationTargets}`;

        const tarefasResponse = await axios.get(urlTarefas, { 
            headers: getTaskitosHeaders(token) 
        });

        console.log("[FORENSE] Sucesso! Tarefas encontradas.");
        res.status(200).json(tarefasResponse.data);

    } catch (error) {
        res.status(error.response?.status || 500).json({ error: 'Falha ao buscar tarefas.', details: error.response?.data });
    }
});

module.exports = app;

