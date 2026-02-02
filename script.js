// Configurações do sistema
const SENHA_SISTEMA = "financa123"; // Senha compartilhada entre Caio e Itallo
let movimentacoes = [];

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Definir data atual como padrão
    document.getElementById('data').valueAsDate = new Date();
    
    // Carregar dados do LocalStorage
    carregarDados();
    
    // Atualizar interface
    atualizarSaldos();
    atualizarHistorico();
    
    // Configurar eventos
    document.getElementById('form-movimentacao').addEventListener('submit', registrarMovimentacao);
    document.getElementById('btn-limpar').addEventListener('click', limparFormulario);
    document.getElementById('btn-exportar').addEventListener('click', exportarDados);
    document.getElementById('btn-importar').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', importarDados);
    document.getElementById('tipo').addEventListener('change', atualizarLabelsFormulario);
    
    // Atualizar labels inicialmente
    atualizarLabelsFormulario();
    
    // Mostrar mensagem de boas-vindas
    mostrarToast('Sistema carregado! Use a senha: financa123', 'success');
});

// Carregar dados do LocalStorage
function carregarDados() {
    const dadosSalvos = localStorage.getItem('movimentacoesCaioItallo');
    if (dadosSalvos) {
        try {
            movimentacoes = JSON.parse(dadosSalvos);
            mostrarToast('Dados locais carregados com sucesso!', 'success');
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
            mostrarToast('Erro ao carregar dados locais', 'error');
        }
    }
}

// Salvar dados no LocalStorage
function salvarDados() {
    try {
        localStorage.setItem('movimentacoesCaioItallo', JSON.stringify(movimentacoes));
        return true;
    } catch (e) {
        console.error('Erro ao salvar dados:', e);
        mostrarToast('Erro ao salvar dados', 'error');
        return false;
    }
}

// Atualizar saldos na interface
function atualizarSaldos() {
    let saldoCaio = 0;
    let saldoItallo = 0;
    
    // Calcular saldos com base nas movimentações
    movimentacoes.forEach(mov => {
        if (mov.tipo === 'emprestimo') {
            if (mov.direcao === 'caio-para-itallo') {
                // Caio emprestou para Itallo, Caio tem crédito, Itallo tem débito
                saldoCaio += mov.valor;
                saldoItallo -= mov.valor;
            } else {
                // Itallo emprestou para Caio, Itallo tem crédito, Caio tem débito
                saldoItallo += mov.valor;
                saldoCaio -= mov.valor;
            }
        } else if (mov.tipo === 'pagamento') {
            if (mov.direcao === 'caio-para-itallo') {
                // Caio pagou Itallo, reduz crédito de Caio e débito de Itallo
                saldoCaio -= mov.valor;
                saldoItallo += mov.valor;
            } else {
                // Itallo pagou Caio, reduz crédito de Itallo e débito de Caio
                saldoItallo -= mov.valor;
                saldoCaio += mov.valor;
            }
        }
    });
    
    // Atualizar interface do Caio
    const saldoCaioElement = document.getElementById('saldo-caio');
    const descricaoCaioElement = document.getElementById('descricao-caio');
    
    saldoCaioElement.textContent = formatarMoeda(saldoCaio);
    saldoCaioElement.className = 'saldo-valor ' + (saldoCaio >= 0 ? 'saldo-positivo' : 'saldo-negativo');
    
    if (saldoCaio > 0) {
        descricaoCaioElement.textContent = 'Itallo deve R$ ' + formatarMoeda(saldoCaio) + ' para Caio';
        descricaoCaioElement.style.color = '#27ae60';
    } else if (saldoCaio < 0) {
        descricaoCaioElement.textContent = 'Caio deve R$ ' + formatarMoeda(Math.abs(saldoCaio)) + ' para Itallo';
        descricaoCaioElement.style.color = '#e74c3c';
    } else {
        descricaoCaioElement.textContent = 'Contas em dia - nenhuma dívida';
        descricaoCaioElement.style.color = '#7f8c8d';
    }
    
    // Atualizar interface do Itallo
    const saldoItalloElement = document.getElementById('saldo-itallo');
    const descricaoItalloElement = document.getElementById('descricao-itallo');
    
    saldoItalloElement.textContent = formatarMoeda(saldoItallo);
    saldoItalloElement.className = 'saldo-valor ' + (saldoItallo >= 0 ? 'saldo-positivo' : 'saldo-negativo');
    
    if (saldoItallo > 0) {
        descricaoItalloElement.textContent = 'Caio deve R$ ' + formatarMoeda(saldoItallo) + ' para Itallo';
        descricaoItalloElement.style.color = '#27ae60';
    } else if (saldoItallo < 0) {
        descricaoItalloElement.textContent = 'Itallo deve R$ ' + formatarMoeda(Math.abs(saldoItallo)) + ' para Caio';
        descricaoItalloElement.style.color = '#e74c3c';
    } else {
        descricaoItalloElement.textContent = 'Contas em dia - nenhuma dívida';
        descricaoItalloElement.style.color = '#7f8c8d';
    }
}

