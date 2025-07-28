// /api/server.js
// Versão 7.0: Ferramenta de investigação com endpoints separados para cada passo.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// ROTA DE LOGIN (Inalterada)
app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ error: 'RA e Senha são obrigatórios.' });
  try {
    const response = await axios.post('https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken', 
      { user: `${ra}SP`, senha },
      { headers: { 'Ocp-Apim-Subscription-Key': '2b03c1db3884488795f79c37c069381a' } }
    );
    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: 'Falha no login', details: error.response?.data });
  }
});

// ROTA PARA PASSO 1: BUSCAR PERFIS
app.post('/api/get-perfis', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token é necessário.' });

    try {
        console.log("[INVESTIGADOR] Executando Passo 1: Buscar Perfis...");
        const perfisUrl = 'https://sedintegracoes.educacao.sp.gov.br/muralavisosapi/api/mural-avisos/listar-perfis';
        const perfisResponse = await axios.get(perfisUrl, { 
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Ocp-Apim-Subscription-Key': 'efc224c33f02487c91c0a299634b2077' 
            }
        });
        // Retorna a resposta bruta para análise
        res.status(200).json(perfisResponse.data);
    } catch (error) {
        console.error("[INVESTIGADOR] Erro no Passo 1:", error.response?.data || error.message);
        res.status(500).json({ error: 'Falha ao buscar perfis.', details: error.response?.data || error.message });
    }
});

// ROTA PARA PASSO 2: TESTAR BUSCA DE TURMAS
app.post('/api/get-turmas', async (req, res) => {
    const { token, codigoAluno, escolaId } = req.body;
    if (!token || !codigoAluno || !escolaId) {
        return res.status(400).json({ error: 'Token, Código do Aluno e ID da Escola são necessários.' });
    }

    try {
        console.log(`[INVESTIGADOR] Executando Passo 2: Buscando Turmas com escolaId: ${escolaId}...`);
        const anoLetivo = new Date().getFullYear();
        const turmasUrl = `https://sedintegracoes.educacao.sp.gov.br/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}&anoLetivo=${anoLetivo}&codigoEscola=${escolaId}`;
        
        const turmasResponse = await axios.get(turmasUrl, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Ocp-Apim-Subscription-Key': '5936fddda3484fe1aa4436df1bd76dab' 
            }
        });
        // Retorna a resposta bruta para análise
        res.status(200).json(turmasResponse.data);
    } catch (error) {
        console.error("[INVESTIGADOR] Erro no Passo 2:", error.response?.data || error.message);
        res.status(500).json({ error: 'Falha ao buscar turmas.', details: error.response?.data || error.message });
    }
});

module.exports = app;

          
