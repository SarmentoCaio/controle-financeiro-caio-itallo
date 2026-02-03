// Sistema de Controle Financeiro - Caio & Itallo
// Dados salvos em LocalStorage (apenas no navegador atual)

let movimentacoes = [];
let filtroAtivo = false;
let acaoConfirmacao = null;
let parametrosConfirmacao = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Definir data e hora atual como padrão
    const agora = new Date();
    document.getElementById('data').valueAsDate = agora;
    document.getElementById('hora').value = agora.toTimeString().substring(0, 5);
    
    // Carregar dados do LocalStorage
    carregarDados();
    
    // Atualizar interface
    atualizarInterface();
    
    // Configurar eventos
    document.getElementById('form-movimentacao').addEventListener('submit', registrarMovimentacao);
    document.getElementById('btn-limpar').addEventListener('click', limparFormulario);
    document.getElementById('btn-exportar').addEventListener('click', exportarDados);
    document.getElementById('btn-importar').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', importarDados);
    document.getElementById('tipo').addEventListener('change', atualizarLabelsFormulario);
    document.getElementById('btn-sincronizar').addEventListener('click', mostrarModalSincronizacao);
    document.getElementById('btn-fechar-modal').addEventListener('click', fecharModal);
    document.getElementById('btn-limpar-tudo').addEventListener('click', () => {
        mostrarConfirmacao('limparTodosDados', null, 'Tem certeza que deseja excluir TODOS os dados? Esta ação não pode ser desfeita.');
    });
    document.getElementById('btn-filtrar').addEventListener('click', alternarFiltro);
    document.getElementById('btn-cancelar').addEventListener('click', cancelarConfirmacao);
    document.getElementById('btn-confirmar').addEventListener('click', executarConfirmacao);
    
    // Fechar modais ao clicar fora
    document.getElementById('sync-modal').addEventListener('click', function(e) {
        if (e.target === this) fecharModal();
    });
    
    document.getElementById('confirm-modal').addEventListener('click', function(e) {
        if (e.target === this) cancelarConfirmacao();
    });
    
    // Atualizar labels inicialmente
    atualizarLabelsFormulario();
    
    // Mostrar informações iniciais
    mostrarToast('Sistema carregado! Dados salvos localmente.', 'info');
});

// Carregar dados do LocalStorage
function carregarDados() {
    try {
        const dadosSalvos = localStorage.getItem('movimentacoesCaioItallo');
        if (dadosSalvos) {
            movimentacoes = JSON.parse(dadosSalvos);
            console.log(`Carregadas ${movimentacoes.length} movimentações`);
        }
    } catch (e) {
        console.error('Erro ao carregar dados:', e);
        mostrarToast('Erro ao carregar dados locais', 'error');
    }
}

// Salvar dados no LocalStorage
function salvarDados() {
    try {
        localStorage.setItem('movimentacoesCaioItallo', JSON.stringify(movimentacoes));
        localStorage.setItem('ultimaAtualizacao', new Date().toISOString());
        return true;
    } catch (e) {
        console.error('Erro ao salvar dados:', e);
        mostrarToast('Erro ao salvar dados. Espaço pode estar cheio.', 'error');
        return false;
    }
}

// Atualizar toda a interface
function atualizarInterface() {
    atualizarSaldos();
    atualizarHistorico();
    atualizarEstatisticas();
}

