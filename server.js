// /api/server.js
// Versão Final: Engenharia Reversa. Recria o fluxo de autenticação e
// geração de assinatura do Taskitos para obter as tarefas.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// --- FUNÇÃO DE GERAÇÃO DE ASSINATURA ---
// Após análise, a assinatura parece ser um número aleatório codificado em Base64.
// Esta função recria esse comportamento.
const generateSignature = () => {
    const randomNumber = Math.floor(Math.random() * 1000000000) + 100000000;
    return Buffer.from(String(randomNumber)).toString('base64');
};

// --- FUNÇÃO DE CABEÇALHOS PADRÃO ---
const getTaskitosHeaders = (token) => ({
    'x-api-key': token,
    'x-client-timestamp': Date.now(),
    'x-client-signature': generateSignature(),
    'x-client-domain': 'taskitos.cupiditys.lol',
    'origin': 'https://taskitos.cupiditys.lol',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*'
});

// --- ROTA "TUDO-EM-UM" ---
app.post('/api/get-tasks', async (req, res) => {
    const { ra, senha } = req.body;
    if (!ra || !senha) return res.status(400).json({ error: 'RA e Senha são obrigatórios.' });

    try {
        // --- PASSO 1: LOGIN (MÉTODO TASKITOS) ---
        console.log("[REVERSO] Passo 1: Tentando login...");
        const loginResponse = await axios.post('https://edusp-api.ip.tv/registration/edusp', 
          { realm: "edusp", platform: "webclient", id: `${ra}sp`, password: senha },
          { 
            headers: { 
                'x-client-timestamp': Date.now(),
                'x-client-signature': generateSignature(),
                'x-client-domain': 'taskitos.cupiditys.lol',
                'origin': 'https://taskitos.cupiditys.lol',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
            } 
          }
        );
        const loginData = loginResponse.data;
        if (!loginData.token) throw new Error('Token não recebido do login.');
        console.log("[REVERSO] Passo 1: Sucesso!");

        // --- PASSO 2: Obter a lista de "salas" (turmas) ---
        console.log("[REVERSO] Passo 2: Buscando salas...");
        const token = loginData.token;
        const roomsResponse = await axios.get('https://edusp-api.ip.tv/room/user', { 
            headers: getTaskitosHeaders(token) 
        });
        
        const roomsData = roomsResponse.data;
        if (!roomsData || !roomsData.rooms) throw new Error("Resposta de /room/user inválida.");

        const roomIds = roomsData.rooms.map(room => room.id);
        const groupIds = roomsData.rooms.flatMap(room => room.group_categories ? room.group_categories.map(group => group.id) : []);
        const allTargets = [...new Set([...roomIds, ...groupIds])];

        if (allTargets.length === 0) {
            return res.status(200).json({ items: [] });
        }
        console.log("[REVERSO] Passo 2: Sucesso!");

        // --- PASSO 3: Buscar as tarefas ---
        console.log("[REVERSO] Passo 3: Buscando tarefas...");
        const publicationTargets = allTargets.map(target => `publication_target[]=${target}`).join('&');
        const urlTarefas = `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&is_essay=false&is_exam=false&answer_statuses=draft&answer_statuses=pending&with_answer=true&with_apply_moment=true&limit=100&filter_expired=true&offset=0&${publicationTargets}`;

        const tarefasResponse = await axios.get(urlTarefas, { 
            headers: getTaskitosHeaders(token) 
        });

        console.log("[REVERSO] Sucesso Final! Tarefas obtidas.");
        res.status(200).json(tarefasResponse.data);

    } catch (error) {
        const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
        console.error("[REVERSO] Erro no fluxo:", errorMessage);
        res.status(error.response?.status || 500).json({ error: 'Falha no processo de engenharia reversa.', details: errorMessage });
    }
});

module.exports = app;