// Atualizar histórico na interface
function atualizarHistorico() {
    const corpoHistorico = document.getElementById('historico-corpo');
    const semDadosElement = document.getElementById('sem-dados');
    
    // Limpar corpo da tabela
    corpoHistorico.innerHTML = '';
    
    if (movimentacoes.length === 0) {
        semDadosElement.style.display = 'block';
        return;
    }
    
    semDadosElement.style.display = 'none';
    
    // Ordenar por data (mais recente primeiro)
    const movimentacoesOrdenadas = [...movimentacoes].sort((a, b) => 
        new Date(b.dataRegistro || b.data) - new Date(a.dataRegistro || a.data));
    
    // Adicionar cada movimentação à tabela
    movimentacoesOrdenadas.forEach((mov, index) => {
        const linha = document.createElement('tr');
        
        // Formatar data
        const dataObj = new Date(mov.data);
        const dataFormatada = dataObj.toLocaleDateString('pt-BR');
        
        // Determinar ícone e texto da direção
        let direcaoTexto = '';
        let direcaoIcone = '';
        let classeValor = '';
        
        if (mov.tipo === 'emprestimo') {
            if (mov.direcao === 'caio-para-itallo') {
                direcaoTexto = 'Caio → Itallo';
                direcaoIcone = '<i class="fas fa-arrow-right"></i>';
                classeValor = 'valor-emprestimo';
            } else {
                direcaoTexto = 'Itallo → Caio';
                direcaoIcone = '<i class="fas fa-arrow-left"></i>';
                classeValor = 'valor-emprestimo';
            }
        } else {
            if (mov.direcao === 'caio-para-itallo') {
                direcaoTexto = 'Caio → Itallo';
                direcaoIcone = '<i class="fas fa-arrow-right"></i>';
                classeValor = 'valor-pagamento';
            } else {
                direcaoTexto = 'Itallo → Caio';
                direcaoIcone = '<i class="fas fa-arrow-left"></i>';
                classeValor = 'valor-pagamento';
            }
        }
        
        linha.innerHTML = `
            <td>${dataFormatada}</td>
            <td>${mov.descricao || (mov.tipo === 'emprestimo' ? 'Empréstimo' : 'Pagamento')}</td>
            <td>
                <div class="direcao-setas">
                    ${direcaoIcone}
                    <span>${direcaoTexto}</span>
                </div>
            </td>
            <td class="${classeValor}">${formatarMoeda(mov.valor)}</td>
            <td>
                <button class="btn-excluir" onclick="excluirMovimentacao(${index})">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </td>
        `;
        
        corpoHistorico.appendChild(linha);
    });
}

