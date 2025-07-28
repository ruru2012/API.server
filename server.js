// /api/server.js
// Versão 15.0: Um proxy simples e robusto. A sua única função é
// reencaminhar pedidos do nosso frontend para os servidores externos.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// ROTA ÚNICA DE PROXY
app.post('/api/proxy', async (req, res) => {
    const { method, url, data, headers } = req.body;

    if (!method || !url) {
        return res.status(400).json({ error: 'Método e URL são necessários.' });
    }

    console.log(`[PROXY] Reencaminhando pedido ${method} para ${url}`);

    try {
        const response = await axios({
            method: method,
            url: url,
            data: data || {},
            headers: headers || {}
        });
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error(`[PROXY] Erro ao contactar ${url}:`, error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: `Falha na comunicação com o servidor externo.`, 
            details: error.response?.data 
        });
    }
});

module.exports = app;