// Atualizar saldos
function atualizarSaldos() {
    let saldoCaio = 0;
    let saldoItallo = 0;
    
    movimentacoes.forEach(mov => {
        if (mov.tipo === 'emprestimo') {
            if (mov.direcao === 'caio-para-itallo') {
                saldoCaio += mov.valor;
                saldoItallo -= mov.valor;
            } else {
                saldoItallo += mov.valor;
                saldoCaio -= mov.valor;
            }
        } else if (mov.tipo === 'pagamento') {
            if (mov.direcao === 'caio-para-itallo') {
                saldoCaio -= mov.valor;
                saldoItallo += mov.valor;
            } else {
                saldoItallo -= mov.valor;
                saldoCaio += mov.valor;
            }
        }
    });
    
    // Caio
    const saldoCaioElement = document.getElementById('saldo-caio');
    const descricaoCaioElement = document.getElementById('descricao-caio');
    
    saldoCaioElement.textContent = formatarMoeda(saldoCaio);
    saldoCaioElement.className = 'saldo-valor ' + (saldoCaio >= 0 ? 'saldo-positivo' : 'saldo-negativo');
    
    if (saldoCaio > 0) {
        descricaoCaioElement.textContent = `Itallo deve ${formatarMoeda(saldoCaio)}`;
        descricaoCaioElement.style.color = '#27ae60';
    } else if (saldoCaio < 0) {
        descricaoCaioElement.textContent = `Caio deve ${formatarMoeda(Math.abs(saldoCaio))}`;
        descricaoCaioElement.style.color = '#e74c3c';
    } else {
        descricaoCaioElement.textContent = 'Contas em dia';
        descricaoCaioElement.style.color = '#7f8c8d';
    }
    
    // Itallo
    const saldoItalloElement = document.getElementById('saldo-itallo');
    const descricaoItalloElement = document.getElementById('descricao-itallo');
    
    saldoItalloElement.textContent = formatarMoeda(saldoItallo);
    saldoItalloElement.className = 'saldo-valor ' + (saldoItallo >= 0 ? 'saldo-positivo' : 'saldo-negativo');
    
    if (saldoItallo > 0) {
        descricaoItalloElement.textContent = `Caio deve ${formatarMoeda(saldoItallo)}`;
        descricaoItalloElement.style.color = '#27ae60';
    } else if (saldoItallo < 0) {
        descricaoItalloElement.textContent = `Itallo deve ${formatarMoeda(Math.abs(saldoItallo))}`;
        descricaoItalloElement.style.color = '#e74c3c';
    } else {
        descricaoItalloElement.textContent = 'Contas em dia';
        descricaoItalloElement.style.color = '#7f8c8d';
    }
}

// Atualizar histórico
function atualizarHistorico() {
    const corpoHistorico = document.getElementById('historico-corpo');
    const semDadosElement = document.getElementById('sem-dados');
    
    corpoHistorico.innerHTML = '';
    
    // Filtrar se necessário
    let movimentacoesParaExibir = [...movimentacoes];
    
    if (filtroAtivo) {
        // Filtrar apenas últimos 30 dias
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
        
        movimentacoesParaExibir = movimentacoesParaExibir.filter(mov => {
            const dataMov = new Date(mov.data + 'T' + (mov.hora || '00:00'));
            return dataMov >= trintaDiasAtras;
        });
    }
    
    if (movimentacoesParaExibir.length === 0) {
        semDadosElement.style.display = 'block';
        semDadosElement.innerHTML = `
            <i class="fas fa-clipboard-list fa-2x"></i>
            <p>${filtroAtivo ? 'Nenhuma movimentação nos últimos 30 dias' : 'Nenhuma movimentação registrada'}</p>
            <p>${filtroAtivo ? 'Tente remover o filtro' : 'Adicione sua primeira movimentação'}</p>
        `;
        return;
    }
    
    semDadosElement.style.display = 'none';
    
    // Ordenar por data (mais recente primeiro)
    const movimentacoesOrdenadas = movimentacoesParaExibir.sort((a, b) => {
        const dataA = new Date(a.data + 'T' + (a.hora || '00:00'));
        const dataB = new Date(b.data + 'T' + (b.hora || '00:00'));
        return dataB - dataA;
    });
    
    movimentacoesOrdenadas.forEach((mov, index) => {
        const linha = document.createElement('tr');
        
        // Formatar data
        const dataObj = new Date(mov.data);
        const dataFormatada = dataObj.toLocaleDateString('pt-BR');
        const horaFormatada = mov.hora || '';
        
        // Determinar ícone e texto
        let direcaoTexto = '';
        let direcaoIcone = '';
        let classeValor = '';
        let tipoTexto = mov.tipo === 'emprestimo' ? 'Empréstimo' : 'Pagamento';
        
        if (mov.direcao === 'caio-para-itallo') {
            direcaoTexto = 'Caio → Itallo';
            direcaoIcone = '<i class="fas fa-arrow-right"></i>';
        } else {
            direcaoTexto = 'Itallo → Caio';
            direcaoIcone = '<i class="fas fa-arrow-left"></i>';
        }
        
        classeValor = mov.tipo === 'emprestimo' ? 'valor-emprestimo' : 'valor-pagamento';
        
        linha.innerHTML = `
            <td>${dataFormatada}${horaFormatada ? '<br><small>' + horaFormatada + '</small>' : ''}</td>
            <td>${mov.descricao || tipoTexto}</td>
            <td>
                <div class="direcao-setas">
                    ${direcaoIcone}
                    <span>${direcaoTexto}</span>
                </div>
            </td>
            <td class="${classeValor}">${formatarMoeda(mov.valor)}</td>
            <td class="mobile-hidden">
                <button class="btn-excluir" onclick="excluirMovimentacao(${index})">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </td>
        `;
        
        corpoHistorico.appendChild(linha);
    });
}

