// /api/server.js
// Versão 6.2: Corrige o erro "find is not a function" ao verificar
// o formato da resposta de perfis antes de processá-la.

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

// ROTA "MESTRE" COM A CORREÇÃO
app.post('/api/get-all-data', async (req, res) => {
    const { token, codigoAluno } = req.body;
    if (!token || !codigoAluno) {
        return res.status(400).json({ error: 'Token e Código do Aluno são necessários.' });
    }

    const authHeader = { 'Authorization': `Bearer ${token}` };

    try {
        // --- PASSO 1: Buscar Perfis ---
        let perfisResponse;
        try {
            console.log("[DETETIVE] Passo 1: Buscando perfis do usuário...");
            const perfisUrl = 'https://sedintegracoes.educacao.sp.gov.br/muralavisosapi/api/mural-avisos/listar-perfis';
            perfisResponse = await axios.get(perfisUrl, { 
                headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': 'efc224c33f02487c91c0a299634b2077' }
            });
        } catch (e) {
            throw new Error(`Falha no Passo 1 (Buscar Perfis). Detalhes: ${e.message}`);
        }
        
        // *** CORREÇÃO APLICADA AQUI ***
        // Verificamos se a resposta é um objeto e se a lista está dentro de uma propriedade 'data'
        const perfisData = perfisResponse.data;
        let listaDePerfis;

        if (Array.isArray(perfisData)) {
            // Se a resposta já for um array, usamos diretamente.
            listaDePerfis = perfisData;
        } else if (perfisData && Array.isArray(perfisData.data)) {
            // Se for um objeto com uma propriedade 'data' que é um array.
            listaDePerfis = perfisData.data;
        } else {
            // Se não for nenhum dos formatos esperados, lançamos um erro claro.
            throw new Error("Erro no Passo 1: A resposta da API de perfis não contém uma lista de perfis no formato esperado.");
        }
        
        const perfilAluno = listaDePerfis.find(p => p.perfilId === 1);
        if (!perfilAluno || !perfilAluno.escolas || perfilAluno.escolas.length === 0) {
            throw new Error("Erro no Passo 1: Perfil de aluno ou código da escola não foi encontrado na lista de perfis.");
        }
        const escolaId = perfilAluno.escolas[0].escolaId;
        console.log(`[DETETIVE] Passo 1 CONCLUÍDO. Escola ID: ${escolaId}`);
        
        // --- PASSO 2: Buscar Turmas ---
        let turmasResponse;
        try {
            console.log("[DETETIVE] Passo 2: Buscando turmas...");
            const anoLetivo = new Date().getFullYear();
            const turmasUrl = `https://sedintegracoes.educacao.sp.gov.br/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}&anoLetivo=${anoLetivo}&codigoEscola=${escolaId}`;
            turmasResponse = await axios.get(turmasUrl, {
                headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': '5936fddda3484fe1aa4436df1bd76dab' }
            });
        } catch (e) {
            throw new Error(`Falha no Passo 2 (Buscar Turmas). Detalhes: ${e.message}`);
        }

        if (!turmasResponse.data.isSucess) {
             throw new Error("Erro no Passo 2: A busca por turmas não foi bem-sucedida.");
        }
        const turmas = turmasResponse.data.data || [];
        console.log(`[DETETIVE] Passo 2 CONCLUÍDO. Encontradas ${turmas.length} turmas.`);

        // --- PASSO 3: Buscar Mensagens e Avisos ---
        let notificacoes = [], avisos = [];
        if (turmas.length > 0) {
            try {
                console.log("[DETETIVE] Passo 3: Buscando mensagens...");
                const primeiraTurmaId = turmas[0].codigo;
                
                const [notificacoesRes, avisosRes] = await Promise.all([
                    axios.get(`https://sedintegracoes.educacao.sp.gov.br/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao?userId=${codigoAluno}`, { headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': '1a758fd2f6be41448079c9616a861b91' } }),
                    axios.get(`https://sedintegracoes.educacao.sp.gov.br/muralavisosapi/api/mural-avisos/listar-avisos?CodigoUsuario=${codigoAluno}&PerfilAviso=1&Turmas=${primeiraTurmaId}`, { headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': 'efc224c33f02487c91c0a299634b2077' } })
                ]);
                notificacoes = notificacoesRes.data;
                avisos = avisosRes.data;
                console.log(`[DETETIVE] Passo 3 CONCLUÍDO. Encontradas ${notificacoes.length} notificações e ${avisos.length} avisos.`);
            } catch (e) {
                console.warn(`[DETETIVE] Aviso no Passo 3 (Mensagens): Não foi possível buscar. Detalhes: ${e.message}`);
            }
        }

        // --- PASSO FINAL: Enviar tudo de volta para o frontend ---
        res.status(200).json({ turmas, notificacoes, avisos });

    } catch (error) {
        console.error("[DETETIVE] Erro fatal no fluxo:", error.message);
        res.status(400).json({ 
            error: 'Falha ao buscar os dados do dashboard.', 
            details: error.message
        });
    }
});

module.exports = app;

