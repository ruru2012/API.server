// Este arquivo deve estar em /api/dados-aluno.js

// Usamos o 'node-fetch' para fazer requisições HTTP no ambiente Node.js
// Para instalar: npm install node-fetch
import fetch from 'node-fetch';

// Handler principal que a Vercel irá executar
export default async function handler(req, res) {
    // Permitir requisições de qualquer origem (CORS) - útil para desenvolvimento local
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // O Vercel lida com requisições OPTIONS automaticamente, mas é bom ter isso para clareza
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Apenas aceitamos requisições POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const { user, senha } = req.body;

        if (!user || !senha) {
            return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
        }

        // --- ETAPA 1: Realizar o Login para obter o Token ---
        const loginResponse = await fetch('https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': '2b03c1db3884488795f79c37c069381a', // Chave da sua requisição de login
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
            },
            body: JSON.stringify({ user, senha }),
        });

        if (!loginResponse.ok) {
            const errorData = await loginResponse.json();
            console.error('Erro no login SED:', errorData);
            return res.status(loginResponse.status).json({ error: `Falha na autenticação: ${errorData.Message || 'Credenciais inválidas.'}` });
        }

        const loginData = await loginResponse.json();
        const { token, codigoAluno } = loginData;

        if (!token || !codigoAluno) {
            return res.status(500).json({ error: 'Resposta da API de login incompleta.' });
        }
        
        // --- ETAPA 2: Buscar as turmas do aluno usando o Token e o Código do Aluno ---
        const turmasResponse = await fetch(`https://sedintegracoes.educacao.sp.gov.br/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`, // O token obtido no login
                'Ocp-Apim-Subscription-Key': '5936fddda3484fe1aa4436df1bd76dab', // Chave da sua requisição de turmas
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
            }
        });

        if (!turmasResponse.ok) {
            const errorText = await turmasResponse.text();
            console.error('Erro ao buscar turmas:', errorText);
            return res.status(turmasResponse.status).json({ error: 'Não foi possível buscar os dados das turmas.' });
        }
        
        const turmasData = await turmasResponse.json();

        // --- ETAPA 3: Enviar os dados combinados de volta para o frontend ---
        res.status(200).json({
            loginData,
            turmasData
        });

    } catch (error) {
        console.error('Erro interno no servidor:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
    }
}