// Atualizar estatísticas
function atualizarEstatisticas() {
    const totalElement = document.getElementById('total-movimentacoes');
    totalElement.textContent = `${movimentacoes.length} movimentação${movimentacoes.length !== 1 ? 'es' : ''}`;
    
    // Atualizar botão de filtro
    const btnFiltrar = document.getElementById('btn-filtrar');
    if (filtroAtivo) {
        btnFiltrar.innerHTML = '<i class="fas fa-filter"></i> Remover Filtro';
        btnFiltrar.style.backgroundColor = '#3498db';
    } else {
        btnFiltrar.innerHTML = '<i class="fas fa-filter"></i> Filtrar';
        btnFiltrar.style.backgroundColor = '#95a5a6';
    }
}

// Registrar nova movimentação
function registrarMovimentacao(event) {
    event.preventDefault();
    
    // Obter valores
    const tipo = document.getElementById('tipo').value;
    const direcaoElement = document.querySelector('input[name="direcao"]:checked');
    
    if (!direcaoElement) {
        mostrarToast('Selecione quem para quem', 'error');
        return;
    }
    
    const valor = parseFloat(document.getElementById('valor').value);
    const descricao = document.getElementById('descricao').value;
    const data = document.getElementById('data').value;
    const hora = document.getElementById('hora').value;
    
    // Validações
    if (!tipo || !valor || !data || !hora) {
        mostrarToast('Preencha todos os campos', 'error');
        return;
    }
    
    if (valor <= 0) {
        mostrarToast('Valor deve ser maior que zero', 'error');
        return;
    }
    
    // Criar movimentação
    const movimentacao = {
        tipo,
        direcao: direcaoElement.value,
        valor,
        descricao,
        data,
        hora,
        dataRegistro: new Date().toISOString()
    };
    
    // Adicionar
    movimentacoes.push(movimentacao);
    
    // Salvar
    if (salvarDados()) {
        atualizarInterface();
        limparFormulario();
        mostrarToast('Movimentação registrada!', 'success');
    }
}

// Excluir movimentação
function excluirMovimentacao(index) {
    mostrarConfirmacao('excluirMovimentacao', index, 'Tem certeza que deseja excluir esta movimentação?');
}

// Função para excluir movimentação (chamada após confirmação)
function excluirMovimentacaoConfirmada(index) {
    movimentacoes.splice(index, 1);
    
    if (salvarDados()) {
        atualizarInterface();
        mostrarToast('Movimentação excluída!', 'success');
    }
}

// Limpar formulário
function limparFormulario() {
    document.getElementById('form-movimentacao').reset();
    const agora = new Date();
    document.getElementById('data').valueAsDate = agora;
    document.getElementById('hora').value = agora.toTimeString().substring(0, 5);
    atualizarLabelsFormulario();
}

// Atualizar labels do formulário
function atualizarLabelsFormulario() {
    const tipo = document.getElementById('tipo').value;
    const direcaoLabels = document.querySelectorAll('.radio-option label');
    
    if (tipo === 'emprestimo') {
        direcaoLabels[0].querySelector('.desktop-label').textContent = 'Caio emprestou para Itallo';
        direcaoLabels[1].querySelector('.desktop-label').textContent = 'Itallo emprestou para Caio';
    } else if (tipo === 'pagamento') {
        direcaoLabels[0].querySelector('.desktop-label').textContent = 'Caio pagou Itallo';
        direcaoLabels[1].querySelector('.desktop-label').textContent = 'Itallo pagou Caio';
    } else {
        direcaoLabels[0].querySelector('.desktop-label').textContent = 'Caio para Itallo';
        direcaoLabels[1].querySelector('.desktop-label').textContent = 'Itallo para Caio';
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
        saldoCaio: calcularSaldo('caio'),
        saldoItallo: calcularSaldo('itallo'),
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
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            
            if (!dados.movimentacoes || !Array.isArray(dados.movimentacoes)) {
                throw new Error('Formato de arquivo inválido');
            }
            
            mostrarConfirmacao('importarDadosConfirmado', dados.movimentacoes, 
                `Deseja importar ${dados.movimentacoes.length} movimentações? Os dados atuais serão substituídos.`);
            
        } catch (error) {
            console.error('Erro ao importar dados:', error);
            mostrarToast('Erro ao importar arquivo. Verifique o formato.', 'error');
        }
        
        // Limpar input file
        event.target.value = '';
    };
    reader.readAsText(file);
}

