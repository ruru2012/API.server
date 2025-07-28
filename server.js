// /api/server.js
// Versão 11.0: Modo Injetor. Recebe um token válido capturado do Taskitos e busca as tarefas.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// ROTA ÚNICA PARA BUSCAR TAREFAS COM UM TOKEN CAPTURADO
app.post('/api/get-tasks-with-key', async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ error: 'O token (x-api-key) capturado é necessário.' });
    }

    // Estes são os cabeçalhos que o Taskitos usa, mas a chave é o token.
    const headers = {
        'x-api-key': token,
        'x-client-domain': 'taskitos.cupiditys.lol',
        'origin': 'https://taskitos.cupiditys.lol',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
    };

    try {
        // --- PASSO 1: Obter a lista de "salas" (turmas) do usuário ---
        console.log("[INJETOR] Passo 1: Buscando salas com o token injetado...");
        const roomsResponse = await axios.get('https://edusp-api.ip.tv/room/user', { headers });
        
        const rooms = roomsResponse.data.items;
        if (!rooms || rooms.length === 0) {
            console.log("[INJETOR] Nenhuma sala encontrada.");
            return res.status(200).json({ items: [] });
        }
        console.log(`[INJETOR] Encontradas ${rooms.length} salas.`);

        // --- PASSO 2: Buscar as tarefas para cada sala ---
        console.log("[INJETOR] Passo 2: Buscando tarefas...");
        const publicationTargets = rooms.map(room => `publication_target[]=${room.id}`).join('&');
        const urlTarefas = `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&is_essay=false&is_exam=false&answer_statuses=draft&answer_statuses=pending&with_answer=true&with_apply_moment=true&limit=100&filter_expired=true&offset=0&${publicationTargets}`;

        const tarefasResponse = await axios.get(urlTarefas, { headers });

        console.log("[INJETOR] Sucesso! Tarefas encontradas.");
        res.status(200).json(tarefasResponse.data);

    } catch (error) {
        console.error("[INJETOR] Erro no fluxo:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ error: 'Falha ao buscar tarefas com a chave fornecida.', details: error.response?.data });
    }
});

module.exports = app;

