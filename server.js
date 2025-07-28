// /api/server.js
// Versão 5.0: Abordagem de decodificação. Removemos a lógica do Taskitos
// e criamos um endpoint de teste flexível para encontrar o parâmetro correto.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// --- ROTAS DA API ---

// ROTA DE LOGIN (Voltamos para o método original da SED, que é confiável)
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

// NOVA ROTA DE TESTE PARA TURMAS
app.post('/api/testar-turmas', async (req, res) => {
    const { token, codigoAluno } = req.body;
    if (!token || !codigoAluno) {
        return res.status(400).json({ error: 'Token e um Código de Aluno para teste são necessários.' });
    }

    // A URL que estamos testando. Usamos o `codigoAluno` que o frontend nos enviar.
    const url = `https://sedintegracoes.educacao.sp.gov.br/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}`;
    
    console.log(`[DECODIFICADOR] Testando URL: ${url}`);

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Ocp-Apim-Subscription-Key': '5936fddda3484fe1aa4436df1bd76dab'
            }
        });
        // Retorna a resposta completa, seja sucesso ou não, para análise no frontend.
        res.status(200).json(response.data);
    } catch (error) {
        console.error("[DECODIFICADOR] Erro no teste:", error.response?.data || error.message);
        // Se a requisição falhar (ex: 404, 500), retorna o erro para análise.
        res.status(error.response?.status || 500).json({ 
            error: 'O teste falhou.', 
            details: error.response?.data 
        });
    }
});

module.exports = app;