// Função para importar dados (chamada após confirmação)
function importarDadosConfirmado(novasMovimentacoes) {
    movimentacoes = novasMovimentacoes;
    
    if (salvarDados()) {
        atualizarInterface();
        mostrarToast(`${movimentacoes.length} movimentações importadas com sucesso!`, 'success');
    }
}

// Calcular saldo
function calcularSaldo(pessoa) {
    let saldo = 0;
    
    movimentacoes.forEach(mov => {
        if (mov.tipo === 'emprestimo') {
            if (mov.direcao === 'caio-para-itallo') {
                saldo += (pessoa === 'caio' ? mov.valor : -mov.valor);
            } else {
                saldo += (pessoa === 'itallo' ? mov.valor : -mov.valor);
            }
        } else if (mov.tipo === 'pagamento') {
            if (mov.direcao === 'caio-para-itallo') {
                saldo += (pessoa === 'caio' ? -mov.valor : mov.valor);
            } else {
                saldo += (pessoa === 'itallo' ? -mov.valor : mov.valor);
            }
        }
    });
    
    return saldo;
}

// Limpar todos os dados
function limparTodosDados() {
    movimentacoes = [];
    
    if (salvarDados()) {
        atualizarInterface();
        mostrarToast('Todos os dados foram excluídos!', 'success');
    }
}

// Mostrar modal de sincronização
function mostrarModalSincronizacao() {
    document.getElementById('sync-modal').style.display = 'flex';
}

// Fechar modal
function fecharModal() {
    document.getElementById('sync-modal').style.display = 'none';
}

// Alternar filtro
function alternarFiltro() {
    filtroAtivo = !filtroAtivo;
    atualizarHistorico();
    atualizarEstatisticas();
    
    if (filtroAtivo) {
        mostrarToast('Filtro ativado: mostrando últimos 30 dias', 'info');
    } else {
        mostrarToast('Filtro removido: mostrando todos os registros', 'info');
    }
}

// Mostrar confirmação
function mostrarConfirmacao(acao, parametros, mensagem) {
    acaoConfirmacao = acao;
    parametrosConfirmacao = parametros;
    
    document.getElementById('confirm-message').textContent = mensagem;
    document.getElementById('confirm-modal').style.display = 'flex';
}

// Cancelar confirmação
function cancelarConfirmacao() {
    acaoConfirmacao = null;
    parametrosConfirmacao = null;
    document.getElementById('confirm-modal').style.display = 'none';
}

// Executar ação confirmada
function executarConfirmacao() {
    if (!acaoConfirmacao) return;
    
    switch (acaoConfirmacao) {
        case 'excluirMovimentacao':
            excluirMovimentacaoConfirmada(parametrosConfirmacao);
            break;
        case 'importarDadosConfirmado':
            importarDadosConfirmado(parametrosConfirmacao);
            break;
        case 'limparTodosDados':
            limparTodosDados();
            break;
    }
    
    cancelarConfirmacao();
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
    const cores = {
        'success': '#27ae60',
        'error': '#e74c3c',
        'warning': '#f39c12',
        'info': '#3498db'
    };
    
    toast.style.backgroundColor = cores[tipo] || '#333';
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Backup automático
function fazerBackupAutomatico() {
    if (movimentacoes.length > 0) {
        try {
            const hoje = new Date().toISOString().split('T')[0];
            const backupKey = `backup_${hoje}`;
            localStorage.setItem(backupKey, JSON.stringify(movimentacoes));
        } catch (e) {
            console.warn('Não foi possível fazer backup automático:', e);
        }
    }
}

// Fazer backup a cada hora
setInterval(fazerBackupAutomatico, 60 * 60 * 1000);