// Registrar nova movimentação
function registrarMovimentacao(event) {
    event.preventDefault();
    
    // Verificar senha
    const senhaDigitada = document.getElementById('senha').value;
    if (senhaDigitada !== SENHA_SISTEMA) {
        mostrarToast('Senha incorreta! Use: financa123', 'error');
        return;
    }
    
    // Obter valores do formulário
    const tipo = document.getElementById('tipo').value;
    const direcaoElement = document.querySelector('input[name="direcao"]:checked');
    
    if (!direcaoElement) {
        mostrarToast('Selecione a direção da movimentação', 'error');
        return;
    }
    
    const valor = parseFloat(document.getElementById('valor').value);
    const descricao = document.getElementById('descricao').value;
    const data = document.getElementById('data').value;
    
    // Validações
    if (!tipo || !valor || !data) {
        mostrarToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    if (valor <= 0) {
        mostrarToast('O valor deve ser maior que zero', 'error');
        return;
    }
    
    // Criar objeto da movimentação
    const movimentacao = {
        tipo,
        direcao: direcaoElement.value,
        valor,
        descricao,
        data,
        dataRegistro: new Date().toISOString()
    };
    
    // Adicionar ao array
    movimentacoes.push(movimentacao);
    
    // Salvar no LocalStorage
    if (salvarDados()) {
        // Atualizar interface
        atualizarSaldos();
        atualizarHistorico();
        
        // Limpar formulário
        limparFormulario();
        
        // Mostrar mensagem de sucesso
        mostrarToast('Movimentação registrada com sucesso!', 'success');
    }
}

// Excluir movimentação
function excluirMovimentacao(index) {
    // Pedir senha para excluir
    const senha = prompt('Digite a senha para excluir esta movimentação:');
    if (senha !== SENHA_SISTEMA) {
        mostrarToast('Senha incorreta!', 'error');
        return;
    }
    
    if (confirm('Tem certeza que deseja excluir esta movimentação?')) {
        // Remover do array
        movimentacoes.splice(index, 1);
        
        // Salvar no LocalStorage
        if (salvarDados()) {
            // Atualizar interface
            atualizarSaldos();
            atualizarHistorico();
            
            mostrarToast('Movimentação excluída com sucesso!', 'success');
        }
    }
}

// Limpar formulário
function limparFormulario() {
    document.getElementById('form-movimentacao').reset();
    document.getElementById('data').valueAsDate = new Date();
    atualizarLabelsFormulario();
}

// Atualizar labels do formulário
function atualizarLabelsFormulario() {
    const tipo = document.getElementById('tipo').value;
    const direcaoLabels = document.querySelectorAll('.radio-option label');
    
    if (tipo === 'emprestimo') {
        direcaoLabels[0].textContent = 'Caio emprestou para Itallo';
        direcaoLabels[1].textContent = 'Itallo emprestou para Caio';
    } else if (tipo === 'pagamento') {
        direcaoLabels[0].textContent = 'Caio pagou Itallo';
        direcaoLabels[1].textContent = 'Itallo pagou Caio';
    } else {
        direcaoLabels[0].textContent = 'Caio → Itallo';
        direcaoLabels[1].textContent = 'Itallo → Caio';
    }
}

// Exportar dados para JSON
function exportarDados() {
    if (movimentacoes.length === 0) {
        mostrarToast('Não há dados para exportar', 'warning');
        return;
    }
    
    const dados = {
        sistema: 'Controle Financeiro Caio & Itallo',
        versao: '1.0',
        dataExportacao: new Date().toISOString(),
        totalMovimentacoes: movimentacoes.length,
        movimentacoes: movimentacoes
    };
    
    const dadosStr = JSON.stringify(dados, null, 2);
    const blob = new Blob([dadosStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `controle-financeiro-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    mostrarToast('Dados exportados com sucesso!', 'success');
}

// Importar dados de JSON
function importarDados(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Pedir senha para importar
    const senha = prompt('Digite a senha para importar dados:');
    if (senha !== SENHA_SISTEMA) {
        mostrarToast('Senha incorreta!', 'error');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            
            if (!dados.movimentacoes || !Array.isArray(dados.movimentacoes)) {
                throw new Error('Formato de arquivo inválido');
            }
            
            // Substituir dados atuais
            movimentacoes = dados.movimentacoes;
            
            // Salvar no LocalStorage
            if (salvarDados()) {
                // Atualizar interface
                atualizarSaldos();
                atualizarHistorico();
                
                mostrarToast(`${dados.movimentacoes.length} movimentações importadas com sucesso!`, 'success');
            }
        } catch (error) {
            console.error('Erro ao importar dados:', error);
            mostrarToast('Erro ao importar arquivo. Verifique o formato.', 'error');
        }
        
        // Limpar input file
        event.target.value = '';
    };
    reader.readAsText(file);
}

// Formatar valor em moeda brasileira
function formatarMoeda(valor) {
    return 'R$ ' + valor.toFixed(2).replace('.', ',');
}

// Mostrar notificação toast
function mostrarToast(mensagem, tipo = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem;
    toast.className = 'toast show';
    
    // Cores baseadas no tipo
    if (tipo === 'success') {
        toast.style.backgroundColor = '#27ae60';
    } else if (tipo === 'error') {
        toast.style.backgroundColor = '#e74c3c';
    } else if (tipo === 'warning') {
        toast.style.backgroundColor = '#f39c12';
    } else {
        toast.style.backgroundColor = '#3498db';
    }
    
    // Remover após 3 segundos
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Função extra: backup automático
function fazerBackupAutomatico() {
    if (movimentacoes.length > 0) {
        const backupKey = 'backup_' + new Date().toISOString().split('T')[0];
        localStorage.setItem(backupKey, JSON.stringify(movimentacoes));
    }
}

// Fazer backup a cada hora
setInterval(fazerBackupAutomatico, 60 * 60 * 1000);

// Mostrar instruções iniciais
setTimeout(() => {
    console.log('=== CONTROLE FINANCEIRO CAIO & ITALLO ===');
    console.log('Senha do sistema: financa123');
    console.log('Os dados são salvos no seu navegador');
    console.log('Exporte os dados para acessar em outro dispositivo');
}, 1000);
